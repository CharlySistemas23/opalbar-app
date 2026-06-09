// ─────────────────────────────────────────────
//  Ambient engine — looping background atmosphere
//
//  A React-free singleton that owns ONE looping ambience track at a time and
//  crossfades between scenes as the user moves through the app. Designed to be
//  driven imperatively from <AmbientBridge> (route → scene) and ducked by
//  useFeedback whenever a one-shot SFX plays.
//
//  Behaviour:
//   · crossfadeTo(scene) — fade the current bed down while the new one rises.
//   · duck()/unduck()    — momentarily dip the bed under SFX (ref-counted).
//   · pause()/resume()   — for AppState background/foreground.
//   · setEnabled(false)  — global kill switch (mirrors soundsEnabled).
//
//  Everything is best-effort: missing assets, web autoplay blocks, and native
//  load failures degrade to silence, never a crash.
// ─────────────────────────────────────────────
import { Platform } from 'react-native';
import type { AmbientScene } from './sceneMap';

type AudioModule = typeof import('expo-av');

let _audio: AudioModule | null = null;
let _audioModeConfigured = false;

function loadAudio(): AudioModule | null {
  if (_audio) return _audio;
  if (Platform.OS === 'web') {
    // expo-av exists on web but ambient autoplay is blocked until a gesture;
    // attempt anyway — failures are swallowed downstream.
  }
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
    await audio.Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });
  } catch {
    // non-fatal
  }
}

// Scene → looping asset.
const AMBIENT_ASSETS: Record<AmbientScene, any> = {
  lounge: require('../../assets/sounds/ambient/ambient_lounge.m4a'),
  night: require('../../assets/sounds/ambient/ambient_night.m4a'),
};

// Base volume the active bed rests at. Deliberately low — ambience should sit
// beneath the UI, never compete with it.
const BASE_VOLUME = 0.18;
// Multiplier applied while ducked (SFX playing on top).
const DUCK_FACTOR = 0.4;

const FADE_STEPS = 20;

type LoadedSound = {
  scene: AmbientScene;
  sound: any; // expo-av Audio.Sound
  vol: number; // last volume we applied (avoids an async getStatus read)
};

let _current: LoadedSound | null = null;
let _enabled = true;
let _paused = false;
let _duckCount = 0;
let _desiredScene: AmbientScene | null = null;
// Monotonic token so a newer crossfade cancels stale fade loops.
let _generation = 0;
let _fadeTimer: ReturnType<typeof setInterval> | null = null;

/** Volume the current bed should rest at right now, given duck state. */
function restingVolume(): number {
  return _duckCount > 0 ? BASE_VOLUME * DUCK_FACTOR : BASE_VOLUME;
}

function clearFadeTimer() {
  if (_fadeTimer) {
    clearInterval(_fadeTimer);
    _fadeTimer = null;
  }
}

/**
 * Ramp `sound` volume from `from` to `to` over `durationMs`. Returns a promise
 * that resolves when done. Tied to `gen`: if the global generation advances,
 * the ramp aborts so a newer transition wins.
 */
function fade(
  bed: LoadedSound,
  to: number,
  durationMs: number,
  gen: number,
): Promise<void> {
  return new Promise((resolve) => {
    const from = bed.vol;
    let step = 0;
    const stepMs = Math.max(16, durationMs / FADE_STEPS);
    const timer = setInterval(() => {
      if (gen !== _generation) {
        clearInterval(timer);
        resolve();
        return;
      }
      step += 1;
      const v = Math.max(0, Math.min(1, from + (to - from) * (step / FADE_STEPS)));
      bed.vol = v;
      bed.sound.setVolumeAsync?.(v).catch(() => {});
      if (step >= FADE_STEPS) {
        clearInterval(timer);
        resolve();
      }
    }, stepMs);
  });
}

async function loadAndPlay(scene: AmbientScene): Promise<LoadedSound | null> {
  const audio = loadAudio();
  if (!audio) return null;
  await ensureAudioMode(audio);
  try {
    const { sound } = await audio.Audio.Sound.createAsync(AMBIENT_ASSETS[scene], {
      shouldPlay: true,
      isLooping: true,
      volume: 0,
    });
    return { scene, sound, vol: 0 };
  } catch {
    return null;
  }
}

async function unload(target: LoadedSound | null) {
  if (!target) return;
  try {
    await target.sound.stopAsync?.();
  } catch {
    // ignore
  }
  try {
    await target.sound.unloadAsync?.();
  } catch {
    // ignore
  }
}

/**
 * Transition the ambience to `scene` (or silence with `null`). Crossfades the
 * outgoing bed out while the incoming bed rises to its resting volume.
 */
export async function crossfadeTo(scene: AmbientScene | null): Promise<void> {
  _desiredScene = scene;

  if (!_enabled || _paused) {
    // Remember intent; the bridge re-applies once re-enabled/resumed.
    return;
  }

  // Already on the right bed — just settle its volume (e.g. after un-duck).
  if (scene && _current?.scene === scene) {
    void settleVolume();
    return;
  }

  const gen = ++_generation;
  clearFadeTimer();

  const outgoing = _current;

  if (!scene) {
    // Fade to silence.
    if (outgoing) {
      await fade(outgoing, 0, 520, gen);
      if (gen === _generation) {
        await unload(outgoing);
        _current = null;
      }
    }
    return;
  }

  const incoming = await loadAndPlay(scene);
  if (gen !== _generation) {
    // A newer transition started while we were loading — discard this one.
    await unload(incoming);
    return;
  }
  if (!incoming) return;

  _current = incoming;

  await Promise.all([
    fade(incoming, restingVolume(), 620, gen),
    outgoing ? fade(outgoing, 0, 480, gen) : Promise.resolve(),
  ]);

  if (gen === _generation) {
    await unload(outgoing);
  }
}

/** Re-ramp the current bed to its correct resting volume (after duck change). */
async function settleVolume(): Promise<void> {
  if (!_current || !_enabled || _paused) return;
  const gen = ++_generation;
  await fade(_current, restingVolume(), 160, gen);
}

/** Momentarily dip the bed under a one-shot SFX. Ref-counted. */
export function duck(): void {
  _duckCount += 1;
  if (_duckCount === 1) void settleVolume();
}

/** Release one duck. When the count hits zero the bed returns to base volume. */
export function unduck(): void {
  _duckCount = Math.max(0, _duckCount - 1);
  if (_duckCount === 0) void settleVolume();
}

/** Pause the bed (AppState → background). Keeps it loaded for fast resume. */
export async function pause(): Promise<void> {
  _paused = true;
  clearFadeTimer();
  _generation += 1;
  if (_current) {
    try {
      await _current.sound.pauseAsync?.();
    } catch {
      // ignore
    }
  }
}

/** Resume after returning to foreground; re-applies the desired scene. */
export async function resume(): Promise<void> {
  if (!_paused) return;
  _paused = false;
  if (!_enabled) return;
  if (_current && _current.scene === _desiredScene) {
    try {
      await _current.sound.playAsync?.();
      _current.vol = restingVolume();
      await _current.sound.setVolumeAsync?.(restingVolume());
    } catch {
      // ignore
    }
  } else {
    await crossfadeTo(_desiredScene);
  }
}

/** Global on/off — mirrors the user's soundsEnabled preference. */
export async function setEnabled(enabled: boolean): Promise<void> {
  if (_enabled === enabled) return;
  _enabled = enabled;
  if (!enabled) {
    clearFadeTimer();
    _generation += 1;
    const target = _current;
    _current = null;
    await unload(target);
  } else {
    await crossfadeTo(_desiredScene);
  }
}

export const ambient = {
  crossfadeTo,
  duck,
  unduck,
  pause,
  resume,
  setEnabled,
};
