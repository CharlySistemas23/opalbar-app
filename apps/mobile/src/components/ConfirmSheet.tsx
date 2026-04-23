import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Primary title */
  title: string;
  /** Secondary description */
  message: string;
  /** Icon + color scheme */
  icon?: FeatherIcon;
  /** Variant controls color tone */
  variant?: 'default' | 'danger' | 'warning' | 'success';
  /** Confirm button label */
  confirmLabel: string;
  /** Optional: free-text input shown before confirmation (e.g. reason) */
  inputLabel?: string;
  inputPlaceholder?: string;
  /** Optional: require typing this exact string (e.g. "ELIMINAR") to enable confirm */
  requireText?: string;
  /** Triggered with input value (or empty string) */
  onConfirm: (input?: string) => void | Promise<void>;
  loading?: boolean;
}

const VARIANT_COLORS: Record<Required<Props>['variant'], string> = {
  default: Colors.accentPrimary,
  danger: Colors.accentDanger,
  warning: Colors.accentPrimary,
  success: Colors.accentSuccess,
};

export function ConfirmSheet({
  visible, onClose, title, message,
  icon = 'alert-circle',
  variant = 'default',
  confirmLabel, onConfirm, loading = false,
  inputLabel, inputPlaceholder, requireText,
}: Props) {
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!visible) setInput('');
  }, [visible]);

  const color = VARIANT_COLORS[variant];
  const canConfirm = requireText
    ? input === requireText
    : !inputLabel || input.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
            <Feather name={icon} size={28} color={color} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {inputLabel && (
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>{inputLabel.toUpperCase()}</Text>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder={inputPlaceholder}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize={requireText ? 'characters' : 'sentences'}
                autoFocus
              />
              {requireText && (
                <Text style={styles.inputHint}>
                  Escribe <Text style={{ color, fontWeight: '800' }}>{requireText}</Text> para confirmar.
                </Text>
              )}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelLbl}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: color }, (!canConfirm || loading) && { opacity: 0.5 }]}
              onPress={() => onConfirm(input || undefined)}
              disabled={!canConfirm || loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.textInverse} size="small" />
                : <Text style={styles.confirmLbl}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 12,
  },
  iconBox: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18, fontWeight: '800',
    textAlign: 'center', marginTop: 4,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 13, lineHeight: 20,
    textAlign: 'center',
  },

  inputBox: { width: '100%', gap: 6, marginTop: 8 },
  inputLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 14,
  },
  inputHint: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  actions: {
    width: '100%',
    flexDirection: 'row', gap: 10, marginTop: 8,
  },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  confirmBtn: {
    flex: 1, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },
});
