// ─────────────────────────────────────────────
//  useRealtime — admin-side. Mounted once at the top of the auth-guarded
//  layout. Subscribes to `/rt` and invalidates the relevant React Query
//  keys so every page reflects server changes without manual refresh.
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getRtSocket, type RealtimeEnvelope } from '@/api/rt-socket';

function dispatch(qc: QueryClient, env: RealtimeEnvelope) {
  switch (env.resource) {
    case 'user':
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      qc.invalidateQueries({ queryKey: ['admin', 'activity'] });
      qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
      if (env.id) qc.invalidateQueries({ queryKey: ['admin', 'user', env.id] });
      break;

    case 'post':
    case 'comment':
      qc.invalidateQueries({ queryKey: ['admin', 'community'] });
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
      qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      break;

    case 'message':
      qc.invalidateQueries({ queryKey: ['admin', 'messages'] });
      qc.invalidateQueries({ queryKey: ['admin', 'messages', 'threads'] });
      if (env.data?.threadId) {
        qc.invalidateQueries({ queryKey: ['admin', 'messages', env.data.threadId] });
      }
      break;

    case 'notification':
      qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      break;

    case 'report':
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      if (env.id) qc.invalidateQueries({ queryKey: ['admin', 'report', env.id] });
      break;

    case 'reservation':
      qc.invalidateQueries({ queryKey: ['admin', 'reservations'] });
      qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      qc.invalidateQueries({ queryKey: ['admin', 'activity'] });
      break;

    case 'ticket':
      qc.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      if (env.id) qc.invalidateQueries({ queryKey: ['admin', 'ticket', env.id] });
      break;

    case 'event':
      qc.invalidateQueries({ queryKey: ['admin', 'events'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      break;

    case 'offer':
      qc.invalidateQueries({ queryKey: ['admin', 'offers'] });
      qc.invalidateQueries({ queryKey: ['offers'] });
      break;

    case 'review':
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      break;

    case 'venue':
      qc.invalidateQueries({ queryKey: ['admin', 'venues'] });
      qc.invalidateQueries({ queryKey: ['venues'] });
      break;

    case 'checkin':
      qc.invalidateQueries({ queryKey: ['admin', 'reservations'] });
      qc.invalidateQueries({ queryKey: ['admin', 'activity'] });
      break;

    case 'gdpr':
      qc.invalidateQueries({ queryKey: ['admin', 'gdpr'] });
      break;

    case 'flag':
      qc.invalidateQueries({ queryKey: ['admin', 'flags'] });
      break;

    case 'loyalty':
      qc.invalidateQueries({ queryKey: ['admin', 'loyalty'] });
      break;
  }
}

export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const socket = getRtSocket();
    const handler = (env: RealtimeEnvelope) => dispatch(qc, env);
    socket.on('rt:event', handler);
    return () => {
      socket.off('rt:event', handler);
    };
  }, [enabled, qc]);
}
