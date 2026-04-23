import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { reservationsApi } from '@/api/client';
import { DateTimeField } from '@/components/DateTimeField';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

function toLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ModifyReservation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [date, setDate] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');
  const [venueName, setVenueName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    reservationsApi
      .detail(id)
      .then((r) => {
        const res = r.data?.data ?? r.data;
        setDate(toLocal(new Date(res.date)));
        setPartySize(res.partySize ?? 2);
        setNotes(res.notes ?? '');
        setVenueName(res.venue?.name ?? '');
        setStatus(res.status ?? '');
      })
      .catch((err) => Alert.alert('Error', apiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const locked = ['CANCELLED', 'COMPLETED', 'SEATED'].includes(status);

  async function save() {
    setSaving(true);
    try {
      await reservationsApi.modify(id!, { date, partySize, notes });
      Alert.alert(
        t ? 'Reserva actualizada' : 'Reservation updated',
        t ? 'Tus cambios se guardaron correctamente.' : 'Your changes were saved.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.centered}><ActivityIndicator color={Colors.accentPrimary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t ? 'Modificar reserva' : 'Modify reservation'}</Text>
          <View style={styles.backBtn} />
        </View>

        {locked && (
          <View style={styles.lockedBox}>
            <Feather name="lock" size={14} color={Colors.textMuted} />
            <Text style={styles.lockedText}>
              {t
                ? 'Esta reserva ya no puede modificarse en su estado actual.'
                : 'This reservation can no longer be modified in its current state.'}
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.venueCard}>
            <View style={styles.venueIcon}>
              <Feather name="map-pin" size={16} color={Colors.accentPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.venueLbl}>{t ? 'Bar' : 'Venue'}</Text>
              <Text style={styles.venueName}>{venueName || '—'}</Text>
            </View>
          </View>

          <DateTimeField
            label={t ? 'Fecha y hora' : 'Date & time'}
            value={date}
            onChange={setDate}
            minimumDate={new Date()}
          />

          <Text style={styles.fieldLbl}>{t ? 'PERSONAS' : 'GUESTS'}</Text>
          <View style={styles.counter}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setPartySize((n) => Math.max(1, n - 1))}
              disabled={locked}
            >
              <Feather name="minus" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{partySize}</Text>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setPartySize((n) => Math.min(30, n + 1))}
              disabled={locked}
            >
              <Feather name="plus" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLbl}>{t ? 'NOTAS' : 'NOTES'}</Text>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder={t ? 'Alergias, solicitudes especiales…' : 'Allergies, special requests…'}
            placeholderTextColor={Colors.textMuted}
            editable={!locked}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, (saving || locked) && { opacity: 0.6 }]}
            disabled={saving || locked}
            onPress={save}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={styles.saveLbl}>{t ? 'Guardar cambios' : 'Save changes'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },

  lockedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  lockedText: { color: Colors.textMuted, fontSize: 12, flex: 1, lineHeight: 17 },

  body: { padding: 20, gap: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  venueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  venueIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  venueLbl: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  venueName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 },

  fieldLbl: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 4 },

  counter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
    padding: 6,
  },
  counterBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  counterValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },

  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 14,
  },

  footer: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },
  saveBtn: {
    height: 52, borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveLbl: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
});
