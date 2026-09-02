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
  | 'user' | 'post' | 'story' | 'comment' | 'message' | 'thread' | 'mention' | 'notification'
  | 'report' | 'reservation' | 'ticket' | 'event' | 'offer'
  | 'review' | 'checkin' | 'venue' | 'flag' | 'loyalty' | 'gdpr' | 'auth';

export type RealtimeAction =
  | 'created' | 'updated' | 'deleted' | 'restored'
  | 'approved' | 'rejected' | 'banned' | 'unbanned'
  | 'role_changed' | 'status_changed' | 'reacted' | 'commented'
  | 'read' | 'sent' | 'pending';

export interface RealtimeEnvelope {
  resource: RealtimeResource;
  action: RealtimeAction;
  id?: string;
  data?: any;
  at: string;
}

let _socket: Socket | null = null;

// ── Socket generation ─────────────────────────────────────────────────────
// `closeRtSocket()` (logout / auth failure) calls `removeAllListeners()` and
// drops the instance. Permanently-mounted subscribers (NotificationListener,
// unread store, tab badges) attach their handler once in a `useEffect`, so
// after re-login they would be listening on a dead object. Every time the
// singleton is torn down or recreated we bump this counter; `useRealtime`
// includes it in its effect deps and re-subscribes on the fresh socket.
let _generation = 0;
const _generationListeners = new Set<() => void>();

function bumpGeneration() {
  _generation += 1;
  _generationListeners.forEach((cb) => {
    try { cb(); } catch { /* listener errors must not break the socket */ }
  });
}

export function getSocketGeneration(): number {
  return _generation;
}

/** Subscribe to generation changes (for `useSyncExternalStore`). */
export function subscribeSocketGeneration(cb: () => void): () => void {
  _generationListeners.add(cb);
  return () => { _generationListeners.delete(cb); };
}

// Pending auth failure reported by the server on the last connect attempt.
let _lastAuthError: string | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function hasToken(): boolean {
  return !!tokenStore.getAccessToken();
}

/**
 * Server rejected our token (`auth_error` + `io server disconnect`). Fire a
 * cheap authenticated request so the axios interceptor refreshes the token;
 * `onTokensRefreshed` → `updateRtToken` then reconnects with the new one.
 * If refresh fails the interceptor's `onAuthFailed` closes the socket.
 */
function requestTokenRefresh() {
  if (!tokenStore.getRefreshToken()) return;
  // Lazy import avoids a require cycle at module-eval time (client.ts is
  // already imported for tokenStore, but keep the call site explicit).
  import('./client')
    .then(({ apiClient }) => apiClient.get('/users/me', { params: { _rt: 1 } }))
    .catch(() => { /* interceptor already handled the outcome */ });
}

function scheduleReconnect(delayMs: number) {
  if (_reconnectTimer) clearTimeout(_reconnectTimer);
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    const s = _socket;
    if (!s || s.connected || !hasToken()) return;
    s.auth = { token: tokenStore.getAccessToken() ?? '' };
    s.connect();
  }, delayMs);
}

export function getRtSocket(): Socket {
  if (_socket && _socket.connected) return _socket;
  if (_socket) {
    // Guests (no token) keep a dormant instance so subscribers can attach;
    // we only dial once a token exists — the server would reject us anyway.
    if (hasToken() && !_socket.active) {
      _socket.auth = { token: tokenStore.getAccessToken() ?? '' };
      _socket.connect();
    }
    return _socket;
  }

  const token = tokenStore.getAccessToken() ?? '';
  _socket = io(`${BASE_URL}/rt`, {
    // Polling first — Railway's edge / some WiFi routers refuse WSS upgrades.
    // Polling works over plain HTTPS and socket.io will upgrade to ws if it can.
    transports: ['polling', 'websocket'],
    autoConnect: !!token,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    auth: { token },
  });
  bumpGeneration();

  _socket.on('connect', () => {
    _lastAuthError = null;
    if (__DEV__) console.log('[rt] connected', _socket?.id);
  });
  _socket.on('auth_error', (payload: { code?: string; message?: string }) => {
    _lastAuthError = payload?.code ?? 'INVALID_TOKEN';
    if (__DEV__) console.log('[rt] auth_error', _lastAuthError);
  });
  _socket.on('disconnect', (reason) => {
    if (__DEV__) console.log('[rt] disconnect', reason);
    // socket.io does NOT auto-reconnect after a server-initiated disconnect.
    if (reason === 'io server disconnect') {
      if (_lastAuthError === 'TOKEN_EXPIRED' || _lastAuthError === 'INVALID_TOKEN') {
        // Bad token → refresh; updateRtToken() reconnects when it lands.
        requestTokenRefresh();
      } else if (_lastAuthError === 'TOKEN_REVOKED' || _lastAuthError === 'NO_TOKEN') {
        // Session gone — stay dormant until the auth store reconnects us.
      } else if (hasToken()) {
        scheduleReconnect(1500);
      }
    }
  });
  if (__DEV__) {
    _socket.on('connect_error', (err) => console.log('[rt] connect_error', err.message));
    _socket.on('rt:event', (env: RealtimeEnvelope) =>
      console.log('[rt] event', env.resource, env.action, env.id ?? ''),
    );
  }

  return _socket;
}

export function closeRtSocket() {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  _lastAuthError = null;
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
    bumpGeneration();
  }
}

export function updateRtToken(token: string | null) {
  if (!_socket) return;
  _socket.auth = { token: token ?? '' };
  _lastAuthError = null;
  if (!token) {
    // Logged out / guest: drop the live connection but keep the instance.
    if (_socket.active) _socket.disconnect();
    return;
  }
  if (_socket.connected) {
    // Re-auth with the rotated token.
    _socket.disconnect();
    _socket.connect();
  } else if (!_socket.active) {
    _socket.connect();
  }
}
