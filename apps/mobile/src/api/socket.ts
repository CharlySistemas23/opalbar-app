// ─────────────────────────────────────────────
//  Socket.io client — real-time chat + presence
// ─────────────────────────────────────────────
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './client';

// Mirror of api/client.ts: a LAN URL baked from local .env into the OTA
// bundle cannot resolve on the device. Fall back to Railway in release.
const PROD_HOST = 'https://opalbar-app-production.up.railway.app';
const ENV_URL = process.env['EXPO_PUBLIC_API_URL'];
const isLanUrl = typeof ENV_URL === 'string' && /^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/.test(ENV_URL);
const RAW = ENV_URL && !(!__DEV__ && isLanUrl) ? ENV_URL : (__DEV__ ? 'http://localhost:3000/api/v1' : PROD_HOST);
const BASE_URL = RAW.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');

let _socket: Socket | null = null;

/**
 * Get (or lazily create) the singleton socket instance. The socket uses
 * the current access token from `tokenStore`. When the token rotates, the
 * socket will reconnect on the next message.
 */
export function getSocket(): Socket {
  if (_socket && _socket.connected) return _socket;
  if (_socket) {
    // Update auth in case token rotated. Guests (no token) stay dormant.
    _socket.auth = { token: tokenStore.getAccessToken() ?? '' };
    if (tokenStore.getAccessToken() && !_socket.active) _socket.connect();
    return _socket;
  }

  _socket = io(BASE_URL, {
    // Polling first — Railway's edge / some WiFi routers refuse WSS upgrades,
    // which would leave the chat permanently "Desconectado".
    transports: ['polling', 'websocket'],
    autoConnect: !!tokenStore.getAccessToken(),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: {
      token: tokenStore.getAccessToken() ?? '',
    },
  });

  _socket.on('connect', () => {
    _lastAuthError = null;
    if (__DEV__) console.log('[socket] connected', _socket?.id);
  });
  _socket.on('auth_error', (payload: { code?: string }) => {
    _lastAuthError = payload?.code ?? 'INVALID_TOKEN';
    if (__DEV__) console.log('[socket] auth_error', _lastAuthError);
  });
  _socket.on('disconnect', (reason) => {
    if (__DEV__) console.log('[socket] disconnect', reason);
    // Server-initiated disconnects are not retried by socket.io. An expired
    // token → refresh via the axios interceptor; `updateSocketToken` then
    // reconnects with the rotated token.
    if (reason !== 'io server disconnect') return;
    if (_lastAuthError === 'TOKEN_EXPIRED' || _lastAuthError === 'INVALID_TOKEN') {
      requestTokenRefresh();
    } else if (!_lastAuthError && tokenStore.getAccessToken()) {
      setTimeout(() => {
        const s = _socket;
        if (!s || s.connected || !tokenStore.getAccessToken()) return;
        s.auth = { token: tokenStore.getAccessToken() ?? '' };
        s.connect();
      }, 1500);
    }
  });
  if (__DEV__) {
    _socket.on('connect_error', (err) => console.log('[socket] connect_error', err.message));
    _socket.on('error', (err) => console.log('[socket] error', err));
  }

  return _socket;
}

let _lastAuthError: string | null = null;

function requestTokenRefresh() {
  if (!tokenStore.getRefreshToken()) return;
  import('./client')
    .then(({ apiClient }) => apiClient.get('/users/me', { params: { _ws: 1 } }))
    .catch(() => { /* interceptor already handled the outcome */ });
}

/** Close the connection (e.g. on logout). */
export function closeSocket() {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}

/** Refresh auth token on the live socket without reconnecting. */
export function updateSocketToken(token: string | null) {
  if (!_socket) return;
  _socket.auth = { token: token ?? '' };
  _lastAuthError = null;
  if (!token) {
    if (_socket.active) _socket.disconnect();
    return;
  }
  // Force re-auth by reconnecting
  if (_socket.connected) {
    _socket.disconnect();
    _socket.connect();
  } else if (!_socket.active) {
    _socket.connect();
  }
}
