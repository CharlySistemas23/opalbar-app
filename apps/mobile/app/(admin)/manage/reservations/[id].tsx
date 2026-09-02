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
import { adminApi, reservationsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useFeedback } from '@/hooks/useFeedback';
import { toast } from '@/components/Toast';
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
import { ErrorState } from '@/components/ErrorState';
import { AdminHeader, StatusPill } from '@/components/admin';

type ResStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

const STATUS_TONE: Record<
  string,
  { tone: 'accent' | 'success' | 'info' | 'neutral' | 'danger'; label: string }
> = {
  PENDING: { tone: 'accent', label: 'PENDIENTE' },
  CONFIRMED: { tone: 'success', label: 'CONFIRMADA' },
  SEATED: { tone: 'info', label: 'EN MESA' },
  COMPLETED: { tone: 'neutral', label: 'COMPLETADA' },
  CANCELLED: { tone: 'danger', label: 'CANCELADA' },
  NO_SHOW: { tone: 'danger', label: 'NO SE PRESENTÓ' },
};

// Mirrors RESERVATION_TRANSITIONS in apps/api/.../reservations.service.ts —
// offering a status the backend won't allow from the current one (e.g. SEATED
// straight from PENDING) just 400s. Terminal states offer nothing further.
const RESERVATION_TRANSITIONS: Record<ResStatus, ResStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
  SEATED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const ACTION_META: Record<
  ResStatus,
  { label: string; icon: React.ComponentProps<typeof Feather>['name']; variant: 'primary' | 'secondary' | 'danger'; confirm?: boolean }
> = {
  PENDING: { label: 'Volver a pendiente', icon: 'rotate-ccw', variant: 'secondary' },
  CONFIRMED: { label: 'Confirmar reserva', icon: 'check-circle', variant: 'primary' },
  SEATED: { label: 'Marcar en mesa', icon: 'user-check', variant: 'secondary' },
  COMPLETED: { label: 'Marcar completada', icon: 'flag', variant: 'primary' },
  CANCELLED: { label: 'Cancelar reserva', icon: 'x-circle', variant: 'danger', confirm: true },
  NO_SHOW: { label: 'Marcar no se presentó', icon: 'user-x', variant: 'danger', confirm: true },
};

export default function AdminReservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useSafeBack('/(admin)/manage/reservations');
  const fb = useFeedback();
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ResStatus | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await reservationsApi.get(id);
      setRes(r.data?.data);
    } catch (err) {
      setError(apiError(err));
    } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function changeStatus(status: ResStatus) {
    setBusy(true);
    try {
      await adminApi.updateReservationStatus(id, status);
      fb.success();
      toast('Estado actualizado', 'success');
      await load();
    } catch (err) {
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function performConfirmedAction() {
    const target = confirmTarget;
    setConfirmTarget(null);
    if (target) await changeStatus(target);
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  if (error && !res)
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <AdminHeader title="Reserva" kicker="Detalle" onBack={goBack} />
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      </SafeAreaView>
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
            label="CÓDIGO"
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
          {(RESERVATION_TRANSITIONS[res.status as ResStatus] ?? []).map((target) => {
            const meta = ACTION_META[target];
            return (
              <Button
                key={target}
                label={meta.label}
                variant={meta.variant}
                onPress={() => (meta.confirm ? setConfirmTarget(target) : changeStatus(target))}
                disabled={busy}
                leftIcon={<Feather name={meta.icon} size={16} color={meta.variant === 'primary' ? Colors.textInverse : meta.variant === 'danger' ? Colors.accentDanger : Colors.textPrimary} />}
              />
            );
          })}
          {(RESERVATION_TRANSITIONS[res.status as ResStatus] ?? []).length === 0 && (
            <Caption tone="muted">Esta reserva está en un estado final — no admite más cambios.</Caption>
          )}
          {busy && (
            <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: Spacing[2] }} />
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={performConfirmedAction}
        title={confirmTarget ? ACTION_META[confirmTarget].label : ''}
        description={
          confirmTarget === 'NO_SHOW'
            ? '¿Marcar esta reserva como NO SE PRESENTÓ? Esta acción no se puede deshacer.'
            : '¿Marcar esta reserva como CANCELADA? El cliente será notificado.'
        }
        confirmLabel={confirmTarget ? ACTION_META[confirmTarget].label : 'Confirmar'}
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
