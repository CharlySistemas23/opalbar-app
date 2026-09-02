import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { apiClient } from '../api/client';
import { pushTokenStore } from '../api/push-token-store';
import { useAuthStore } from '../stores/auth.store';
import { toast } from '../components/Toast';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type Diagnostic =
  | { ok: true; token: string }
  | { ok: false; reason: string };

async function getExpoPushToken(): Promise<Diagnostic> {
  if (!Device.isDevice) return { ok: false, reason: 'emulador (Device.isDevice=false)' };
  if (isExpoGo && Platform.OS === 'android') {
    return { ok: false, reason: 'Expo Go en Android no soporta push' };
  }

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return { ok: false, reason: `permiso=${status}` };

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    if (!projectId) return { ok: false, reason: 'no projectId en EAS config' };

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!tokenRes?.data) return { ok: false, reason: 'getExpoPushTokenAsync sin data' };
    return { ok: true, token: tokenRes.data };
  } catch (err: any) {
    return { ok: false, reason: `excepción: ${err?.message ?? String(err)}` };
  }
}

/**
 * Clears the OS badge number. Called when the inbox is opened and whenever
 * the app returns to the foreground — the in-app badges (unread store) are
 * the source of truth once the user is inside.
 */
export async function clearOsBadge() {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.setBadgeCountAsync(0);
  } catch {
    /* expo-notifications unavailable (web / Expo Go quirks) — nothing to clear */
  }
}

// Module-level memo so a re-mount (fast refresh, layout remount) doesn't
// re-register the same token for the same session.
let lastRegisteredToken: string | null = null;

export function usePushRegistration() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      lastRegisteredToken = null;
      return;
    }
    let cancelled = false;

    (async () => {
      const result = await getExpoPushToken();
      if (cancelled) return;

      if (!result.ok) {
        // Diagnostics only for developers — end users must never see raw
        // reasons like "permiso=denied" as a red toast on every launch.
        if (__DEV__) toast(`Push no disponible: ${result.reason}`, 'danger');
        apiClient.post('/push/register-failed', { reason: result.reason }).catch(() => {});
        return;
      }

      // Dedupe: same token already registered this session (or persisted
      // from a previous one) → skip the network round-trip.
      const cached = lastRegisteredToken ?? (await pushTokenStore.get());
      if (cached === result.token) {
        lastRegisteredToken = result.token;
        return;
      }

      try {
        await apiClient.post('/push/register', {
          token: result.token,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        });
        // Cache the token so logout can unregister it server-side. Without
        // this, the token stays in pushToken table until Expo reports
        // DeviceNotRegistered (can take days). Audit ref: P1 #5, 2026-05-18.
        lastRegisteredToken = result.token;
        await pushTokenStore.set(result.token);
      } catch (err: any) {
        if (__DEV__) toast(`Push register API error: ${err?.message ?? 'unknown'}`, 'danger');
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // OS badge hygiene: coming back to the app clears the tray count; the
  // in-app badges take over from there.
  useEffect(() => {
    if (!isAuthenticated) return;
    clearOsBadge();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clearOsBadge();
    });
    return () => sub.remove();
  }, [isAuthenticated]);
}
