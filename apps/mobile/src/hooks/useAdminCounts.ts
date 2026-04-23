// ─────────────────────────────────────────────
//  useAdminCounts — pending-work counts for admin tab badges
//  Polls /admin/inbox/counts every 30s while mounted.
// ─────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { adminApi } from '../api/client';

export interface InboxCounts {
  flags: number;
  reports: number;
  tickets: number;
  posts: number;
  reviews: number;
  reservations: number;
  total: number;
}

const ZERO: InboxCounts = {
  flags: 0, reports: 0, tickets: 0, posts: 0, reviews: 0, reservations: 0, total: 0,
};

/**
 * Polls admin inbox counts on an interval. Returns the latest counts
 * plus a `refresh()` to force an immediate fetch (useful after the admin
 * takes an action and wants the badge updated without waiting).
 */
export function useAdminCounts(intervalMs = 30_000): { counts: InboxCounts; refresh: () => void } {
  const [counts, setCounts] = useState<InboxCounts>(ZERO);
  const mountedRef = useRef(true);

  const fetchCounts = useCallback(async () => {
    try {
      const r = await adminApi.inboxCounts();
      const data = (r.data?.data ?? r.data) as InboxCounts;
      if (!mountedRef.current) return;
      setCounts({
        flags: data.flags ?? 0,
        reports: data.reports ?? 0,
        tickets: data.tickets ?? 0,
        posts: data.posts ?? 0,
        reviews: data.reviews ?? 0,
        reservations: data.reservations ?? 0,
        total: data.total ?? 0,
      });
    } catch {
      // Network blips are fine — keep previous counts.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchCounts();
    const id = setInterval(fetchCounts, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchCounts, intervalMs]);

  return { counts, refresh: fetchCounts };
}
