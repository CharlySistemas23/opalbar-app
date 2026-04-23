import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Switch, TextInput,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

export default function ReservationsConfig() {
  const router = useRouter();
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [openTime, setOpenTime] = useState('19:00');
  const [closeTime, setCloseTime] = useState('02:00');
  const [capacity, setCapacity] = useState('80');
  const [slotMinutes, setSlotMinutes] = useState('30');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await venueApi.list({});
        const first = r.data?.data?.data?.[0] ?? r.data?.data?.[0];
        if (first) {
          setVenue(first);
          setOpenTime(first.openTime ?? '19:00');
          setCloseTime(first.closeTime ?? '02:00');
          setCapacity(String(first.reservationCapacity ?? 80));
          setSlotMinutes(String(first.slotMinutes ?? 30));
          setEnabled(first.reservationsEnabled ?? true);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    if (!venue) return;
    if (!/^\d{2}:\d{2}$/.test(openTime) || !/^\d{2}:\d{2}$/.test(closeTime)) {
      Alert.alert('Formato inválido', 'Usa HH:MM (ej. 19:00)');
      return;
    }
    setSaving(true);
    try {
      await venueApi.updateConfig(venue.id, {
        openTime,
        closeTime,
        reservationCapacity: Number(capacity) || 0,
        slotMinutes: Number(slotMinutes) || 30,
        reservationsEnabled: enabled,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (!venue) return <View style={styles.center}><Text style={{ color: Colors.textMuted }}>Sin venue</Text></View>;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Config Reservaciones</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={save}
          disabled={saving}
          hitSlop={8}
        >
          {saving
            ? <ActivityIndicator color={Colors.textInverse} size="small" />
            : <Text style={styles.saveLbl}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 16 }}>
        <View style={styles.venueCard}>
          <View style={styles.vIcon}>
            <Feather name="home" size={18} color={Colors.accentPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vLabel}>LOCAL</Text>
            <Text style={styles.vName}>{venue.name}</Text>
            <Text style={styles.vAddr} numberOfLines={1}>{venue.address}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ESTADO</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLbl}>Aceptando reservaciones</Text>
              <Text style={styles.rowSub}>Si está off, los usuarios no podrán reservar mesa.</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HORARIO</Text>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLbl}>Apertura</Text>
              <View style={styles.inputWrap}>
                <Feather name="sunrise" size={15} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={openTime}
                  onChangeText={setOpenTime}
                  placeholder="19:00"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={5}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLbl}>Cierre</Text>
              <View style={styles.inputWrap}>
                <Feather name="sunset" size={15} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={closeTime}
                  onChangeText={setCloseTime}
                  placeholder="02:00"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={5}
                />
              </View>
            </View>
          </View>
          <View style={styles.hint}>
            <Feather name="info" size={12} color={Colors.textMuted} />
            <Text style={styles.hintText}>
              Formato 24h. Si cierras después de medianoche usa la hora real (ej. 02:00).
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CAPACIDAD</Text>
          <Text style={styles.fieldLbl}>Personas máximo por noche</Text>
          <View style={styles.inputWrap}>
            <Feather name="users" size={15} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={capacity}
              onChangeText={setCapacity}
              placeholder="80"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DURACIÓN DE SLOT</Text>
          <Text style={styles.fieldLbl}>Minutos entre slots disponibles</Text>
          <View style={styles.slotRow}>
            {[15, 30, 45, 60].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.slotBtn, Number(slotMinutes) === m && styles.slotBtnActive]}
                onPress={() => setSlotMinutes(String(m))}
              >
                <Text style={[styles.slotLbl, Number(slotMinutes) === m && styles.slotLblActive]}>
                  {m} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.hint}>
            <Feather name="info" size={12} color={Colors.textMuted} />
            <Text style={styles.hintText}>
              Un slot corto permite más opciones al cliente; uno largo da más tiempo por mesa.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 14, minWidth: 84, alignItems: 'center',
  },
  saveLbl: { color: Colors.textInverse, fontWeight: '700', fontSize: 13 },

  venueCard: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  vIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  vLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  vName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 },
  vAddr: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  section: { gap: 10 },
  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowSub: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  row2: { flexDirection: 'row', gap: 10 },
  fieldLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600', padding: 0 },

  slotRow: { flexDirection: 'row', gap: 8 },
  slotBtn: {
    flex: 1, paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  slotBtnActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  slotLbl: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  slotLblActive: { color: Colors.textInverse },

  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  hintText: { color: Colors.textMuted, fontSize: 11, lineHeight: 15, flex: 1 },
});
