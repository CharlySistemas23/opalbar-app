// ─────────────────────────────────────────────
//  unread.store — badge counters for tabs / profile / home.
//
//  One store, three numbers:
//    messages        unread DM threads (GET /messages/unread-count → threads)
//    notifications   unread inbox rows (GET /notifications?limit=1 → unreadCount)
//    friendRequests  incoming friend requests (GET /friendships/requests/counts → total)
//
//  Usage (badges):
//    const unreadMessages = useUnreadStore((s) => s.messages);
//    <Badge count={unreadMessages} />
//
//  Usage (keep fresh) — mount ONCE near the root while authenticated, e.g. in
//  app/(tabs)/_layout.tsx or next to RealtimeBridge:
//    useUnreadRealtime();
//  It loads on mount, re-fetches when the app returns to foreground and when
//  the /rt socket pushes a message / thread / notification / user event, and
//  resets to zero on logout.
//
//  Screens that consume a counter locally (inbox marks a thread read,
//  notifications screen marks all read) may call `useUnreadStore.getState()
//  .set({ messages: 0 })` for an instant optimistic update, then `refresh()`.
// ─────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { friendshipsApi, messagesApi, notificationsApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useRealtime } from '@/hooks/useRealtime';

export interface UnreadCounts {
  /** Threads with at least one unread message (badge on the Messages tab). */
  messages: number;
  /** Total unread messages across threads (secondary, for "N mensajes"). */
  messageCount: number;
  /** Pending message requests (chip inside the inbox). */
  messageRequests: number;
  notifications: number;
  friendRequests: number;
}

interface UnreadState extends UnreadCounts {
  /** True while the first load hasn't completed. */
  loading: boolean;
  lastRefreshedAt: number | null;
  refresh: () => Promise<void>;
  set: (patch: Partial<UnreadCounts>) => void;
  reset: () => void;
}

const ZERO: UnreadCounts = {
  messages: 0,
  messageCount: 0,
  messageRequests: 0,
  notifications: 0,
  friendRequests: 0,
};

let inflight: Promise<void> | null = null;

export const useUnreadStore = create<UnreadState>((set, get) => ({
  ...ZERO,
  loading: true,
  lastRefreshedAt: null,

  set: (patch) => set(patch),
  reset: () => set({ ...ZERO, loading: false, lastRefreshedAt: null }),

  refresh: async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      get().reset();
      return;
    }
    // Coalesce bursts (several realtime events in the same tick).
    if (inflight) return inflight;
    inflight = (async () => {
      const [msg, notif, friends, requests] = await Promise.allSettled([
        messagesApi.unreadCount(),
        notificationsApi.list({ page: 1, limit: 1 }),
        friendshipsApi.requestsCounts(),
        messagesApi.requestsCount(),
      ]);
      const patch: Partial<UnreadCounts> = {};
      if (msg.status === 'fulfilled') {
        const d = msg.value.data?.data ?? {};
        patch.messages = Number(d.threads ?? 0);
        patch.messageCount = Number(d.messages ?? 0);
      }
      if (notif.status === 'fulfilled') {
        const d = notif.value.data?.data ?? {};
        patch.notifications = Number(d.unreadCount ?? 0);
      }
      if (friends.status === 'fulfilled') {
        const d = friends.value.data?.data ?? {};
        // Both tabs count. Filtered requests still live behind their own tab,
        // but they are real people waiting for an answer — leaving them out of
        // the badge is why users reported that requests "never arrive".
        patch.friendRequests = Number(d.total ?? (Number(d.main ?? 0) + Number(d.filtered ?? 0)));
      }
      if (requests.status === 'fulfilled') {
        const d = requests.value.data?.data ?? {};
        patch.messageRequests = Number(d.count ?? 0);
      }
      set({ ...patch, loading: false, lastRefreshedAt: Date.now() });
    })().finally(() => { inflight = null; });
    return inflight;
  },
}));

/**
 * Keeps the counters fresh. Mount once (root layout / tabs layout). Safe to
 * mount while logged out — it just stays at zero until login.
 */
export function useUnreadRealtime() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refresh = useUnreadStore((s) => s.refresh);
  const reset = useUnreadStore((s) => s.reset);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = () => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      debounce.current = null;
      refresh().catch(() => {});
    }, 250);
  };

  // Initial load + foreground refresh.
  useEffect(() => {
    if (!isAuthenticated) { reset(); return; }
    refresh().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleRefresh();
    });
    return () => {
      sub.remove();
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Live updates. 'user' covers friend request created/accepted envelopes
  // emitted by the friendships module; 'thread' covers request accept/
  // decline/block; 'message' covers sent/read/deleted.
  useRealtime(['message', 'thread', 'notification', 'user'], (env) => {
    if (!useAuthStore.getState().isAuthenticated) return;
    // Profile edits / role changes on 'user' don't affect badges; friend
    // request lifecycle arrives as created / pending / updated / deleted.
    if (env.resource === 'user' && env.action === 'role_changed') return;
    scheduleRefresh();
  });
}
