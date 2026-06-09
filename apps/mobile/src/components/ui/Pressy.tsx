// ─────────────────────────────────────────────
//  Pressy — Pressable with Editorial Premium polish
//
//  · Spring scale on press (no overshoot, settles fast)
//  · Optional haptic on press
//  · Disabled handled gracefully (no animation, no haptic)
//  · A11y baseline: defaults to role=button when onPress is set, requires
//    `accessibilityLabel` for non-text children to satisfy the lint
//  · Layout props (flex, width, margin, position) routed to the wrapper
//    so flex:1 still works through the Animated.View
// ─────────────────────────────────────────────
import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';

import { Press } from '@/constants/motion';
import { HitSlop, Roles } from '@/constants/a11y';
import { useFeedback, playUiSound } from '@/hooks/useFeedback';

// Layout props that must live on the OUTER (animated) wrapper so the wrapper
// participates in its parent's layout. If we only pass them to the inner
// Pressable, the wrapper collapses to content width (e.g. tab bar tabs lose
// their flex:1 and labels run together).
const LAYOUT_KEYS = [
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'position', 'top', 'left', 'right', 'bottom',
] as const;

function splitLayoutStyle(style: StyleProp<ViewStyle>): {
  outer: ViewStyle;
  inner: ViewStyle;
} {
  const flat = (StyleSheet.flatten(style) || {}) as ViewStyle & Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = { ...flat };
  for (const k of LAYOUT_KEYS) {
    if (k in flat) {
      outer[k] = flat[k];
      delete inner[k];
    }
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

type HapticKind = 'none' | 'tap' | 'select' | 'success' | 'error' | 'warning' | 'destructive';

interface PressyProps extends Omit<PressableProps, 'style'> {
  haptic?: HapticKind;
  /** Optional one-shot SFX name (see useFeedback SOUND_ASSETS), e.g. 'tick'. */
  sound?: string;
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children?: React.ReactNode;
}

export function Pressy({
  haptic = 'tap',
  sound,
  scaleTo = Press.scale,
  style,
  onPress,
  disabled,
  accessibilityRole,
  accessibilityLabel,
  hitSlop,
  children,
  ...rest
}: PressyProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const fb = useFeedback();

  const animateTo = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      // Match Springs.press (damping 22, stiffness 280) in feel — RN Animated
      // doesn't speak the same params so we tune to the same perceptual rest.
      tension: 240,
      friction: 12,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  };

  function fireHaptic() {
    if (sound) playUiSound(sound);
    if (haptic === 'none') return;
    if (haptic === 'tap') fb.tap();
    else if (haptic === 'select') fb.select();
    else if (haptic === 'success') fb.success();
    else if (haptic === 'error') fb.error();
    else if (haptic === 'warning') fb.warning();
    else if (haptic === 'destructive') fb.destructive();
  }

  // If style is a function (state.pressed), we can't split it — pass through
  // and lose flex behavior. For the static-style case (the common one) we
  // route layout props to the wrapper so flex:1 actually works.
  const isStyleFn = typeof style === 'function';
  const split = useMemo(
    () => (isStyleFn ? null : splitLayoutStyle(style)),
    [isStyleFn, style],
  );

  // Default role to 'button' if the caller has an onPress and didn't say
  // otherwise. Saves screen-reader users from anonymous tap targets.
  const resolvedRole = accessibilityRole ?? (onPress ? Roles.button : undefined);
  const resolvedHitSlop = hitSlop ?? HitSlop.expand;

  return (
    <Animated.View style={[split?.outer, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        disabled={disabled}
        accessibilityRole={resolvedRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled, ...(rest.accessibilityState ?? {}) }}
        hitSlop={resolvedHitSlop}
        onPressIn={(e) => {
          if (!disabled) animateTo(scaleTo);
          rest.onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (!disabled) animateTo(1);
          rest.onPressOut?.(e);
        }}
        onPress={(e) => {
          if (!disabled) fireHaptic();
          onPress?.(e);
        }}
        style={isStyleFn ? (style as PressableProps['style']) : split?.inner}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
