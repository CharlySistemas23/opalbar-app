let _mod: any = null;
try {
  _mod = require('expo-local-authentication');
} catch {
  _mod = null;
}

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'generic' | 'none';

export interface BiometricState {
  available: boolean;
  enrolled: boolean;
  kind: BiometricKind;
}

export async function getBiometricState(): Promise<BiometricState> {
  if (!_mod) return { available: false, enrolled: false, kind: 'none' };
  try {
    const hasHardware = await _mod.hasHardwareAsync();
    const enrolled = await _mod.isEnrolledAsync();
    let kind: BiometricKind = 'generic';
    if (hasHardware) {
      const types = await _mod.supportedAuthenticationTypesAsync();
      const T = _mod.AuthenticationType ?? {};
      if (types.includes(T.FACIAL_RECOGNITION)) kind = 'face';
      else if (types.includes(T.FINGERPRINT)) kind = 'fingerprint';
      else if (types.includes(T.IRIS)) kind = 'iris';
    }
    return { available: hasHardware, enrolled, kind };
  } catch {
    return { available: false, enrolled: false, kind: 'none' };
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  if (!_mod) return false;
  try {
    const res = await _mod.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    return !!res?.success;
  } catch {
    return false;
  }
}
