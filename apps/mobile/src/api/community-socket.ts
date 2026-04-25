import { io, type Socket } from 'socket.io-client';

// Mirror of api/client.ts logic — see rt-socket.ts for the same fix. LAN URLs
// from a local .env can be baked into OTA bundles and would point the device
// at a dev server it cannot reach.
const PROD_HOST = 'https://opalbar-app-production.up.railway.app';
const ENV_URL = process.env['EXPO_PUBLIC_API_URL'];
const isLanUrl = typeof ENV_URL === 'string' && /^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/.test(ENV_URL);
const RAW = ENV_URL && !(!__DEV__ && isLanUrl) ? ENV_URL : (__DEV__ ? 'http://localhost:3000/api/v1' : PROD_HOST);
const BASE_URL = RAW.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');

let _communitySocket: Socket | null = null;

export function getCommunitySocket(): Socket {
  if (_communitySocket && _communitySocket.connected) return _communitySocket;
  if (_communitySocket) {
    _communitySocket.connect();
    return _communitySocket;
  }

  _communitySocket = io(`${BASE_URL}/community`, {
    // Polling first — Railway's edge / some WiFi routers refuse WSS upgrades.
    transports: ['polling', 'websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  // Always log so prod connection issues surface.
  if (__DEV__) {
    _communitySocket.on('connect', () => console.log('[community-socket] connected', _communitySocket?.id));
    _communitySocket.on('disconnect', (reason) => console.log('[community-socket] disconnect', reason));
    _communitySocket.on('connect_error', (err) => console.log('[community-socket] connect_error', err.message));
  }

  return _communitySocket;
}
