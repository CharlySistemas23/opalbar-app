// ─────────────────────────────────────────────
//  Confetti — celebratory burst (no Lottie dependency)
//   · 30 lightweight squares fall + rotate + fade
//   · Trigger by toggling `visible` true; auto-hides after duration
//   · Colors picked from amber / champagne / accent palette
//
//  Usage:
//    const [party, setParty] = useState(false);
//    <Confetti visible={party} onDone={() => setParty(false)} />
// ─────────────────────────────────────────────
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/tokens';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const PIECE_COUNT = 32;
const PALETTE = [
  Colors.accentPrimary,
  Colors.accentPrimaryLight,
  Colors.accentChampagne,
  Colors.accentSuccess,
  '#FFFFFF',
];

interface Piece {
  id: number;
  startX: number;
  endX: number;
  delay: number;
  duration: number;
  rotateEnd: number;
  size: number;
  color: string;
}

interface ConfettiProps {
  visible: boolean;
  duration?: number;
  onDone?: () => void;
}

export function Confetti({ visible, duration = 1800, onDone }: ConfettiProps) {
  const pieces = useMemo<Piece[]>(() => {
    return Array.from({ length: PIECE_COUNT }).map((_, i) => ({
      id: i,
      startX: Math.random() * SCREEN_W,
      endX: Math.random() * SCREEN_W,
      delay: Math.random() * 220,
      duration: duration - 200 + Math.random() * 400,
      rotateEnd: (Math.random() - 0.5) * 720,
      size: 6 + Math.random() * 6,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [duration]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Piece
          key={p.id}
          piece={p}
          onLast={i === pieces.length - 1 ? onDone : undefined}
        />
      ))}
    </View>
  );
}

function Piece({ piece, onLast }: { piece: Piece; onLast?: () => void }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(
      1,
      { duration: piece.duration + piece.delay, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished && onLast) runOnJS(onLast)();
      },
    );
  }, [t, piece.duration, piece.delay, onLast]);

  const style = useAnimatedStyle(() => {
    const progress = Math.max(0, (t.value * (piece.duration + piece.delay) - piece.delay) / piece.duration);
    const translateY = interpolate(progress, [0, 1], [-40, SCREEN_H + 40]);
    const translateX = interpolate(progress, [0, 1], [piece.startX, piece.endX]);
    const rotate = interpolate(progress, [0, 1], [0, piece.rotateEnd]);
    const opacity = interpolate(progress, [0, 0.05, 0.85, 1], [0, 1, 1, 0]);
    return {
      opacity,
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: piece.size,
          height: piece.size * 0.5,
          backgroundColor: piece.color,
          borderRadius: 1,
        },
        style,
      ]}
    />
  );
}
