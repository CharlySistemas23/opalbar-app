// ─────────────────────────────────────────────
//  Card — Editorial Premium surface
//
//  Variants:
//    'flat'     → bgCard + hairline border, no shadow (default; nested content)
//    'elevated' → bgCard + top-edge highlight + whisper drop shadow
//    'inset'    → bgSubtle alpha over bgPrimary (for "quiet" panels inside hero blocks)
//
//  Editorial: shadows are basically invisible. Depth comes from the
//  top-edge highlight + hairline borders + the contrast between bgCard
//  and bgPrimary.
//
//  When `onPress` is provided, the card wraps a <Pressy> so it gets spring
//  press feedback + haptic + a11y role=button automatically. Pass
//  `accessibilityLabel` so screen readers know what the card represents.
// ─────────────────────────────────────────────
import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

import { Colors, Radius, Shadows, Spacing } from '@/constants/tokens';
import { Pressy } from './Pressy';

type Variant = 'flat' | 'elevated' | 'inset';

interface Props {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  padding?: number;
  variant?: Variant;
  radius?: keyof typeof Radius;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function Card({
  children,
  style,
  onPress,
  padding = Spacing[5],
  variant = 'flat',
  radius = 'card',
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const variantStyle = ((): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: Colors.bgCard,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.highlightTop,
          ...Shadows.card,
        };
      case 'inset':
        return {
          backgroundColor: Colors.bgSubtle,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: Colors.borderSubtle,
        };
      case 'flat':
      default:
        return {
          backgroundColor: Colors.bgCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: Colors.border,
        };
    }
  })();

  const composed = [
    { borderRadius: Radius[radius], padding },
    variantStyle,
    ...(Array.isArray(style) ? style : [style]),
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <Pressy
        onPress={onPress}
        sound="tick"
        style={composed}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
      >
        {children}
      </Pressy>
    );
  }
  return (
    <View style={composed} testID={testID}>
      {children}
    </View>
  );
}
