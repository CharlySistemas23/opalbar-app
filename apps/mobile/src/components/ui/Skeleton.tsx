// ─────────────────────────────────────────────
//  Skeleton — shimmer loading placeholder
//
//  Use this INSTEAD of <ActivityIndicator> for lists / cards loading.
//  Spinners signal "indie"; skeletons signal polish.
//
//  Usage:
//    <Skeleton width={120} height={16} />
//    <Skeleton width="60%" height={14} />
//    <SkeletonList count={6} itemHeight={72} />
// ─────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  ViewStyle,
  StyleProp,
  DimensionValue,
} from 'react-native';
import { Colors, Radius } from '@/constants/tokens';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Animated.View
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

export function SkeletonList({ count = 6, itemHeight = 64, gap = 12, radius = Radius.lg }: ListProps) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={itemHeight} radius={radius} />
      ))}
    </View>
  );
}
