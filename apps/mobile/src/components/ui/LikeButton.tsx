// ─────────────────────────────────────────────
//  LikeButton — premium like/heart with explode microinteraction
//   · Heart pop + scale on activation
//   · Radial particle burst (6 particles fan out + fade)
//   · Soft ring pulse (Twitter/Instagram-style)
//   · Haptic on toggle, sound on like
//   · Drop-in for posts/comments/messages
// ─────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/tokens';
import { Pressy } from './Pressy';
import { useFeedback } from '@/hooks/useFeedback';

interface LikeButtonProps {
  liked: boolean;
  count?: number;
  size?: number;
  /** Active color (default amber) */
  color?: string;
  /** Inactive color (default muted) */
  inactiveColor?: string;
  showCount?: boolean;
  onToggle: (next: boolean) => void;
  hitSlop?: number;
}

const PARTICLE_COUNT = 6;
const PARTICLE_DISTANCE = 22;

export function LikeButton({
  liked,
  count,
  size = 22,
  color = Colors.accentPrimary,
  inactiveColor = Colors.textMuted,
  showCount = true,
  onToggle,
  hitSlop = 8,
}: LikeButtonProps) {
  const fb = useFeedback();
  const heart = useSharedValue(liked ? 1 : 0);
  const burst = useSharedValue(0);
  const ring = useSharedValue(0);

  // Sync heart value if liked changes from outside
  useEffect(() => {
    heart.value = withSpring(liked ? 1 : 0, { damping: 9, stiffness: 280 });
  }, [liked, heart]);

  const handlePress = () => {
    const next = !liked;
    if (next) {
      // Like → explode
      burst.value = 0;
      ring.value = 0;
      burst.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
      ring.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) });
      heart.value = withSequence(
        withTiming(1.35, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 7, stiffness: 260 }),
      );
      fb.like();
    } else {
      heart.value = withSpring(0, { damping: 12, stiffness: 220 });
      fb.tap();
    }
    onToggle(next);
  };

  const heartStyle = useAnimatedStyle(() => {
    const scale = interpolate(heart.value, [0, 1, 1.35], [1, 1.08, 1.35]);
    return { transform: [{ scale }] };
  });

  const ringStyle = useAnimatedStyle(() => {
    const scale = interpolate(ring.value, [0, 1], [0.3, 2.2]);
    const opacity = interpolate(ring.value, [0, 0.4, 1], [0.6, 0.35, 0]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Pressy
      haptic="none"
      scaleTo={0.88}
      onPress={handlePress}
      hitSlop={hitSlop}
      style={styles.container}
    >
      <View style={[styles.iconWrap, { width: size + 16, height: size + 16 }]}>
        {/* Soft pulse ring (only on like) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size + 4,
              height: size + 4,
              borderRadius: (size + 4) / 2,
              borderColor: color,
            },
            ringStyle,
          ]}
        />
        {/* Burst particles */}
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <Particle key={i} index={i} progress={burst} color={color} />
        ))}
        {/* Heart icon — Ionicons gives us a real filled variant when liked. */}
        <Animated.View style={heartStyle}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={size + 2}
            color={liked ? color : inactiveColor}
          />
        </Animated.View>
      </View>
      {showCount && typeof count === 'number' && count > 0 && (
        <Text style={[styles.count, { color: liked ? color : inactiveColor }]}>{count}</Text>
      )}
    </Pressy>
  );
}

interface ParticleProps {
  index: number;
  progress: SharedValue<number>;
  color: string;
}

function Particle({ index, progress, color }: ParticleProps) {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
  const dx = Math.cos(angle) * PARTICLE_DISTANCE;
  const dy = Math.sin(angle) * PARTICLE_DISTANCE;

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const translateX = interpolate(t, [0, 1], [0, dx]);
    const translateY = interpolate(t, [0, 1], [0, dy]);
    const opacity = interpolate(t, [0, 0.15, 0.7, 1], [0, 1, 1, 0]);
    const scale = interpolate(t, [0, 0.4, 1], [0.4, 1, 0.6]);
    return {
      opacity,
      transform: [{ translateX }, { translateY }, { scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.particle, { backgroundColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  particle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  count: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
