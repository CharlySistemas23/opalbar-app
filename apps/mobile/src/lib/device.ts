// ─────────────────────────────────────────────
//  Device metadata sent with login so the user can recognise the session
//  later in Profile → Sesiones activas ("iPhone 15 · iOS 17.4").
// ─────────────────────────────────────────────
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export interface DeviceMeta {
  deviceName?: string;
  deviceOs?: string;
}

export function getDeviceMeta(): DeviceMeta {
  try {
    const deviceName = Device.modelName ?? Device.deviceName ?? undefined;
    const osName = Device.osName ?? (Platform.OS === 'ios' ? 'iOS' : Platform.OS);
    const osVersion = Device.osVersion ?? '';
    const deviceOs = `${osName} ${osVersion}`.trim();
    return {
      deviceName: deviceName || undefined,
      deviceOs: deviceOs || undefined,
    };
  } catch {
    return {};
  }
}
