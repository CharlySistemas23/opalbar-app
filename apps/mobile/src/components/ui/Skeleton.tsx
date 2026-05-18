// ─────────────────────────────────────────────
//  Skeleton — Editorial Premium loading placeholder
//
//  Use INSTEAD of <ActivityIndicator> for list / card loading.
//  Spinners signal "indie"; skeletons signal polish.
//
//  Usage:
//    <Skeleton width={120} height={16} />
//    <Skeleton width="60%" height={14} />
//    <SkeletonList count={6} itemHeight={72} />
//    <SkeletonText lines={3} />
//
//  Editorial detail: shimmer is slow (Durations.shimmer = 1400) and the
//  opacity swing is restrained (0.55 → 0.95) so the page doesn't pulse
//  like it's about to take off.
//
//  Reduce-motion: the animation pauses and the skeleton sits at 0.7
//  opacity — still legible as "this is loading" without movement.
// ─────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  ViewStyle,
  StyleProp,
  DimensionValue,
  AccessibilityInfo,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Durations } from '@/constants/motion';
import { useReducedMotion } from '@/animations';
import { Roles } from '@/constants/a11y';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 14, radius = Radius.sm, style }: SkeletonProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      progress.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: Durations.shimmer,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: Durations.shimmer,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduced]);

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.95],
  });

  return (
    <Animated.View
      accessibilityRole={Roles.progressbar}
      accessibilityLabel="Cargando"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: Colors.bgElevated,
          opacity,
        },
        style,
      ]}
    />
  );
}

interface ListProps {
  count?: number;
  itemHeight?: number;
  gap?: number;
  radius?: number;
}

export function SkeletonList({
  count = 6,
  itemHeight = 64,
  gap = Spacing[3],
  radius = Radius.card,
}: ListProps) {
  // Announce loading once on mount for screen readers.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Cargando contenido');
  }, []);

  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={itemHeight} radius={radius} />
      ))}
    </View>
  );
}

interface TextProps {
  lines?: number;
  /** Last line width factor (0..1). Mimics ragged-right text. Default 0.6. */
  lastLineWidth?: number;
  lineHeight?: number;
  gap?: number;
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = 0.6,
  lineHeight = 14,
  gap = Spacing[2],
}: TextProps) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? `${Math.round(lastLineWidth * 100)}%` : '100%'}
        />
      ))}
    </View>
  );
}
