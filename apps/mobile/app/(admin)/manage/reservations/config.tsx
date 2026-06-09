import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Pressable,
} from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Button, Caption, Input, Kicker, Subhead } from '@/components/ui';
import { AdminHeader } from '@/components/admin';

export default function ReservationsConfig() {
  const goBack = useSafeBack('/(admin)/manage/reservations');
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      Alert.alert('Formato invalido', 'Usa HH:MM (ej. 19:00)');
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
      goBack();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  if (!venue)
    return (
      <View style={styles.center}>
        <Caption tone="muted">Sin venue</Caption>
      </View>
    );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Config Reservaciones"
        kicker="Ajustes"
        onBack={goBack}
        right={
          <Pressable
            onPress={save}
            disabled={saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Guardar configuracion"
            style={({ pressed }) => [
              styles.saveBtn,
              saving && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <Caption tone="inverse" style={{ fontWeight: '700' }}>
                Guardar
              </Caption>
            )}
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: 140, gap: Spacing[4] }}>
        <View style={styles.venueCard}>
          <View style={styles.vIcon}>
            <Feather name="home" size={18} color={Colors.accentPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Kicker tone="muted">Local</Kicker>
            <Subhead style={{ marginTop: 2 }}>{venue.name}</Subhead>
            <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {venue.address}
            </Caption>
          </View>
        </View>

        <View style={styles.section}>
          <Kicker tone="muted">Estado</Kicker>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Subhead>Aceptando reservaciones</Subhead>
              <Caption tone="muted" style={{ marginTop: 2 }}>
                Si esta off, los usuarios no podran reservar mesa.
              </Caption>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
              thumbColor="#fff"
              accessibilityLabel="Aceptando reservaciones"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Kicker tone="muted">Horario</Kicker>
          <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Apertura"
                value={openTime}
                onChangeText={setOpenTime}
                placeholder="19:00"
                maxLength={5}
                leftIcon={<Feather name="sunrise" size={15} color={Colors.textMuted} />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Cierre"
                value={closeTime}
                onChangeText={setCloseTime}
                placeholder="02:00"
                maxLength={5}
                leftIcon={<Feather name="sunset" size={15} color={Colors.textMuted} />}
              />
            </View>
          </View>
          <View style={styles.hint}>
            <Feather name="info" size={12} color={Colors.textMuted} />
            <Caption tone="muted" size="sm" style={{ flex: 1 }}>
              Formato 24h. Si cierras despues de medianoche usa la hora real (ej. 02:00).
            </Caption>
          </View>
        </View>

        <View style={styles.section}>
          <Kicker tone="muted">Capacidad</Kicker>
          <Input
            label="Personas maximo por noche"
            value={capacity}
            onChangeText={setCapacity}
            placeholder="80"
            keyboardType="number-pad"
            leftIcon={<Feather name="users" size={15} color={Colors.textMuted} />}
          />
        </View>

        <View style={styles.section}>
          <Kicker tone="muted">Duracion de slot</Kicker>
          <Caption tone="secondary" style={{ marginBottom: Spacing[2] }}>
            Minutos entre slots disponibles
          </Caption>
          <View style={styles.slotRow}>
            {[15, 30, 45, 60].map((m) => {
              const active = Number(slotMinutes) === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setSlotMinutes(String(m))}
                  accessibilityRole="button"
                  accessibilityLabel={`${m} minutos`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.slotBtn,
                    active && styles.slotBtnActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Body
                    size="sm"
                    weight="semiBold"
                    tone={active ? 'inverse' : 'secondary'}
                  >
                    {m} min
                  </Body>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.hint}>
            <Feather name="info" size={12} color={Colors.textMuted} />
            <Caption tone="muted" size="sm" style={{ flex: 1 }}>
              Un slot corto permite mas opciones al cliente; uno largo da mas tiempo por mesa.
            </Caption>
          </View>
        </View>

        <Button
          label={saving ? 'Guardando...' : 'Guardar cambios'}
          variant="primary"
          onPress={save}
          loading={saving}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
  },

  saveBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 8,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.lg,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },

  venueCard: {
    flexDirection: 'row',
    gap: Spacing[3],
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  vIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(201,169,97,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { gap: Spacing[2] },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  slotRow: { flexDirection: 'row', gap: Spacing[2] },
  slotBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  slotBtnActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },

  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
});
