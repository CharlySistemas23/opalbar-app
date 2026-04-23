// ─────────────────────────────────────────────
//  useOffline — reactive online/offline detection
//  Uses @react-native-community/netinfo when installed; otherwise assumes online.
//  Usage:
//    const offline = useOffline(); // boolean
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type NetInfoModule = typeof import('@react-native-community/netinfo');

let _netinfo: NetInfoModule | null = null;
let _netinfoLoaded = false;

function loadNetInfo(): NetInfoModule | null {
  if (_netinfoLoaded) return _netinfo;
  _netinfoLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _netinfo = require('@react-native-community/netinfo');
    return _netinfo;
  } catch {
    return null;
  }
}

export function useOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Web fallback using navigator.onLine
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      setOffline(!window.navigator.onLine);
      const on = () => setOffline(false);
      const off = () => setOffline(true);
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      return () => {
        window.removeEventListener('online', on);
        window.removeEventListener('offline', off);
      };
    }

    const NI = loadNetInfo();
    if (!NI) return; // package not installed — assume online

    const unsubscribe = NI.default.addEventListener((state) => {
      const isOffline = state.isConnected === false || state.isInternetReachable === false;
      setOffline(isOffline);
    });

    // Initial fetch
    NI.default.fetch().then((state) => {
      const isOffline = state.isConnected === false || state.isInternetReachable === false;
      setOffline(isOffline);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return offline;
}
