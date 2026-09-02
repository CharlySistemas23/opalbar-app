// ─────────────────────────────────────────────
//  ReasonSheet — free-text (or numeric) input in a bottom sheet
//
//  Replaces `Alert.prompt` (iOS-only, no validation) across the admin
//  panel. Supports quick-pick presets above the input, min/max length
//  mirrored from the backend DTOs and an optional secondary numeric
//  field (points adjust: delta + reason).
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Button, Caption, Input, Sheet } from '@/components/ui';
import { useFeedback } from '@/hooks/useFeedback';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  label?: string;
  placeholder?: string;
  /** Tappable chips that fill the input. */
  presets?: string[];
  minLength?: number;
  maxLength?: number;
  /** Make the reason optional (default: required, minLength applies). */
  optional?: boolean;
  multiline?: boolean;
  confirmLabel?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  /** Optional numeric field rendered above the reason (e.g. points delta). */
  number?: {
    label: string;
    placeholder?: string;
    min?: number;
    max?: number;
    /** Reject 0 (default true) */
    nonZero?: boolean;
    initial?: number;
  };
  onConfirm: (reason: string, numberValue?: number) => void | Promise<void>;
}

export function ReasonSheet({
  open,
  onClose,
  title,
  subtitle,
  label = 'Motivo',
  placeholder = 'Escribe el motivo…',
  presets,
  minLength = 0,
  maxLength = 500,
  optional,
  multiline = true,
  confirmLabel = 'Confirmar',
  variant = 'primary',
  loading,
  number,
  onConfirm,
}: Props) {
  const fb = useFeedback();
  const [text, setText] = useState('');
  const [num, setNum] = useState(number?.initial != null ? String(number.initial) : '');

  useEffect(() => {
    if (!open) {
      setText('');
      setNum(number?.initial != null ? String(number.initial) : '');
    }
  }, [open, number?.initial]);

  const trimmed = text.trim();
  const reasonError =
    !optional && trimmed.length > 0 && trimmed.length < minLength
      ? `Mínimo ${minLength} caracteres`
      : trimmed.length > maxLength
        ? `Máximo ${maxLength} caracteres`
        : undefined;
  const reasonOk = optional ? trimmed.length <= maxLength : trimmed.length >= Math.max(1, minLength) && trimmed.length <= maxLength;

  let numValue: number | undefined;
  let numError: string | undefined;
  if (number) {
    const parsed = Number(num.replace(/[^\d-]/g, ''));
    if (num.trim() === '' || Number.isNaN(parsed) || !Number.isInteger(parsed)) {
      numError = num.trim() === '' ? undefined : 'Escribe un número entero';
    } else if ((number.nonZero ?? true) && parsed === 0) {
      numError = 'Debe ser distinto de 0';
    } else if (number.min != null && parsed < number.min) {
      numError = `Mínimo ${number.min}`;
    } else if (number.max != null && parsed > number.max) {
      numError = `Máximo ${number.max}`;
    } else {
      numValue = parsed;
    }
  }
  const canConfirm = reasonOk && (!number || numValue != null) && !loading;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing[3] }}>
        {subtitle ? <Caption tone="muted">{subtitle}</Caption> : null}

        {number ? (
          <Input
            label={number.label}
            placeholder={number.placeholder ?? '0'}
            value={num}
            onChangeText={setNum}
            keyboardType="numbers-and-punctuation"
            error={numError}
            required
          />
        ) : null}

        {presets?.length ? (
          <View style={styles.presets}>
            {presets.map((p) => {
              const active = text === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => { fb.select(); setText(active ? '' : p); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.preset, active && styles.presetActive, pressed && { opacity: 0.7 }]}
                >
                  <Caption size="sm" style={{ color: active ? Colors.accentPrimary : Colors.textSecondary, fontWeight: '600' }}>
                    {p}
                  </Caption>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Input
          label={label}
          placeholder={placeholder}
          value={text}
          onChangeText={setText}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          maxLength={maxLength}
          error={reasonError}
          helper={optional ? 'Opcional' : minLength > 0 ? `Mínimo ${minLength} caracteres` : undefined}
          required={!optional}
          autoFocus={!number}
          style={multiline ? { minHeight: 84, textAlignVertical: 'top' } : undefined}
        />

        <Button
          label={confirmLabel}
          variant={variant}
          disabled={!canConfirm}
          loading={loading}
          onPress={() => onConfirm(trimmed, numValue)}
          leftIcon={
            <Feather
              name={variant === 'danger' ? 'x' : 'check'}
              size={16}
              color={variant === 'danger' ? Colors.accentDanger : Colors.textInverse}
            />
          }
        />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  presetActive: { borderColor: Colors.accentPrimary, backgroundColor: 'rgba(201,169,97,0.10)' },
});
