// ─────────────────────────────────────────────
//  Pressy — Pressable with built-in polish:
//   · Subtle scale-down on press (spring back on release)
//   · Optional haptic on press
//   · Disabled state handled gracefully
//
//  Drop-in replacement for <Pressable>. Same props, better feel.
// ─────────────────────────────────────────────
import React, { useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useFeedback } from '@/hooks/useFeedback';

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

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
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
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
