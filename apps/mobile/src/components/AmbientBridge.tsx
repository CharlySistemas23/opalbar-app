// ─────────────────────────────────────────────
//  AmbientBridge — drives the ambient engine from app state
//
//  Non-visual bridge (mirrors PushGuard / RealtimeBridge). Watches the active
//  route and the soundsEnabled preference, and pauses/resumes the ambience as
//  the app moves between foreground and background.
//
//  All ambient playback is gated by the SAME `soundsEnabled` toggle that gates
//  SFX — no new preference, no new screen.
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useSegments } from 'expo-router';

import { useAppStore } from '@/stores/app.store';
import { ambient } from '@/audio/ambient';
import { sceneForSegments } from '@/audio/sceneMap';

export function AmbientBridge() {
  const segments = useSegments() as unknown as string[];
  const soundsEnabled = useAppStore((s) => s.soundsEnabled);

  // Toggle the global kill switch when the preference flips.
  useEffect(() => {
    void ambient.setEnabled(soundsEnabled);
  }, [soundsEnabled]);

  // Map the current route to a scene and crossfade.
  useEffect(() => {
    if (Platform.OS === 'web') return; // browser autoplay policy — skip ambience
    const scene = sceneForSegments(segments);
    void ambient.crossfadeTo(scene);
  }, [segments]);

  // Pause on background, resume on foreground.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ambient.resume();
      } else {
        void ambient.pause();
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}
