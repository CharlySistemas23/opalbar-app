import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/tokens';

interface Props {
  label: string;
  /** ISO-ish local string "YYYY-MM-DDTHH:MM" or empty */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
}

function toLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocal(s: string): Date {
  if (!s) return new Date();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return new Date();
}

function formatForDisplay(s: string, language = 'es'): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString(language, {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export function DateTimeField({ label, value, onChange, placeholder = 'Seleccionar fecha y hora', minimumDate }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [mode, setMode] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date>(fromLocal(value));

  function open() {
    setTempDate(fromLocal(value || new Date().toISOString()));
    setMode('date');
    setShowPicker(true);
  }

  function onPickerChange(_: DateTimePickerEvent, selected?: Date) {
    // Android: close immediately after each step
    if (Platform.OS === 'android') {
      if (!selected) { setShowPicker(false); return; }
      if (mode === 'date') {
        setTempDate(selected);
        setMode('time');
        // re-open with time picker on next tick
        setTimeout(() => setShowPicker(true), 50);
        setShowPicker(false);
      } else {
        // combine: previous date + new time
        const combined = new Date(tempDate);
        combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        onChange(toLocal(combined));
        setShowPicker(false);
      }
    } else {
      // iOS: inline change
      if (selected) setTempDate(selected);
    }
  }

  function confirmIos() {
    onChange(toLocal(tempDate));
    setShowPicker(false);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.input} onPress={open} activeOpacity={0.85}>
        <Feather name="calendar" size={16} color={value ? Colors.accentPrimary : Colors.textMuted} />
        <Text style={[styles.inputText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatForDisplay(value) : placeholder}
        </Text>
        {value ? (
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); onChange(''); }} hitSlop={8}>
            <Feather name="x" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <Feather name="chevron-down" size={14} color={Colors.textMuted} />
        )}
      </TouchableOpacity>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode={mode}
          is24Hour
          display="default"
          onChange={onPickerChange}
          minimumDate={minimumDate}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.modalCancel}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{label}</Text>
                <TouchableOpacity onPress={confirmIos}>
                  <Text style={styles.modalDone}>Listo</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                themeVariant="dark"
                onChange={(_, d) => d && setTempDate(d)}
                minimumDate={minimumDate}
                textColor="#F4F4F5"
                style={{ height: 220 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  inputText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  placeholder: { color: Colors.textMuted, fontWeight: '400' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 24,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  modalCancel: { color: Colors.textSecondary, fontSize: 14 },
  modalDone: { color: Colors.accentPrimary, fontSize: 14, fontWeight: '800' },
});
