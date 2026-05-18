// ─────────────────────────────────────────────
//  VoiceBubble — voice-note playback row
//
//  Tap to play / pause. Animated waveform progress derived deterministically
//  from the audio URL (same shape every render). Editorial colors: amber on
//  the receiver, ink on the sender side.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants/tokens';
import { Caption } from '@/components/ui';

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

export function VoiceBubble({ url, durationSec, isMe }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const bars = useMemo(() => waveformFor(url), [url]);

  const cleanup = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try { s.setOnPlaybackStatusUpdate(null as any); } catch {}
      try { await s.unloadAsync(); } catch {}
    }
  }, []);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const toggle = useCallback(async () => {
    try {
      if (soundRef.current) {
        const status: any = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else if (status.isLoaded) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }
      setLoading(true);
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        } as any);
      } catch {}
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, isLooping: false, volume: 1.0 },
      );
      soundRef.current = sound;
      setLoading(false);
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status?.isLoaded) return;
        if (status.durationMillis) {
          setProgress(Math.min(1, status.positionMillis / status.durationMillis));
        }
        if (status.didJustFinish) {
          setIsPlaying(false);
          setProgress(0);
          cleanup();
        }
      });
    } catch {
      setLoading(false);
    }
  }, [url, cleanup]);

  const fillColor = isMe ? 'rgba(15,13,12,0.85)' : Colors.accentPrimary;
  const dimColor = isMe ? 'rgba(15,13,12,0.28)' : Colors.borderStrong;
  const iconBg = isMe ? 'rgba(15,13,12,0.10)' : Colors.accentPrimary;
  const iconColor = isMe ? Colors.textInverse : Colors.textInverse;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        style={[styles.play, { backgroundColor: iconBg }]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isMe ? Colors.textInverse : Colors.textInverse} />
        ) : (
          <Feather name={isPlaying ? 'pause' : 'play'} size={14} color={iconColor} />
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
