// ─────────────────────────────────────────────
//  pushTokenStore — caches the Expo push token registered with the API
//  so logout can call /push/unregister with the right token.
//
//  Without this, the token stays registered on the backend until Expo
//  reports DeviceNotRegistered (can take days). Audit ref: P1 #5.
// ─────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'opalbar:push:token';

let cached: string | null = null;

export const pushTokenStore = {
  async set(token: string): Promise<void> {
    cached = token;
    try {
      await AsyncStorage.setItem(KEY, token);
    } catch {
      /* ignore */
    }
  },

  async get(): Promise<string | null> {
    if (cached) return cached;
    try {
      const v = await AsyncStorage.getItem(KEY);
      cached = v;
      return v;
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    cached = null;
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
