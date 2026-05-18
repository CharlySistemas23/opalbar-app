// ─────────────────────────────────────────────
//  FadeIn — Editorial Premium content enter
//
//  Wraps anything with the default content-enter motion:
//  opacity 0 → 1 + translateY (distance) → 0, eased with outQuint.
//
//  Editorial: no scale, no rebound, no X translate. Movement supports
//  content, never decorates it. Use `delay` for stagger inside lists
//  (or use useStaggerItem(index) directly for that case).
//
//  Honors OS Reduce Motion (collapses to a 1ms opacity fade).
// ─────────────────────────────────────────────
import React from 'react';
import Animated from 'react-native-reanimated';
import { StyleProp, ViewStyle } from 'react-native';

import { useFadeRise } from '@/animations';

interface FadeInProps {
  children: React.ReactNode;
  /** Delay before animation starts (ms). Stagger lists with index * 70. */
  delay?: number;
  /** Total duration (ms). Default uses Motion.fadeRise.duration (380). */
  duration?: number;
  /** Starting Y offset (px). Default 8 (Motion.fadeRise.distance). */
  distance?: number;
  /** When false, renders fully visible without animating. */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** @deprecated Use `distance` instead. Kept for backward compatibility. */
  from?: number;
  /** @deprecated Editorial Premium never uses horizontal slides. Ignored. */
  fromX?: number;
  /** @deprecated Use the new motion system; this prop is ignored. */
  initialScale?: number;
}

export function FadeIn({
  children,
  delay = 0,
  duration,
  distance,
  from,
  enabled = true,
  style,
}: FadeInProps) {
  // Backward-compat: `from` was the old name for `distance`. Prefer the new
  // explicit prop; fall back to the legacy one if only that is provided.
  const resolvedDistance = distance ?? from;
  const animatedStyle = useFadeRise({ delay, duration, distance: resolvedDistance, enabled });
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
