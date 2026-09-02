// ─────────────────────────────────────────────
//  useRealtime — subscribe to the unified `/rt` socket stream.
//
//  The mobile app does NOT use React Query — screens manage their own
//  state via zustand stores and useEffect-driven fetches. This hook lets
//  any component subscribe to a specific resource family and run a
//  callback (typically refetch + setState) whenever the server pushes
//  an event for that resource.
//
//  Lifecycle: the socket singleton is torn down on logout and rebuilt on
//  the next login. `useSocketGeneration()` tracks that so listeners that
//  live for the whole app session (NotificationListener, unread badges)
//  re-attach to the fresh instance instead of a dead one.
//
//  Usage:
//    useRealtime('reservation', () => loadMyReservations());
//    useRealtime(['post', 'comment'], () => loadFeed());
//    useRealtime('*', (env) => console.log(env)); // every event
// ─────────────────────────────────────────────
import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  getRtSocket,
  getSocketGeneration,
  subscribeSocketGeneration,
  type RealtimeEnvelope,
  type RealtimeResource,
} from '../api/rt-socket';
import { tokenStore } from '../api/client';

type ResourceFilter = RealtimeResource | RealtimeResource[] | '*';

/** Increments every time the `/rt` socket singleton is closed or recreated. */
export function useSocketGeneration(): number {
  return useSyncExternalStore(subscribeSocketGeneration, getSocketGeneration, getSocketGeneration);
}

export function useRealtime(
  resource: ResourceFilter,
  onEvent: (env: RealtimeEnvelope) => void,
) {
  const cbRef = useRef(onEvent);
  useEffect(() => { cbRef.current = onEvent; }, [onEvent]);
  const generation = useSocketGeneration();
  const key = Array.isArray(resource) ? resource.join(',') : resource;

  useEffect(() => {
    const socket = getRtSocket();

    const matches = (env: RealtimeEnvelope) => {
      if (resource === '*') return true;
      if (Array.isArray(resource)) return resource.includes(env.resource);
      return env.resource === resource;
    };

    const handler = (env: RealtimeEnvelope) => {
      if (matches(env)) cbRef.current(env);
    };

    socket.on('rt:event', handler);
    return () => {
      socket.off('rt:event', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, generation]);
}

/**
 * Mount once after login to keep the realtime socket alive while the user
 * is authenticated. Doesn't subscribe to any specific event — individual
 * screens use `useRealtime(resource, cb)` for that.
 */
export function useRealtimeConnection(enabled: boolean) {
  const generation = useSocketGeneration();
  useEffect(() => {
    if (!enabled) return;
    const socket = getRtSocket();
    // Touch the socket so it reconnects with the latest token. `getRtSocket`
    // itself refuses to dial without a token (guest sessions).
    if (!socket.connected && !socket.active && tokenStore.getAccessToken()) socket.connect();
  }, [enabled, generation]);
}
