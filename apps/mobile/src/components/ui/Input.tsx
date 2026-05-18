// ─────────────────────────────────────────────
//  Input — Editorial Premium text field
//
//  · Label (uppercase kicker style) — distinct from placeholder so screen
//    readers get an unambiguous accessibilityLabel without leaking hint text
//  · Optional helper / error caption beneath
//  · Optional left/right icon slots (icons are decorative, hidden from a11y)
//  · States: default | focused (accent border) | error (danger border) | disabled
//  · A11y: passes label to accessibilityLabel; sets accessibilityState
//    {disabled} and aria-invalid via accessibilityValue.text
//
//  Editorial detail: the label sits ABOVE the field in caps with letter-
//  spacing, not as a floating label. This reads as "form field on stationery".
// ─────────────────────────────────────────────
import { ReactNode, useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
} from 'react-native';

import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { A11yDefaults, HitSlop } from '@/constants/a11y';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helper?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onRightIconPress?: () => void;
  rightIconLabel?: string;
  disabled?: boolean;
  style?: TextInputProps['style'];
  containerStyle?: StyleProp<ViewStyle>;
  /** Required (true | string). When `true`, mark with a subtle dot beside the label. */
  required?: boolean | string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    helper,
    error,
    leftIcon,
    rightIcon,
    onRightIconPress,
    rightIconLabel,
    disabled,
    required,
    style,
    containerStyle,
    accessibilityLabel,
    placeholder,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showError = !!error;

  const a11yLabel = accessibilityLabel ?? label ?? placeholder ?? 'Campo de texto';

  return (
    <View style={styles.wrapper}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[TypePresets.label, { color: Colors.textSecondary }]}>{label}</Text>
          {required ? (
            <View style={styles.requiredDot} accessibilityElementsHidden importantForAccessibility="no" />
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.container,
          focused && styles.focused,
          showError && styles.errored,
          disabled && styles.disabled,
          containerStyle,
        ]}
      >
        {leftIcon ? (
          <View style={styles.iconLeft} {...A11yDefaults.decorativeIcon}>
            {leftIcon}
          </View>
        ) : null}

        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={Colors.textDisabled}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          editable={!disabled}
          accessibilityLabel={a11yLabel}
          accessibilityState={{ disabled: !!disabled }}
          // RN doesn't have aria-invalid; we communicate via the visual + screen-reader hint
          accessibilityHint={
            showError ? `Error: ${error}` : helper ? helper : undefined
          }
          {...props}
        />

        {rightIcon ? (
          onRightIconPress ? (
            <Pressable
              onPress={onRightIconPress}
              hitSlop={HitSlop.expand}
              accessibilityRole="button"
              accessibilityLabel={rightIconLabel ?? 'Acción'}
              style={styles.iconRight}
            >
              {rightIcon}
            </Pressable>
          ) : (
            <View style={styles.iconRight} {...A11yDefaults.decorativeIcon}>
              {rightIcon}
            </View>
          )
        ) : null}
      </View>

      {showError ? (
        <Text style={[TypePresets.caption, { color: Colors.accentDanger }]}>{error}</Text>
      ) : helper ? (
        <Text style={[TypePresets.caption, { color: Colors.textMuted }]}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: Spacing[2] },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },
  requiredDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accentPrimary,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    minHeight: 52,
  },
  focused: { borderColor: Colors.accentPrimary },
  errored: { borderColor: Colors.accentDanger },
  disabled: { opacity: 0.5 },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    paddingVertical: Spacing[3],
  },
  iconLeft: {
    marginRight: Spacing[3],
  },
  iconRight: {
    marginLeft: Spacing[3],
    padding: Spacing[1],
  },
});
