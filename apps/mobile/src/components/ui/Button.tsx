// ─────────────────────────────────────────────
//  Button — Editorial Premium
//
//  Variants:
//    · primary    — solid amber, inverse label (the one CTA per screen)
//    · secondary  — hairline border on bgCard, primary label
//    · ghost      — transparent, accent label (low-emphasis actions)
//    · danger     — soft danger bg + danger label + destructive haptic
//
//  States (all variants):
//    · default | pressed (spring scale 0.97) | loading (spinner, no label)
//    · disabled (opacity 0.5, no haptic, no press scale)
//
//  Size:
//    · md (default) 48pt — meets HitSlop.primary
//    · lg          52pt — for primary screens (auth, checkout)
//    · sm          40pt — for inline actions inside lists
//
//  Shape: editorial radius (Radius.button = 12). NOT pill — pills are
//  reserved for tab bar / chips.
//
//  A11y: accessibilityRole=button + label + busy state when loading.
// ─────────────────────────────────────────────
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { Press } from '@/constants/motion';
import { HitSlop, Roles } from '@/constants/a11y';
import { useFeedback } from '@/hooks/useFeedback';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
type Haptic = 'none' | 'tap' | 'select' | 'success' | 'error' | 'warning' | 'destructive';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  haptic?: Haptic;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  fullWidth = true,
  style,
  leftIcon,
  rightIcon,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const isDisabled = !!(disabled || loading);
  const scale = useRef(new Animated.Value(1)).current;
  const fb = useFeedback();

  const animateTo = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      tension: 240,
      friction: 12,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();

  function fireHaptic() {
    const kind: Haptic = haptic ?? (variant === 'danger' ? 'destructive' : 'tap');
    if (kind === 'none') return;
    if (kind === 'tap') fb.tap();
    else if (kind === 'select') fb.select();
    else if (kind === 'success') fb.success();
    else if (kind === 'error') fb.error();
    else if (kind === 'warning') fb.warning();
    else if (kind === 'destructive') fb.destructive();
  }

  const sizeStyle = sizeStyles[size];
  const variantStyle = variantStyles[variant];
  const labelColor = labelColors[variant];

  return (
    <Animated.View
      style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth, style]}
    >
      <Pressable
        accessibilityRole={Roles.button}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: !!loading }}
        hitSlop={HitSlop.expand}
        testID={testID}
        onPressIn={() => !isDisabled && animateTo(Press.scale)}
        onPressOut={() => !isDisabled && animateTo(1)}
        onPress={() => {
          if (isDisabled) return;
          fireHaptic();
          onPress();
        }}
        disabled={isDisabled}
        style={[
          styles.base,
          sizeStyle.shell,
          variantStyle,
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={
              variant === 'primary'
                ? Colors.textInverse
                : variant === 'danger'
                  ? Colors.accentDanger
                  : Colors.accentPrimary
            }
          />
        ) : (
          <View style={styles.row}>
            {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
            <Text
              numberOfLines={1}
              style={[
                TypePresets.subhead,
                sizeStyle.label,
                { color: labelColor },
              ]}
            >
              {label}
            </Text>
            {rightIcon ? <View style={styles.iconSlot}>{rightIcon}</View> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── styles ───────────────────────────────────
const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    marginHorizontal: Spacing[1],
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
});

const sizeStyles = {
  sm: {
    shell: { minHeight: 40, paddingHorizontal: Spacing[4] } as ViewStyle,
    label: { fontSize: 14, letterSpacing: 0.2 },
  },
  md: {
    shell: { minHeight: 48, paddingHorizontal: Spacing[5] } as ViewStyle,
    label: { fontSize: 15, letterSpacing: 0.2 },
  },
  lg: {
    shell: { minHeight: 52, paddingHorizontal: Spacing[6] } as ViewStyle,
    label: { fontSize: 16, letterSpacing: 0.2 },
  },
} as const;

const variantStyles: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: Colors.accentPrimary,
  },
  secondary: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  ghost: {
    backgroundColor: Colors.transparent,
  },
  danger: {
    backgroundColor: 'rgba(217,106,106,0.10)',
    borderWidth: 1,
    borderColor: Colors.accentDanger,
  },
};

const labelColors: Record<Variant, string> = {
  primary: Colors.textInverse,
  secondary: Colors.textPrimary,
  ghost: Colors.accentPrimary,
  danger: Colors.accentDanger,
};
