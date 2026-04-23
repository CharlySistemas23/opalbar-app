import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Radius, Spacing } from '@/constants/tokens';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface Props {
  label: string;
  variant?: BadgeVariant;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: `${Colors.accentSuccess}20`, text: Colors.accentSuccess },
  warning: { bg: `${Colors.accentWarning}20`, text: Colors.accentWarning },
  danger: { bg: `${Colors.accentDanger}20`, text: Colors.accentDanger },
  info: { bg: `${Colors.accentInfo}20`, text: Colors.accentInfo },
  default: { bg: Colors.bgElevated, text: Colors.textSecondary },
};

export function Badge({ label, variant = 'default' }: Props) {
  const { bg, text } = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
