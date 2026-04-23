import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

export type ReportReason = 'SPAM' | 'INAPPROPRIATE' | 'HARASSMENT' | 'FAKE' | 'OTHER';

const REASONS: { key: ReportReason; label: string; sub: string }[] = [
  { key: 'SPAM', label: 'Spam', sub: 'Publicidad no deseada o repetitiva' },
  { key: 'INAPPROPRIATE', label: 'Contenido inapropiado', sub: 'Violencia, desnudos o ilegal' },
  { key: 'HARASSMENT', label: 'Acoso', sub: 'Insultos, amenazas, bullying' },
  { key: 'FAKE', label: 'Información falsa', sub: 'Estafa o contenido engañoso' },
  { key: 'OTHER', label: 'Otro', sub: 'Descríbelo abajo' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void> | void;
  title?: string;
}

export function ReportSheet({ visible, onClose, onSubmit, title = 'Reportar contenido' }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) { setReason(null); setDetails(''); }
  }, [visible]);

  async function submit() {
    if (!reason) return;
    if (reason === 'OTHER' && details.trim().length < 5) return;
    setSubmitting(true);
    try { await onSubmit(reason, details.trim()); onClose(); }
    finally { setSubmitting(false); }
  }

  const canSubmit = reason && (reason !== 'OTHER' || details.trim().length >= 5);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.lead}>
            Cuéntanos qué pasa. Tu reporte es anónimo para quien publicó.
          </Text>

          <View style={{ gap: 8, marginTop: 8 }}>
            {REASONS.map((r) => {
              const active = reason === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setReason(r.key)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLbl}>{r.label}</Text>
                    <Text style={styles.optionSub}>{r.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLbl}>DETALLES {reason === 'OTHER' ? '*' : '(opcional)'}</Text>
          <TextInput
            style={styles.input}
            multiline
            value={details}
            onChangeText={setDetails}
            placeholder="Cuéntanos más (5+ caracteres si elegiste Otro)"
            placeholderTextColor={Colors.textMuted}
          />

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
            disabled={!canSubmit || submitting}
            onPress={submit}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={styles.submitLbl}>Enviar reporte</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgPrimary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  lead: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  optionActive: { borderColor: Colors.accentDanger, backgroundColor: 'rgba(228,88,88,0.08)' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.accentDanger },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accentDanger },
  optionLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  optionSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  fieldLbl: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 10 },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 14,
    height: 80, textAlignVertical: 'top',
  },

  submitBtn: {
    height: 50, borderRadius: 14,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 10,
  },
  submitLbl: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
});
