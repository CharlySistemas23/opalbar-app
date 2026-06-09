import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { apiClient, reservationsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Button,
  Caption,
  ConfirmDialog,
  Kicker,
  Subhead,
} from '@/components/ui';
import { AdminHeader, StatusPill } from '@/components/admin';

const STATUS_TONE: Record<
  string,
  { tone: 'accent' | 'success' | 'info' | 'neutral' | 'danger'; label: string }
> = {
  PENDING: { tone: 'accent', label: 'PENDIENTE' },
  CONFIRMED: { tone: 'success', label: 'CONFIRMADA' },
  SEATED: { tone: 'info', label: 'EN MESA' },
  COMPLETED: { tone: 'neutral', label: 'COMPLETADA' },
  CANCELLED: { tone: 'danger', label: 'CANCELADA' },
};

export default function AdminReservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useSafeBack('/(admin)/manage/reservations');
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await reservationsApi.get(id);
      setRes(r.data?.data);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function changeStatus(status: string) {
    setBusy(true);
    try {
      await apiClient.patch(`/admin/reservations/${id}/status`, { status });
      await load();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function performCancel() {
    setConfirmCancel(false);
    await changeStatus('CANCELLED');
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  if (!res)
    return (
      <View style={styles.center}>
        <Caption tone="muted">Reserva no encontrada</Caption>
      </View>
    );

  const meta = STATUS_TONE[res.status] ?? STATUS_TONE.PENDING;
  const user = res.user;
  const name =
    `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || 'Usuario';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Reserva"
        kicker="Detalle"
        onBack={goBack}
        right={<StatusPill label={meta.label} tone={meta.tone} />}
      />

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120, gap: Spacing[3] }}>
        <View style={styles.card}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Body tone="inverse" weight="bold">
                {name[0]?.toUpperCase() ?? '?'}
              </Body>
            </View>
            <View style={{ flex: 1 }}>
              <Subhead>{name}</Subhead>
              <Caption tone="muted" style={{ marginTop: 2 }}>
                {user?.email}
              </Caption>
              {user?.phone && <Caption tone="muted">{user.phone}</Caption>}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Row
            icon="calendar"
            label="FECHA"
            value={
              res.date
                ? new Date(res.date).toLocaleDateString('es', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                : '—'
            }
          />
          <Row icon="clock" label="HORARIO" value={res.timeSlot ?? '—'} />
          <Row icon="users" label="PERSONAS" value={String(res.partySize ?? 1)} />
          <Row icon="home" label="VENUE" value={res.venue?.name ?? '—'} />
          {res.event && <Row icon="star" label="EVENTO" value={res.event.title} />}
          <Row
            icon="hash"
            label="CODIGO"
            value={(res.confirmCode ?? '').slice(-8).toUpperCase()}
            mono
          />
        </View>

        {res.specialRequests && (
          <View style={styles.card}>
            <Kicker>Notas del cliente</Kicker>
            <Body size="sm" style={{ marginTop: Spacing[2] }}>
              {res.specialRequests}
            </Body>
          </View>
        )}

        <View style={[styles.card, { gap: Spacing[2] }]}>
          <Kicker>Acciones</Kicker>
          {res.status === 'PENDING' && (
            <Button
              label="Confirmar reserva"
              variant="primary"
              onPress={() => changeStatus('CONFIRMED')}
              disabled={busy}
              leftIcon={<Feather name="check-circle" size={16} color={Colors.textInverse} />}
            />
          )}
          {(res.status === 'PENDING' || res.status === 'CONFIRMED') && (
            <Button
              label="Marcar en mesa"
              variant="secondary"
              onPress={() => changeStatus('SEATED')}
              disabled={busy}
              leftIcon={<Feather name="user-check" size={16} color={Colors.textPrimary} />}
            />
          )}
          {res.status === 'SEATED' && (
            <Button
              label="Marcar completada"
              variant="primary"
              onPress={() => changeStatus('COMPLETED')}
              disabled={busy}
              leftIcon={<Feather name="flag" size={16} color={Colors.textInverse} />}
            />
          )}
          {res.status !== 'CANCELLED' && res.status !== 'COMPLETED' && (
            <Button
              label="Cancelar reserva"
              variant="danger"
              onPress={() => setConfirmCancel(true)}
              disabled={busy}
              leftIcon={<Feather name="x-circle" size={16} color={Colors.accentDanger} />}
            />
          )}
          {busy && (
            <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: Spacing[2] }} />
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={performCancel}
        title="Cancelar reserva"
        description="Marcar esta reserva como CANCELADA? El cliente sera notificado."
        confirmLabel="Cancelar reserva"
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={14} color={Colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Kicker style={{ fontSize: 10 }}>{label}</Kicker>
        <Body
          size="sm"
          weight="semiBold"
          style={mono ? [{ marginTop: 2 }, styles.mono] : { marginTop: 2 }}
        >
          {value}
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
  },
  mono: { fontFamily: 'monospace', letterSpacing: 2 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing[2],
  },
  userRow: { flexDirection: 'row', gap: Spacing[3], alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center', paddingVertical: 6 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
