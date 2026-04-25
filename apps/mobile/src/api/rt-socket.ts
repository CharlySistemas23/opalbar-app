// ─────────────────────────────────────────────
//  Realtime socket — `/rt` namespace, JWT-authed
//  Single global stream of envelopes for every resource in the app.
// ─────────────────────────────────────────────
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './client';

// Mirror of api/client.ts logic: in release/OTA bundles a LAN URL leaked from
// the local .env will reach the device, where it cannot resolve. Fall back to
// the production Railway host whenever we detect a LAN IP in a non-dev build.
const PROD_HOST = 'https://opalbar-app-production.up.railway.app';
const ENV_URL = process.env['EXPO_PUBLIC_API_URL'];
const isLanUrl = typeof ENV_URL === 'string' && /^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/.test(ENV_URL);
const RAW = ENV_URL && !(!__DEV__ && isLanUrl) ? ENV_URL : (__DEV__ ? 'http://localhost:3000/api/v1' : PROD_HOST);
const BASE_URL = RAW.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');

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
    _socket.auth = { token: tokenStore.getAccessToken() ?? '' };
    _socket.connect();
    return _socket;
  }

  _socket = io(`${BASE_URL}/rt`, {
    // Polling first — Railway's edge / some WiFi routers refuse WSS upgrades.
    // Polling works over plain HTTPS and socket.io will upgrade to ws if it can.
    transports: ['polling', 'websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    auth: { token: tokenStore.getAccessToken() ?? '' },
  });

  if (__DEV__) {
    _socket.on('connect', () => console.log('[rt] connected', _socket?.id));
    _socket.on('disconnect', (reason) => console.log('[rt] disconnect', reason));
    _socket.on('connect_error', (err) => console.log('[rt] connect_error', err.message));
  }

  if (__DEV__) {
    _socket.on('rt:event', (env: RealtimeEnvelope) =>
      console.log('[rt] event', env.resource, env.action, env.id ?? ''),
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

export function updateRtToken(token: string | null) {
  if (_socket) {
    _socket.auth = { token: token ?? '' };
    if (_socket.connected) {
      _socket.disconnect();
      _socket.connect();
    }
  }
}
