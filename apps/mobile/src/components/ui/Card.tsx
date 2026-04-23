// ─────────────────────────────────────────────
//  Card — premium elevated surface
//
//  Variants:
//    'flat'     → bgCard, no shadow (default for nested content, backward-compatible)
//    'elevated' → bgCard + top-edge highlight + soft drop shadow
//    'glass'    → bgElevated with a hint of alpha, for overlay panels
//
//  The top-edge highlight (borderTopColor with alpha white) simulates
//  light from above — the subtle detail that takes dark UIs from flat
//  to premium.
// ─────────────────────────────────────────────
import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Shadows } from '@/constants/tokens';
import { Pressy } from './Pressy';

type Variant = 'flat' | 'elevated' | 'glass';

interface Props {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  padding?: number;
  variant?: Variant;
  radius?: keyof typeof Radius;
}

export function Card({
  children,
  style,
  onPress,
  padding = Spacing[4],
  variant = 'flat',
  radius = 'xl',
}: Props) {
  const variantStyle = (() => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: Colors.bgCard,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.highlightTop,
          ...Shadows.card,
        } as ViewStyle;
      case 'glass':
        return {
          backgroundColor: Colors.bgElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: Colors.borderSubtle,
        } as ViewStyle;
      case 'flat':
      default:
        return {
          backgroundColor: Colors.bgCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: Colors.border,
        } as ViewStyle;
    }
  })();

  const composed = [
    { borderRadius: Radius[radius], padding },
    variantStyle,
    ...(Array.isArray(style) ? style : [style]),
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <Pressy onPress={onPress} style={composed}>
        {children}
      </Pressy>
    );
  }
  return <View style={composed}>{children}</View>;
}
