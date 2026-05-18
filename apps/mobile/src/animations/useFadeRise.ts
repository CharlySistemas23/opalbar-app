import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Durations, Motion, ReducedMotion } from '../constants/motion';
import { useReducedMotion } from './useReducedMotion';

type Options = {
  delay?: number;
  distance?: number;
  duration?: number;
  enabled?: boolean;
};

// The default content-enter animation in Editorial Premium:
// opacity 0 → 1 + translateY (distance) → 0, eased with outQuint.
// Use on every screen body block and every list item. When the user has
// Reduce Motion enabled, the rise collapses to 0 and duration to 1ms so
// the element still renders but without any movement.
export function useFadeRise(options: Options = {}) {
  const {
    delay = 0,
    distance = Motion.fadeRise.distance,
    duration = Motion.fadeRise.duration,
    enabled = true,
  } = options;

  const reduced = useReducedMotion();
  const opacity = useSharedValue(enabled ? 0 : 1);
  const translate = useSharedValue(enabled ? distance : 0);

  useEffect(() => {
    if (!enabled) {
      opacity.value = 1;
      translate.value = 0;
      return;
    }

    const ms = reduced ? ReducedMotion.duration : duration;
    const dist = reduced ? ReducedMotion.distance : distance;
    const ease = Easing.bezier(0.22, 1, 0.36, 1);

    translate.value = dist;
    opacity.value = 0;

    opacity.value = withDelay(delay, withTiming(1, { duration: ms, easing: ease }));
    translate.value = withDelay(delay, withTiming(0, { duration: ms, easing: ease }));
  }, [delay, distance, duration, enabled, reduced, opacity, translate]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));
}

// Convenience for hero blocks (larger distance, longer duration).
export function useHeroReveal(delay = 0) {
  return useFadeRise({
    delay,
    distance: 12,
    duration: Durations.slow,
  });
}
