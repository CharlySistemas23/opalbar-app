import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { routeForNotifData } from '../lib/notif-routing';
import { notificationsApi } from '../api/client';
import { useAuthStore } from '../stores/auth.store';
import { useUnreadStore } from '../stores/unread.store';
import { clearOsBadge } from './usePushRegistration';

type PushData = Record<string, any> | null | undefined;

/**
 * Navigates to the right screen when the user TAPS an OS push notification.
 * Handles both:
 *  - cold start (app launched by the tap) via getLastNotificationResponseAsync
 *  - warm start (tapped while running/background) via the response listener
 *
 * Routing is shared with the in-app banner through routeForNotifData, so a
 * notification lands on the same screen regardless of delivery channel.
 *
 * Auth gating: a tap is only acted on once the auth store has rehydrated AND
 * the user is authenticated. Every target route is behind the (app) group, so
 * pushing before that would bounce to login and lose the intent. Taps that
 * arrive earlier are parked and replayed as soon as both conditions hold.
 */
export function usePushTapRouting() {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const ready = hasHydrated && isAuthenticated;

  const readyRef = useRef(ready);
  const pending = useRef<PushData>(null);
  const handledColdStart = useRef(false);
  const handledIds = useRef<Set<string>>(new Set());

  const handle = (data: PushData) => {
    const d = data ?? {};
    const notifId = typeof d.notificationId === 'string' ? d.notificationId : null;
    // A response can surface twice (cold start + listener on some Android
    // builds) — act on a given notification only once.
    if (notifId) {
      if (handledIds.current.has(notifId)) return;
      handledIds.current.add(notifId);
    }

    router.push(routeForNotifData(d) as any);

    // Tapping a push means the user saw it → mark read + refresh badges.
    // Fire-and-forget: navigation must never wait on the network.
    if (notifId) {
      notificationsApi.markRead(notifId)
        .then(() => useUnreadStore.getState().refresh())
        .catch(() => {});
    }
    clearOsBadge();
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  // Replay a parked tap once auth is ready.
  useEffect(() => {
    readyRef.current = ready;
    if (ready && pending.current) {
      const data = pending.current;
      pending.current = null;
      // Small delay so the (app) navigator is mounted after login/hydration.
      const t = setTimeout(() => handleRef.current(data), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [ready]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    const dispatch = (data: PushData, delayMs = 0) => {
      if (cancelled) return;
      if (!readyRef.current) { pending.current = data; return; }
      if (delayMs > 0) setTimeout(() => { if (!cancelled) handleRef.current(data); }, delayMs);
      else handleRef.current(data);
    };

    (async () => {
      const Notifications = await import('expo-notifications');

      // Cold start: the tap that launched the app. Small delay so the root
      // navigator is mounted before we push (mirrors index.tsx routing timing).
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!cancelled && last && !handledColdStart.current) {
        handledColdStart.current = true;
        dispatch(last.notification.request.content.data as PushData, 400);
      }

      // Warm start: tapped while the app is already running or backgrounded.
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        dispatch(response.notification.request.content.data as PushData);
      });
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);
}
