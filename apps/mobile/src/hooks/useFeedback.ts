// ─────────────────────────────────────────────
//  useFeedback — unified haptic + sound feedback
//  Respects global toggles in useAppStore (hapticsEnabled, soundsEnabled).
//  Works on iOS + Android; degrades to no-op on web.
//
//  Usage:
//    const fb = useFeedback();
//    fb.tap();              // light tap on button press
//    fb.select();           // selection change (toggle, picker)
//    fb.success();          // reservation/canje confirmed
//    fb.error();            // request failed
//    fb.like();              // heart toggle
//    fb.send();             // message/comment sent
//    fb.notification();     // toast / incoming push
//
//  Sound files should live at apps/mobile/assets/sounds/<name>.mp3.
//  If a sound file is missing, only the haptic plays — no crash.
// ─────────────────────────────────────────────
import { Platform } from 'react-native';
import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/app.store';

// Lazy imports so web builds don't choke if native-only
type HapticsModule = typeof import('expo-haptics');
type AudioModule = typeof import('expo-av');

let _haptics: HapticsModule | null = null;
let _audio: AudioModule | null = null;
let _audioModeConfigured = false;

function loadHaptics(): HapticsModule | null {
  if (_haptics) return _haptics;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _haptics = require('expo-haptics');
    return _haptics;
  } catch {
    return null;
  }
}

function loadAudio(): AudioModule | null {
  if (_audio) return _audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _audio = require('expo-av');
    return _audio;
  } catch {
    return null;
  }
}

async function ensureAudioMode(audio: AudioModule) {
  if (_audioModeConfigured) return;
  _audioModeConfigured = true;
  try {
    // playsInSilentModeIOS: iOS silent switch otherwise kills UI sounds.
    // shouldDuckAndroid: lower other app audio briefly while our SFX plays.
    await audio.Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });
  } catch {
    // non-fatal — sounds still play on Android even if mode set fails
  }
}

// Sound asset registry. The key is the semantic event fired from useFeedback.
const SOUND_ASSETS: Record<string, any> = {
  pop: require('../../assets/sounds/POP.wav'),
  bubble: require('../../assets/sounds/BUBBLE.wav'),
  success: require('../../assets/sounds/SUCESS.wav'),
  coin: require('../../assets/sounds/COINT.wav'),
  error: require('../../assets/sounds/CANCEL.wav'),
  chime: require('../../assets/sounds/CHIME.wav'),
  notification: require('../../assets/sounds/NOTIFICATION.wav'),
  // UI micro-sounds (synthesised, very short)
  tick: require('../../assets/sounds/TICK.wav'),
  toggle: require('../../assets/sounds/TOGGLE.wav'),
  whoosh: require('../../assets/sounds/WHOOSH.wav'),
  swoosh: require('../../assets/sounds/SWOOSH.wav'),
};

// Per-sound playback volume. UI micro-sounds sit low so they texture the app
// without fatiguing; confirmations (success/coin/error) play full.
const SOUND_VOLUME: Record<string, number> = {
  tick: 0.28,
  toggle: 0.3,
  whoosh: 0.45,
  swoosh: 0.45,
  pop: 0.6,
  bubble: 0.55,
  notification: 0.6,
  chime: 0.55,
  error: 0.7,
  success: 0.8,
  coin: 0.8,
};

// Cache loaded Sound instances so we don't re-parse the file each call
const _soundCache = new Map<string, any>();

async function playSound(name: string) {
  const asset = SOUND_ASSETS[name];
  if (!asset) return; // no file wired for this event — haptic still fires
  const audio = loadAudio();
  if (!audio) return;

  await ensureAudioMode(audio);

  const vol = SOUND_VOLUME[name] ?? 1.0;

  try {
    let sound = _soundCache.get(name);
    if (!sound) {
      const { sound: s } = await audio.Audio.Sound.createAsync(asset, {
        shouldPlay: false,
        volume: vol,
      });
      sound = s;
      _soundCache.set(name, sound);
    } else {
      await sound.setVolumeAsync?.(vol);
    }
    // replayAsync rewinds + plays in a single call. More reliable than
    // setPositionAsync(0) + playAsync() which on Android sometimes no-ops
    // when the sound had already finished (only the first play worked).
    await sound.replayAsync();
  } catch {
    // swallow — sound is best-effort, never block UI
  }
}

/**
 * Imperative one-shot for non-React call sites (e.g. the Toast host). Respects
 * the global soundsEnabled toggle. No haptic — pair with useFeedback in
 * components that can.
 */
export function playUiSound(name: string) {
  if (!useAppStore.getState().soundsEnabled) return;
  void playSound(name);
}

type HapticKind = 'light' | 'medium' | 'heavy' | 'select' | 'success' | 'warning' | 'error';

function triggerHaptic(kind: HapticKind) {
  const H = loadHaptics();
  if (!H) return;
  try {
    switch (kind) {
      case 'light':
        return H.impactAsync(H.ImpactFeedbackStyle.Light);
      case 'medium':
        return H.impactAsync(H.ImpactFeedbackStyle.Medium);
      case 'heavy':
        return H.impactAsync(H.ImpactFeedbackStyle.Heavy);
      case 'select':
        return H.selectionAsync();
      case 'success':
        return H.notificationAsync(H.NotificationFeedbackType.Success);
      case 'warning':
        return H.notificationAsync(H.NotificationFeedbackType.Warning);
      case 'error':
        return H.notificationAsync(H.NotificationFeedbackType.Error);
    }
  } catch {
    // no-op
  }
}

export function useFeedback() {
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const soundsEnabled = useAppStore((s) => s.soundsEnabled);
  const hapticsRef = useRef(hapticsEnabled);
  const soundsRef = useRef(soundsEnabled);
  useEffect(() => { hapticsRef.current = hapticsEnabled; }, [hapticsEnabled]);
  useEffect(() => { soundsRef.current = soundsEnabled; }, [soundsEnabled]);

  const fire = useCallback((haptic: HapticKind | null, sound: string | null) => {
    if (haptic && hapticsRef.current) triggerHaptic(haptic);
    if (sound && soundsRef.current) void playSound(sound);
  }, []);

  return {
    /** Light tap — generic button press. */
    tap: useCallback(() => fire('light', null), [fire]),
    /** Selection — toggle, picker, tab change. */
    select: useCallback(() => fire('select', null), [fire]),
    /** Success — reservation/canje confirmed. */
    success: useCallback(() => fire('success', 'success'), [fire]),
    /** Error — request failed, validation. */
    error: useCallback(() => fire('error', 'error'), [fire]),
    /** Warning — dangerous action. */
    warning: useCallback(() => fire('warning', null), [fire]),
    /** Like/heart toggle. */
    like: useCallback(() => fire('light', 'pop'), [fire]),
    /** Message/comment sent. */
    send: useCallback(() => fire('light', 'bubble'), [fire]),
    /** Canje exitoso. */
    coin: useCallback(() => fire('success', 'coin'), [fire]),
    /** Notificación/toast. */
    notification: useCallback(() => fire('light', 'notification'), [fire]),
    /** Logout/close. */
    logout: useCallback(() => fire('medium', 'chime'), [fire]),
    /** Destructive action (delete, cancel). */
    destructive: useCallback(() => fire('heavy', null), [fire]),
    /** Navegación — tab change, abrir detalle, push de ruta. */
    nav: useCallback(() => fire('light', 'tick'), [fire]),
    /** Apertura de sheet / modal. */
    open: useCallback(() => fire('light', 'whoosh'), [fire]),
    /** Switch on/off. */
    toggle: useCallback((_on?: boolean) => fire('select', 'toggle'), [fire]),
    /** Pull-to-refresh disparado. */
    refresh: useCallback(() => fire('light', 'swoosh'), [fire]),
  };
}
