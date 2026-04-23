import { io, type Socket } from 'socket.io-client';

const BASE_URL =
  (process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/$/, '');

let _communitySocket: Socket | null = null;

export function getCommunitySocket(): Socket {
  if (_communitySocket && _communitySocket.connected) return _communitySocket;
  if (_communitySocket) {
    _communitySocket.connect();
    return _communitySocket;
  }

  _communitySocket = io(`${BASE_URL}/community`, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  if (__DEV__) {
    _communitySocket.on('connect', () => console.log('[community-socket] connected', _communitySocket?.id));
    _communitySocket.on('disconnect', (reason) => console.log('[community-socket] disconnect', reason));
    _communitySocket.on('connect_error', (err) => console.log('[community-socket] connect_error', err.message));
  }

  return _communitySocket;
}
