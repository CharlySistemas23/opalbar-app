// ─────────────────────────────────────────────
//  Pressy — Pressable with built-in polish:
//   · Subtle scale-down on press (spring back on release)
//   · Optional haptic on press
//   · Disabled state handled gracefully
//
//  Drop-in replacement for <Pressable>. Same props, better feel.
// ─────────────────────────────────────────────
import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useFeedback } from '@/hooks/useFeedback';

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

interface PressyProps extends PressableProps {
  haptic?: HapticKind;
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children?: React.ReactNode;
}

export function Pressy({
  haptic = 'tap',
  scaleTo = 0.96,
  style,
  onPress,
  disabled,
  children,
  ...rest
}: PressyProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const fb = useFeedback();

  const animateTo = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      tension: 180,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  function fireHaptic() {
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

  return (
    <Animated.View
      style={[split?.outer, { transform: [{ scale }] }]}
    >
      <Pressable
        {...rest}
        disabled={disabled}
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
