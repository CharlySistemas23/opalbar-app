// ─────────────────────────────────────────────
//  Biometric app-lock — expo-local-authentication
//
//  Public API
//   · getBiometricState()            → { available, enrolled, kind }
//   · authenticate(reason)           → boolean (Face ID / Touch ID / passcode)
//   · useBiometricLock()             → { enabled, ready, available, enrolled,
//                                        kind, setEnabled(next) }  ← toggle UI
//   · setBiometricLock(bool)         → raw flag setter (no checks)
//   · useBiometricLockState          → { locked } runtime lock (root gate)
//   · lockNow() / unlockNow()        → imperative lock control
//
//  Persisted flag lives in app.store (`biometricLock`). The runtime
//  "locked" bit is NOT persisted: the root layout decides when to lock
//  (cold start + >30s in background) and renders app/(auth)/biometric.tsx
//  as a full-screen overlay until `authenticate()` succeeds.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';

import { useAppStore } from '@/stores/app.store';

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

/** Background time after which the app re-locks (ms). */
export const BIOMETRIC_RELOCK_AFTER_MS = 30_000;

export async function getBiometricState(): Promise<BiometricState> {
  if (!_mod) return { available: false, enrolled: false, kind: 'none' };
  try {
    const hasHardware: boolean = await _mod.hasHardwareAsync();
    const enrolled: boolean = hasHardware ? await _mod.isEnrolledAsync() : false;
    let kind: BiometricKind = hasHardware ? 'generic' : 'none';
    if (hasHardware) {
      const types: number[] = await _mod.supportedAuthenticationTypesAsync();
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
  const es = useAppStore.getState().language !== 'en';
  try {
    const res = await _mod.authenticateAsync({
      promptMessage: reason,
      cancelLabel: es ? 'Cancelar' : 'Cancel',
      fallbackLabel: es ? 'Usar código del dispositivo' : 'Use device passcode',
      // Allow the device passcode as fallback — this is an app-lock, the
      // user is already signed in; we only need proof of device ownership.
      disableDeviceFallback: false,
    });
    return !!res?.success;
  } catch {
    return false;
  }
}

// ── Runtime lock state (not persisted) ──────────────────────────────────
interface LockState {
  locked: boolean;
  setLocked: (locked: boolean) => void;
}

export const useBiometricLockState = create<LockState>((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}));

export function lockNow(): void {
  useBiometricLockState.getState().setLocked(true);
}

export function unlockNow(): void {
  useBiometricLockState.getState().setLocked(false);
}

/** Raw flag setter — prefer `useBiometricLock().setEnabled` from UI. */
export function setBiometricLock(enabled: boolean): void {
  useAppStore.getState().setBiometricLock(enabled);
  if (!enabled) unlockNow();
}

/**
 * Called by the root gate before locking. If biometrics are no longer
 * usable (hardware gone, enrollment removed) the feature silently turns
 * itself off instead of trapping the user behind a prompt that can't
 * succeed. Returns true when the lock should be shown.
 */
export async function shouldLock(): Promise<boolean> {
  if (!useAppStore.getState().biometricLock) return false;
  const state = await getBiometricState();
  if (!state.available || !state.enrolled) {
    setBiometricLock(false);
    return false;
  }
  return true;
}

// ── Hook for the settings toggle ────────────────────────────────────────
export interface UseBiometricLock {
  /** Persisted user preference. */
  enabled: boolean;
  /** False until the hardware probe resolves. */
  ready: boolean;
  available: boolean;
  enrolled: boolean;
  kind: BiometricKind;
  /**
   * Enable / disable the lock. Enabling verifies hardware + enrollment and
   * asks for a biometric confirmation first. Resolves `true` when the
   * preference was changed, `false` when it was refused / cancelled.
   */
  setEnabled: (next: boolean, reason?: string) => Promise<boolean>;
}

export function useBiometricLock(): UseBiometricLock {
  const enabled = useAppStore((s) => s.biometricLock);
  const [state, setState] = useState<BiometricState | null>(null);

  useEffect(() => {
    let alive = true;
    getBiometricState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setEnabled = useCallback(async (next: boolean, reason?: string) => {
    if (!next) {
      setBiometricLock(false);
      return true;
    }
    const s = await getBiometricState();
    setState(s);
    if (!s.available || !s.enrolled) return false;
    const es = useAppStore.getState().language !== 'en';
    const ok = await authenticate(
      reason ?? (es ? 'Confirma tu identidad para activar el bloqueo' : 'Confirm your identity to enable the lock'),
    );
    if (!ok) return false;
    setBiometricLock(true);
    return true;
  }, []);

  return {
    enabled,
    ready: state !== null,
    available: state?.available ?? false,
    enrolled: state?.enrolled ?? false,
    kind: state?.kind ?? 'none',
    setEnabled,
  };
}
