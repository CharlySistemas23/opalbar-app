// ─────────────────────────────────────────────
//  Realtime socket — `/rt` namespace, JWT-authed
//  Single global stream of envelopes for every resource the admin can see.
// ─────────────────────────────────────────────
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './client';

// socket.io needs an ABSOLUTE host. Vercel rewrites in vercel.json only
// affect HTTP, not WebSockets — if VITE_API_URL is a relative path
// (e.g. "/api/v1"), the socket would otherwise try to reach Vercel itself.
// Fall back to the Railway public host so production always works.
const RAW_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const PROD_API_HOST = 'https://opalbar-app-production.up.railway.app';
const BASE_URL = RAW_API_URL.startsWith('http')
  ? RAW_API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
  : PROD_API_HOST;

export type RealtimeResource =
  | 'user' | 'post' | 'comment' | 'message' | 'notification'
  | 'report' | 'reservation' | 'ticket' | 'event' | 'offer'
  | 'review' | 'checkin' | 'venue' | 'flag' | 'loyalty' | 'gdpr';

export type RealtimeAction =
  | 'created' | 'updated' | 'deleted' | 'restored'
  | 'approved' | 'rejected' | 'banned' | 'unbanned'
  | 'role_changed' | 'status_changed' | 'reacted' | 'commented'
  | 'read' | 'sent';

export interface RealtimeEnvelope {
  resource: RealtimeResource;
  action: RealtimeAction;
  id?: string;
  data?: any;
  at: string;
}

let _socket: Socket | null = null;

export function getRtSocket(): Socket {
  if (_socket && _socket.connected) return _socket;
  if (_socket) {
    _socket.auth = { token: tokenStore.access ?? '' };
    _socket.connect();
    return _socket;
  }

  _socket = io(`${BASE_URL}/rt`, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: { token: tokenStore.access ?? '' },
  });

  if (import.meta.env.DEV) {
    _socket.on('connect', () => console.log('[rt] connected', _socket?.id));
    _socket.on('disconnect', (reason) => console.log('[rt] disconnect', reason));
    _socket.on('connect_error', (err) => console.log('[rt] connect_error', err.message));
    _socket.on('rt:event', (env: RealtimeEnvelope) =>
      console.log('[rt]', env.resource, env.action, env.id ?? ''),
    );
  }

  return _socket;
}

export function closeRtSocket() {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}

export function refreshRtToken() {
  if (_socket) {
    _socket.auth = { token: tokenStore.access ?? '' };
    if (_socket.connected) {
      _socket.disconnect();
      _socket.connect();
    }
  }
}
