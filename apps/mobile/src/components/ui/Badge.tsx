// ─────────────────────────────────────────────
//  Badge — Editorial Premium tag
//
//  Variants: default | success | warning | danger | info | accent | champagne
//  Sizes:    sm (16h) | md (20h, default)
//
//  Editorial detail: badges are hairline outlined, not solid. Color is
//  carried by the text + border, with a tinted background at ~10% alpha.
//  Less "tech-app", more "luxury catalog".
// ─────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'champagne';
type BadgeSize = 'sm' | 'md';

interface Props {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** When true, drops the background and shows only the outline. */
  outline?: boolean;
  accessibilityLabel?: string;
}

const variantColors: Record<BadgeVariant, string> = {
  default: Colors.textSecondary,
  success: Colors.accentSuccess,
  warning: Colors.accentWarning,
  danger: Colors.accentDanger,
  info: Colors.accentInfo,
  accent: Colors.accentPrimary,
  champagne: Colors.accentChampagne,
};

function tint(hex: string, alpha = 0.10): string {
  // Convert #RRGGBB → rgba(r,g,b,alpha). For semantic alpha overlays.
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Badge({
  label,
  variant = 'default',
  size = 'md',
  outline,
  accessibilityLabel,
}: Props) {
  const color = variantColors[variant];
  const sizeStyle = size === 'sm' ? styles.sm : styles.md;
  const fontSize = size === 'sm' ? 10 : 11;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.badge,
        sizeStyle,
        {
          backgroundColor: outline ? 'transparent' : tint(color, 0.10),
          borderColor: color,
        },
      ]}
    >
      <Text
        style={[
          TypePresets.label,
          {
            color,
            fontSize,
            lineHeight: fontSize * 1.2,
            letterSpacing: 0.8,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    minHeight: 16,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  md: {
    minHeight: 20,
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
  },
});
