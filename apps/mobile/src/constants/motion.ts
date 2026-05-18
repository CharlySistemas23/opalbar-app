// ─────────────────────────────────────────────
//  OPALBAR Motion Spec — Mobile · Editorial Premium
//
//  Single source of truth for animation timing, easings, springs, and
//  named motion presets. Direction A — Editorial Premium dictates:
//
//    · Slow, deliberate, never bouncy.
//    · Movement supports content; it never decorates it.
//    · Fade + rise 8px is the default. Scale and rebound are reserved for
//      explicit touch feedback (buttons), not for layout changes.
//    · Lists enter with subtle stagger (~70ms per item).
//    · NEVER auto-play decorative motion. Respect reduce-motion.
//
//  Implementation notes:
//    · `Durations`/`Easings` are plain numbers/cubic-bezier strings for use
//      with `Animated.timing` / Reanimated `withTiming`.
//    · `Springs` are Reanimated v3 config objects.
//    · `usePresets()` (companion hook, to be added in primitives phase)
//      will respect `useReducedMotion()` and collapse durations to 1ms
//      while keeping opacity transitions intact.
// ─────────────────────────────────────────────

import { Easing as RNEasing } from 'react-native';

// ── Durations (ms) ───────────────────────────
export const Durations = {
  micro: 120,   // tap feedback, color flips
  fast: 240,    // state changes (focus, toggle, select)
  normal: 380,  // standard transitions
  slow: 520,    // screen/hero entrances
  hero: 640,    // big reveals (only sparingly)
  shimmer: 1400,// skeleton loops
} as const;

// ── Easings ──────────────────────────────────
//
// Editorial Premium prefers landing-soft curves. `outQuint` is the default
// for content arriving on screen; `outExpo` for very large/heavy enters.
// `inOut` for symmetric transitions (modals open/close).
//
// Use the React Native `Easing.bezier(...)` form so the same curves work
// with both RN Animated and Reanimated.
export const Easings = {
  outQuint: RNEasing.bezier(0.22, 1, 0.36, 1),
  outExpo: RNEasing.bezier(0.16, 1, 0.30, 1),
  outCubic: RNEasing.bezier(0.33, 1, 0.68, 1),
  inOut: RNEasing.bezier(0.40, 0, 0.20, 1),
  linear: RNEasing.linear,
} as const;

// Cubic-bezier strings (for Reanimated `withTiming` easing OR docs).
export const EasingCurves = {
  outQuint: 'cubic-bezier(0.22, 1, 0.36, 1)',
  outExpo: 'cubic-bezier(0.16, 1, 0.30, 1)',
  outCubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
  inOut: 'cubic-bezier(0.40, 0, 0.20, 1)',
} as const;

// ── Springs ──────────────────────────────────
//
// Reserved for: press feedback (buttons), modal/sheet snap, drag release.
// NOT for: layout transitions, list inserts, text changes.
export const Springs = {
  // Default press feedback — quick, no overshoot.
  press: {
    damping: 22,
    mass: 1,
    stiffness: 280,
    overshootClamping: true,
  },
  // Settle to rest — slight softness, no visible rebound.
  settle: {
    damping: 20,
    mass: 1,
    stiffness: 220,
    overshootClamping: true,
  },
  // Sheet/modal snap — soft landing, no overshoot.
  sheet: {
    damping: 24,
    mass: 1.1,
    stiffness: 240,
    overshootClamping: true,
  },
} as const;

// ── Press feedback ───────────────────────────
export const Press = {
  scale: 0.97,      // <Pressy> default
  opacity: 0.85,    // alt fallback when scale isn't appropriate
  hapticOnPress: 'selection' as const, // Expo Haptics ImpactFeedbackStyle
} as const;

// ── Named motion presets ─────────────────────
//
// Use these names in components instead of hand-rolling timings:
//   const offset = useFadeRise({ delay: index * Stagger.list });
//
// Documented here so the system stays consistent across screens. Actual
// hooks live in `src/animations/` (to be added in primitives phase).
export const Motion = {
  // Default content enter — opacity 0→1 + translateY 8→0
  fadeRise: {
    duration: Durations.normal,
    easing: Easings.outQuint,
    distance: 8,
  },
  // Subtle attention fade — opacity only, no motion
  fadeOnly: {
    duration: Durations.fast,
    easing: Easings.outCubic,
  },
  // Hero block entrance — larger distance, slower
  heroReveal: {
    duration: Durations.slow,
    easing: Easings.outExpo,
    distance: 12,
  },
  // Stat/number count-up — opacity only, normal duration
  numberReveal: {
    duration: Durations.normal,
    easing: Easings.outCubic,
  },
  // List item stagger base; multiply by index
  staggerStep: 70,
  // Max stagger items (cap so the 30th item doesn't wait 2.1s)
  staggerMax: 8,
} as const;

// ── Reduce-motion fallback ───────────────────
//
// When the user has Reduce Motion enabled in OS settings, motion presets
// collapse to instant or near-instant fades. The companion hook
// `useReducedMotion()` reads `AccessibilityInfo.isReduceMotionEnabled()`
// and short-circuits to these values.
export const ReducedMotion = {
  duration: 1,
  distance: 0,
} as const;

// ── Helpers ──────────────────────────────────
export const motion = {
  Durations,
  Easings,
  EasingCurves,
  Springs,
  Press,
  Motion,
  ReducedMotion,
};

export default motion;
