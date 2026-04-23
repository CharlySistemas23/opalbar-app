// ─────────────────────────────────────────────
//  Permissions helpers (Expo Go + native)
//  · Safe requires + logging
//  · Always returns granted/denied/unavailable
// ─────────────────────────────────────────────

type Result = 'granted' | 'denied' | 'unavailable';

function log(msg: string) {
  // eslint-disable-next-line no-console
  if (__DEV__) console.log('[permissions]', msg);
}

export async function requestLocationPermission(): Promise<Result> {
  let Location: any = null;
  try {
    Location = require('expo-location');
  } catch (e) {
    log('expo-location not available: ' + String(e));
    return 'unavailable';
  }
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing?.granted) return 'granted';
    const res = await Location.requestForegroundPermissionsAsync();
    return res?.granted ? 'granted' : 'denied';
  } catch (e) {
    log('location request failed: ' + String(e));
    return 'denied';
  }
}

export async function requestCameraPermission(): Promise<Result> {
  // Prefer expo-camera (standalone), fall back to expo-image-picker
  let mod: any = null;
  try {
    mod = require('expo-camera');
  } catch (e) {
    log('expo-camera not available: ' + String(e));
  }
  if (mod) {
    try {
      const req =
        mod.Camera?.requestCameraPermissionsAsync ??
        mod.requestCameraPermissionsAsync;
      const get =
        mod.Camera?.getCameraPermissionsAsync ??
        mod.getCameraPermissionsAsync;
      if (get) {
        const existing = await get();
        if (existing?.granted) return 'granted';
      }
      if (req) {
        const res = await req();
        return res?.granted ? 'granted' : 'denied';
      }
    } catch (e) {
      log('camera request failed: ' + String(e));
    }
  }
  // Fallback: image-picker's camera permission
  try {
    const ip = require('expo-image-picker');
    const existing = await ip.getCameraPermissionsAsync?.();
    if (existing?.granted) return 'granted';
    const res = await ip.requestCameraPermissionsAsync();
    return res?.granted ? 'granted' : 'denied';
  } catch (e) {
    log('image-picker camera fallback failed: ' + String(e));
    return 'unavailable';
  }
}

export async function requestNotificationPermission(): Promise<Result> {
  let N: any = null;
  try {
    N = require('expo-notifications');
  } catch (e) {
    log('expo-notifications not available: ' + String(e));
    return 'unavailable';
  }
  try {
    const existing = await N.getPermissionsAsync();
    if (existing?.granted) return 'granted';
    // iOS wants finer-grained request options to guarantee the prompt
    const res = await N.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    if (res?.granted) return 'granted';
    // Some Android SDK versions return status 'granted' instead of granted:true
    if (res?.status === 'granted') return 'granted';
    return 'denied';
  } catch (e) {
    log('notifications request failed: ' + String(e));
    return 'denied';
  }
}
