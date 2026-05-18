// ─────────────────────────────────────────────
//  Reservation Detail — Editorial Premium
//
//  Kicker (status) + Display (venue), an editorial QR card (kicker +
//  short code + caption), then a hairline-divided details block.
//  Secondary actions live below as ghost buttons; danger gets a danger
//  button.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import {
  Badge,
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Kicker,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { reservationsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useAppStore } from '@/stores/app.store';

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; es: string; en: string }> = {
  PENDING:   { variant: 'warning', es: 'Pendiente',  en: 'Pending'   },
  CONFIRMED: { variant: 'success', es: 'Confirmada', en: 'Confirmed' },
  COMPLETED: { variant: 'info',    es: 'Completada', en: 'Completed' },
  CANCELLED: { variant: 'danger',  es: 'Cancelada',  en: 'Cancelled' },
};

export default function ReservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    reservationsApi
      .get(id)
      .then((r) => setReservation(r.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function confirmCancel() {
    setCancelling(true);
    try {
      await reservationsApi.cancel(id);
      setReservation((r: any) =>
        r ? { ...r, status: 'CANCELLED', cancelledAt: new Date().toISOString() } : r,
      );
      setShowCancel(false);
    } catch (err: any) {
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.headerRow}>
          <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} />
        </View>
        <View style={styles.body}>
          <Skeleton width="40%" height={12} />
          <View style={{ height: Spacing[3] }} />
          <Skeleton width="80%" height={36} />
          <View style={{ height: Spacing[6] }} />
          <Skeleton width="100%" height={260} radius={Radius.lg} />
        </View>
      </SafeAreaView>
    );
  }

  if (!reservation) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
        <Feather name="calendar" size={36} color={Colors.textMuted} />
        <Body tone="secondary" style={{ marginTop: Spacing[3] }}>
          {t ? 'Reservación no encontrada' : 'Reservation not found'}
        </Body>
      </SafeAreaView>
    );
  }

  const status = STATUS_BADGE[reservation.status] ?? STATUS_BADGE.PENDING;
  const showQr = reservation.status === 'CONFIRMED' || reservation.status === 'PENDING';
  const dateStr = reservation.date
    ? new Date(reservation.date).toLocaleDateString(language, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—';
  const canCancel = reservation.status === 'PENDING' || reservation.status === 'CONFIRMED';
  const shortCode = (reservation.confirmCode || '').slice(-8).toUpperCase();
  const venueName = reservation.venue?.name ?? '—';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
            <Kicker tone="champagne">{t ? 'RESERVA' : 'RESERVATION'}</Kicker>
            <Badge label={status[language]} variant={status.variant} size="sm" />
          </View>
        </FadeIn>

        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Display size="md">{venueName}</Display>
        </FadeIn>

        {reservation.seatedAt ? (
          <FadeIn delay={120} style={styles.seatedRow}>
            <Feather name="check-circle" size={14} color={Colors.accentSuccess} />
            <Caption tone="success">
              {t ? 'Registrado en el lugar' : 'Checked-in at venue'}
            </Caption>
          </FadeIn>
        ) : null}

        {showQr ? (
          <FadeIn delay={180} style={styles.qrCard}>
            <Kicker tone="champagne">
              {t ? 'PRESENTA AL LLEGAR' : 'SHOW ON ARRIVAL'}
            </Kicker>
            <View style={styles.qrBox}>
              <QRCode
                value={reservation.confirmCode}
                size={200}
                backgroundColor="#FFFFFF"
                color="#0D0D0F"
              />
            </View>
            <Subhead align="center" style={styles.qrCode}>
              {shortCode}
            </Subhead>
            <Caption tone="muted" align="center" style={{ marginTop: Spacing[2] }}>
              {t
                ? 'El staff escaneará este QR para confirmar tu entrada.'
                : 'Staff will scan this QR to confirm your arrival.'}
            </Caption>
            <Pressy
              onPress={() =>
                router.push(`/(app)/reservations/${reservation.id}/qr` as never)
              }
              accessibilityLabel={t ? 'Ver a pantalla completa' : 'View full screen'}
              hitSlop={HitSlop.expand}
              haptic="select"
              style={styles.qrExpand}
            >
              <Feather name="maximize-2" size={14} color={Colors.accentPrimary} />
              <Caption tone="accent" style={{ marginLeft: Spacing[2], fontWeight: '600' }}>
                {t ? 'Ver a pantalla completa' : 'View full screen'}
              </Caption>
            </Pressy>
          </FadeIn>
        ) : null}

        {/* Details ───────────────────────── */}
        <FadeIn delay={260} style={{ marginTop: Spacing[8] }}>
          <Hairline variant="normal" />
          <DetailRow kicker={t ? 'VENUE' : 'VENUE'} value={venueName} />
          <Hairline variant="subtle" />
          <DetailRow kicker={t ? 'FECHA' : 'DATE'} value={dateStr} />
          <Hairline variant="subtle" />
          <DetailRow kicker={t ? 'HORA' : 'TIME'} value={reservation.timeSlot ?? '—'} />
          <Hairline variant="subtle" />
          <DetailRow
            kicker={t ? 'PERSONAS' : 'GUESTS'}
            value={String(reservation.partySize ?? 1)}
          />
          {reservation.specialRequests ? (
            <>
              <Hairline variant="subtle" />
              <DetailRow
                kicker={t ? 'NOTAS' : 'NOTES'}
                value={reservation.specialRequests}
              />
            </>
          ) : null}
          <Hairline variant="normal" />
        </FadeIn>

        {/* Actions ───────────────────────── */}
        {canCancel ? (
          <FadeIn delay={340} style={{ marginTop: Spacing[6], gap: Spacing[3] }}>
            <Button
              label={t ? 'Modificar reserva' : 'Modify reservation'}
              onPress={() =>
                router.push(`/(app)/reservations/${reservation.id}/modify` as never)
              }
              variant="secondary"
              size="lg"
              leftIcon={<Feather name="edit-3" size={16} color={Colors.textPrimary} />}
            />
            <Button
              label={t ? 'Cancelar reservación' : 'Cancel reservation'}
              onPress={() => setShowCancel(true)}
              loading={cancelling}
              variant="danger"
              size="lg"
              leftIcon={<Feather name="x-circle" size={16} color={Colors.accentDanger} />}
            />
          </FadeIn>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={showCancel}
        onClose={() => setShowCancel(false)}
        icon="x-circle"
        variant="danger"
        title={t ? 'Cancelar reservación' : 'Cancel reservation'}
        message={
          t
            ? 'La mesa se liberará para otros clientes. Esta acción no se puede deshacer.'
            : "The table will be released. This can't be undone."
        }
        confirmLabel={t ? 'Sí, cancelar' : 'Yes, cancel'}
        loading={cancelling}
        onConfirm={confirmCancel}
      />
    </SafeAreaView>
  );
}

function DetailRow({ kicker, value }: { kicker: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Kicker tone="muted" style={{ width: 110 }}>
        {kicker}
      </Kicker>
      <Body size="md" tone="primary" style={{ flex: 1 }}>
        {value}
      </Body>
    </View>
  );
}

function BackBtn({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressy
      onPress={onPress}
      accessibilityRole={Roles.button}
      accessibilityLabel={label}
      hitSlop={HitSlop.expand}
      style={styles.backBtn}
    >
      <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
    </Pressy>
  );
}

void Platform;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },

  headerRow: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },

  body: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[10],
  },

  seatedRow: {
    marginTop: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },

  qrCard: {
    marginTop: Spacing[6],
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[6],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  qrBox: {
    marginTop: Spacing[4],
    padding: Spacing[4],
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
  },
  qrCode: {
    marginTop: Spacing[4],
    letterSpacing: 4,
  },
  qrExpand: {
    marginTop: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[2],
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing[4],
    gap: Spacing[3],
  },
});
