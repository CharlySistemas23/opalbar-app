import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Pressable,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Button, Caption, Input, Kicker, Subhead } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { AdminHeader } from '@/components/admin';

export default function ReservationsConfig() {
  const goBack = useSafeBack('/(admin)/manage/reservations');
  const me = useAuthStore((s) => s.user);
  const canSave = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [openTime, setOpenTime] = useState('19:00');
  const [closeTime, setCloseTime] = useState('02:00');
  const [capacity, setCapacity] = useState('80');
  const [slotMinutes, setSlotMinutes] = useState('30');
  const [enabled, setEnabled] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVenue = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Admin endpoint — the public list filters isActive:true, which made
      // a deactivated venue's reservation config unreachable here.
      const r = await adminApi.venues();
      const list = r.data?.data ?? r.data ?? [];
      const first = Array.isArray(list) ? list[0] : undefined;
      if (first) {
        setVenue(first);
        setOpenTime(first.openTime ?? '19:00');
        setCloseTime(first.closeTime ?? '02:00');
        setCapacity(String(first.reservationCapacity ?? 80));
        setSlotMinutes(String(first.slotMinutes ?? 30));
        setEnabled(first.reservationsEnabled ?? true);
      }
    } catch (err) {
      setLoadError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVenue(); }, [loadVenue]);

  async function save() {
    if (!venue || !canSave) return;
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
  if (loadError)
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ErrorState message={loadError} onRetry={loadVenue} />
      </SafeAreaView>
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
        title="Configuración de reservaciones"
        kicker="Ajustes"
        onBack={goBack}
        right={
          canSave ? (
            <Pressable
              onPress={save}
              disabled={saving}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Guardar configuración"
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
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: 140, gap: Spacing[4] }}>
        {!canSave ? (
          <View style={styles.hint}>
            <Feather name="lock" size={12} color={Colors.textMuted} />
            <Caption tone="muted" size="sm" style={{ flex: 1 }}>
              Solo lectura — necesitas rol de admin para guardar cambios aquí.
            </Caption>
          </View>
        ) : null}
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
                Si está apagado, los usuarios no podrán reservar mesa.
              </Caption>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              disabled={!canSave}
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
                editable={canSave}
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
                editable={canSave}
                placeholder="02:00"
                maxLength={5}
                leftIcon={<Feather name="sunset" size={15} color={Colors.textMuted} />}
              />
            </View>
          </View>
          <View style={styles.hint}>
            <Feather name="info" size={12} color={Colors.textMuted} />
            <Caption tone="muted" size="sm" style={{ flex: 1 }}>
              Formato 24h. Si cierras después de medianoche usa la hora real (ej. 02:00).
            </Caption>
          </View>
        </View>

        <View style={styles.section}>
          <Kicker tone="muted">Capacidad</Kicker>
          <Input
            label="Personas máximo por noche"
            value={capacity}
            onChangeText={setCapacity}
            editable={canSave}
            placeholder="80"
            keyboardType="number-pad"
            leftIcon={<Feather name="users" size={15} color={Colors.textMuted} />}
          />
        </View>

        <View style={styles.section}>
          <Kicker tone="muted">Duración de slot</Kicker>
          <Caption tone="secondary" style={{ marginBottom: Spacing[2] }}>
            Minutos entre slots disponibles
          </Caption>
          <View style={styles.slotRow}>
            {[15, 30, 45, 60].map((m) => {
              const active = Number(slotMinutes) === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => canSave && setSlotMinutes(String(m))}
                  disabled={!canSave}
                  accessibilityRole="button"
                  accessibilityLabel={`${m} minutos`}
                  accessibilityState={{ selected: active, disabled: !canSave }}
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
              Un slot corto permite más opciones al cliente; uno largo da más tiempo por mesa.
            </Caption>
          </View>
        </View>

        {canSave ? (
          <Button
            label={saving ? 'Guardando...' : 'Guardar cambios'}
            variant="primary"
            onPress={save}
            loading={saving}
          />
        ) : null}
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
