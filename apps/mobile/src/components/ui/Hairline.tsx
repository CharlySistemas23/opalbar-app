// ─────────────────────────────────────────────
//  Hairline — premium separator
//
//  Use this instead of 1px gray lines. Uses alpha over the current
//  background so it reads as an "insinuated" separation — the telltale
//  detail of a premium dark UI.
//
//  Variants:
//    'subtle' (default) → borderSubtle (almost invisible)
//    'normal'           → border
//    'strong'           → borderStrong (for emphasis)
// ─────────────────────────────────────────────
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/tokens';

type Variant = 'subtle' | 'normal' | 'strong';

interface Props {
  variant?: Variant;
  marginVertical?: number;
  marginHorizontal?: number;
  style?: ViewStyle | ViewStyle[];
}

const colorMap: Record<Variant, string> = {
  subtle: Colors.borderSubtle,
  normal: Colors.border,
  strong: Colors.borderStrong,
};

export function Hairline({ variant = 'normal', marginVertical, marginHorizontal, style }: Props) {
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colorMap[variant],
          marginVertical,
          marginHorizontal,
        },
        ...(Array.isArray(style) ? style : [style]),
      ].filter(Boolean) as ViewStyle[]}
    />
  );
}
