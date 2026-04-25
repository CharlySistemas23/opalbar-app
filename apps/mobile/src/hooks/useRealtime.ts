// ─────────────────────────────────────────────
//  useRealtime — subscribe to the unified `/rt` socket stream.
//
//  The mobile app does NOT use React Query — screens manage their own
//  state via zustand stores and useEffect-driven fetches. This hook lets
//  any component subscribe to a specific resource family and run a
//  callback (typically refetch + setState) whenever the server pushes
//  an event for that resource.
//
//  Usage:
//    useRealtime('reservation', () => loadMyReservations());
//    useRealtime(['post', 'comment'], () => loadFeed());
//    useRealtime('*', (env) => console.log(env)); // every event
// ─────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { getRtSocket, type RealtimeEnvelope, type RealtimeResource } from '../api/rt-socket';

type ResourceFilter = RealtimeResource | RealtimeResource[] | '*';

export function useRealtime(
  resource: ResourceFilter,
  onEvent: (env: RealtimeEnvelope) => void,
) {
  const cbRef = useRef(onEvent);
  useEffect(() => { cbRef.current = onEvent; }, [onEvent]);

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
  }, [Array.isArray(resource) ? resource.join(',') : resource]);
}

/**
 * Mount once after login to keep the realtime socket alive while the user
 * is authenticated. Doesn't subscribe to any specific event — individual
 * screens use `useRealtime(resource, cb)` for that.
 */
export function useRealtimeConnection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const socket = getRtSocket();
    // Touch the socket so it reconnects with the latest token.
    if (!socket.connected) socket.connect();
  }, [enabled]);
}
