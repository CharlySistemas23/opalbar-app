// ─────────────────────────────────────────────
//  FadeIn — wraps anything with a fade+slide-up mount animation
//   · Great for list items (stagger via `delay`)
//   · Great for screen content blocks
//   · Uses native driver for smoothness
// ─────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle, StyleProp } from 'react-native';

interface FadeInProps {
  children: React.ReactNode;
  /** Delay before animation starts (ms). Stagger lists with index * 50. */
  delay?: number;
  /** Total duration (ms). Default 360. */
  duration?: number;
  /** Starting Y offset (px). Default 16. */
  from?: number;
  /** Starting X offset (px). 0 means pure fade+vertical. */
  fromX?: number;
  /** Apply a scale-in instead of slide (1 = none). */
  initialScale?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 360,
  from = 16,
  fromX = 0,
  initialScale = 1,
  style,
}: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(from)).current;
  const translateX = useRef(new Animated.Value(fromX)).current;
  const scale = useRef(new Animated.Value(initialScale)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
