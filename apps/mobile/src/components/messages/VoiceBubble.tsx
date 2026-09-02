// ─────────────────────────────────────────────
//  VoiceBubble — voice-note playback row
//
//  Tap to play / pause. Animated waveform progress derived deterministically
//  from the audio URL (same shape every render). Editorial colors: amber on
//  the receiver, ink on the sender side.
//
//  Single-playback: only one voice note plays at a time app-wide. Starting a
//  bubble stops (and unloads) whichever bubble was playing before, like
//  WhatsApp / iMessage.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants/tokens';
import { Caption } from '@/components/ui';
import { useAppStore } from '@/stores/app.store';

interface Props {
  url: string;
  durationSec?: number | null;
  isMe: boolean;
}

function fmtDuration(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Stable pseudo-waveform — derive bar heights from the URL hash so a given
// voice note always renders the same shape across mounts.
function waveformFor(url: string, bars = 28) {
  const out: number[] = [];
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  for (let i = 0; i < bars; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out.push(0.35 + ((h >>> 8) & 0xff) / 255 * 0.65);
  }
  return out;
}

// ── Module-level "currently playing" registry ────────────────────────────
// Each mounted bubble registers a stop() when it starts playing; starting a
// different bubble calls the previous stop() first. Kept outside React so it
// works across screens (e.g. a bubble left playing on a thread you popped).
let currentStop: (() => Promise<void>) | null = null;
let currentSound: Audio.Sound | null = null;

async function claimPlayback(sound: Audio.Sound, stop: () => Promise<void>) {
  if (currentSound && currentSound !== sound && currentStop) {
    const prev = currentStop;
    currentStop = null;
    currentSound = null;
    try { await prev(); } catch {}
  }
  currentSound = sound;
  currentStop = stop;
}

function releasePlayback(sound: Audio.Sound) {
  if (currentSound === sound) {
    currentSound = null;
    currentStop = null;
  }
}

export function VoiceBubble({ url, durationSec, isMe }: Props) {
  const language = useAppStore((s) => s.language);
  const es = language === 'es';
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const bars = useMemo(() => waveformFor(url), [url]);

  const cleanup = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      releasePlayback(s);
      try { s.setOnPlaybackStatusUpdate(null as any); } catch {}
      try { await s.unloadAsync(); } catch {}
    }
  }, []);

  // Stop used by the registry when another bubble takes over: reset the UI
  // (paused at start) and unload to free the audio session.
  const stopForOther = useCallback(async () => {
    setIsPlaying(false);
    setProgress(0);
    await cleanup();
  }, [cleanup]);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const toggle = useCallback(async () => {
    try {
      if (soundRef.current) {
        const status: any = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else if (status.isLoaded) {
          await claimPlayback(soundRef.current, stopForOther);
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }
      setLoading(true);
      setFailed(false);
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        } as any);
      } catch {}
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false, isLooping: false, volume: 1.0 },
      );
      soundRef.current = sound;
      await claimPlayback(sound, stopForOther);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status?.isLoaded) {
          if (status?.error) {
            setFailed(true);
            setIsPlaying(false);
            setLoading(false);
            cleanup();
          }
          return;
        }
        if (status.durationMillis) {
          setProgress(Math.min(1, status.positionMillis / status.durationMillis));
        }
        if (status.didJustFinish) {
          setIsPlaying(false);
          setProgress(0);
          cleanup();
        }
      });
      await sound.playAsync();
      setLoading(false);
      setIsPlaying(true);
    } catch {
      setLoading(false);
      setFailed(true);
      cleanup();
    }
  }, [url, cleanup, stopForOther]);

  const fillColor = isMe ? 'rgba(15,13,12,0.85)' : Colors.accentPrimary;
  const dimColor = isMe ? 'rgba(15,13,12,0.28)' : Colors.borderStrong;
  const iconBg = isMe ? 'rgba(15,13,12,0.10)' : Colors.accentPrimary;
  const iconColor = Colors.textInverse;

  const a11y = failed
    ? (es ? 'No se pudo reproducir la nota de voz. Toca para reintentar' : 'Could not play voice note. Tap to retry')
    : isPlaying
      ? (es ? 'Pausar nota de voz' : 'Pause voice note')
      : (es ? 'Reproducir nota de voz' : 'Play voice note');

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ busy: loading }}
        style={[styles.play, { backgroundColor: failed ? Colors.accentDanger : iconBg }]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Feather name={failed ? 'alert-circle' : isPlaying ? 'pause' : 'play'} size={14} color={iconColor} />
        )}
      </Pressable>
      <View style={styles.waveform}>
        {bars.map((h, i) => {
          const played = i / bars.length <= progress;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: 4 + h * 18,
                  backgroundColor: played ? fillColor : dimColor,
                  opacity: played ? 1 : 0.6,
                },
              ]}
            />
          );
        })}
      </View>
      <Caption
        size="sm"
        tone={isMe ? 'inverse' : 'muted'}
        style={isMe ? [styles.time, { opacity: 0.7 }] : styles.time}
      >
        {fmtDuration(durationSec ?? 0)}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: 4,
    minWidth: 200,
  },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    gap: 2,
  },
  bar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 1.5,
  },
  time: {
    minWidth: 36,
    textAlign: 'right',
  },
});
