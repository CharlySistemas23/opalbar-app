import { Text, ActivityIndicator, StyleSheet, ViewStyle, Animated } from 'react-native';
import { useRef } from 'react';
import { Pressable } from 'react-native';
import { Colors, Radius, Typography, Spacing } from '@/constants/tokens';
import { useFeedback } from '@/hooks/useFeedback';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  /** Haptic kind on press. Defaults to 'tap' for primary/secondary, 'destructive' for danger. */
  haptic?: 'none' | 'tap' | 'success' | 'error' | 'warning' | 'destructive';
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  fullWidth = true,
  haptic,
}: Props) {
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;
  const fb = useFeedback();

  const animateTo = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      tension: 180,
      friction: 10,
      useNativeDriver: true,
    }).start();

  function fireHaptic() {
    const kind = haptic ?? (variant === 'danger' ? 'destructive' : 'tap');
    if (kind === 'none') return;
    if (kind === 'tap') fb.tap();
    else if (kind === 'success') fb.success();
    else if (kind === 'error') fb.error();
    else if (kind === 'warning') fb.warning();
    else if (kind === 'destructive') fb.destructive();
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth]}>
      <Pressable
        onPressIn={() => !isDisabled && animateTo(0.96)}
        onPressOut={() => !isDisabled && animateTo(1)}
        onPress={() => {
          if (isDisabled) return;
          fireHaptic();
          onPress();
        }}
        disabled={isDisabled}
        style={[
          styles.base,
          styles[variant],
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          style as any,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? Colors.textInverse : Colors.accentPrimary} />
        ) : (
          <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[5],
  },
  fullWidth: { width: '100%' },
  primary: { backgroundColor: Colors.accentPrimary },
  secondary: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  danger: { backgroundColor: `${Colors.accentDanger}20`, borderWidth: 1, borderColor: Colors.accentDanger },
  ghost: { backgroundColor: Colors.transparent },
  disabled: { opacity: 0.5 },
  label: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semiBold },
  primaryLabel: { color: Colors.textInverse },
  secondaryLabel: { color: Colors.textPrimary },
  dangerLabel: { color: Colors.accentDanger },
  ghostLabel: { color: Colors.accentPrimary },
});
