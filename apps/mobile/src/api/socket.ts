// ─────────────────────────────────────────────
//  Socket.io client — real-time chat + presence
// ─────────────────────────────────────────────
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './client';

const BASE_URL =
  (process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1')
    .replace(/\/api\/v1\/?$/, '') // Socket.io runs at root, not /api/v1
    .replace(/\/$/, '');

let _socket: Socket | null = null;

/**
 * Get (or lazily create) the singleton socket instance. The socket uses
 * the current access token from `tokenStore`. When the token rotates, the
 * socket will reconnect on the next message.
 */
export function getSocket(): Socket {
  if (_socket && _socket.connected) return _socket;
  if (_socket) {
    // Update auth in case token rotated
    _socket.auth = { token: tokenStore.getAccessToken() ?? '' };
    _socket.connect();
    return _socket;
  }

  _socket = io(BASE_URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: {
      token: tokenStore.getAccessToken() ?? '',
    },
  });

  if (__DEV__) {
    _socket.on('connect', () => console.log('[socket] connected', _socket?.id));
    _socket.on('disconnect', (reason) => console.log('[socket] disconnect', reason));
    _socket.on('connect_error', (err) => console.log('[socket] connect_error', err.message));
    _socket.on('error', (err) => console.log('[socket] error', err));
  }

  return _socket;
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
  if (_socket) {
    _socket.auth = { token: token ?? '' };
    // Force re-auth by reconnecting
    if (_socket.connected) {
      _socket.disconnect();
      _socket.connect();
    }
  }
}
