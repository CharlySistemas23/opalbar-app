import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { reservationsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

const STATUS_META: Record<string, { bg: string; color: string; labelEs: string; labelEn: string }> = {
  PENDING:    { bg: 'rgba(244,163,64,0.15)',   color: '#F4A340', labelEs: 'Pendiente',  labelEn: 'Pending'    },
  CONFIRMED:  { bg: 'rgba(56,199,147,0.15)',   color: '#38C793', labelEs: 'Confirmada', labelEn: 'Confirmed'  },
  COMPLETED:  { bg: 'rgba(96,165,250,0.15)',   color: '#60A5FA', labelEs: 'Completada', labelEn: 'Completed'  },
  CANCELLED:  { bg: 'rgba(228,88,88,0.15)',    color: '#E45858', labelEs: 'Cancelada',  labelEn: 'Cancelled'  },
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
    reservationsApi.get(id)
      .then((r) => setReservation(r.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  function handleCancel() {
    setShowCancel(true);
  }

  async function confirmCancel() {
    setCancelling(true);
    try {
      await reservationsApi.cancel(id);
      setReservation((r: any) => r ? { ...r, status: 'CANCELLED', cancelledAt: new Date().toISOString() } : r);
      setShowCancel(false);
    } catch (err: any) {
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally { setCancelling(false); }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  }
  if (!reservation) {
    return (
      <View style={styles.center}>
        <Feather name="calendar" size={48} color={Colors.textMuted} />
        <Text style={styles.notFound}>{t ? 'Reservación no encontrada' : 'Reservation not found'}</Text>
      </View>
    );
  }

  const meta = STATUS_META[reservation.status] ?? STATUS_META.PENDING;
  const showQr = reservation.status === 'CONFIRMED' || reservation.status === 'PENDING';
  const dateStr = reservation.date
    ? new Date(reservation.date).toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const canCancel = reservation.status === 'PENDING' || reservation.status === 'CONFIRMED';
  const shortCode = (reservation.confirmCode || '').slice(-8).toUpperCase();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Reservación' : 'Reservation'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
          <Text style={[styles.statusText, { color: meta.color }]}>
            {t ? meta.labelEs : meta.labelEn}
          </Text>
        </View>

        {showQr && (
          <View style={styles.qrCard}>
            <Text style={styles.qrHeadline}>
              {t ? 'Muestra este código al llegar' : 'Show this code at arrival'}
            </Text>
            <View style={styles.qrBox}>
              <QRCode
                value={reservation.confirmCode}
                size={220}
                backgroundColor="#FFFFFF"
                color="#0D0D0F"
              />
            </View>
            <Text style={styles.qrCode}>{shortCode}</Text>
            <Text style={styles.qrHint}>
              {t
                ? 'El staff escaneará este QR para confirmar tu entrada.'
                : 'Staff will scan this QR to confirm your arrival.'}
            </Text>
            <TouchableOpacity
              style={styles.qrExpandBtn}
              onPress={() => router.push(`/(app)/reservations/${reservation.id}/qr` as never)}
              activeOpacity={0.85}
            >
              <Feather name="maximize-2" size={14} color={Colors.accentPrimary} />
              <Text style={styles.qrExpandLbl}>{t ? 'Ver a pantalla completa' : 'View full screen'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {reservation.seatedAt && (
          <View style={styles.seatedBadge}>
            <Feather name="check-circle" size={18} color={Colors.accentSuccess} />
            <Text style={styles.seatedText}>
              {t ? 'Registrado en el lugar' : 'Checked-in at venue'}
            </Text>
          </View>
        )}

        <View style={styles.detailsCard}>
          <Row label={t ? 'Venue' : 'Venue'} value={reservation.venue?.name ?? '—'} icon="home" />
          <Row label={t ? 'Fecha' : 'Date'} value={dateStr} icon="calendar" />
          <Row label={t ? 'Hora' : 'Time'} value={reservation.timeSlot ?? '—'} icon="clock" />
          <Row label={t ? 'Personas' : 'Guests'} value={String(reservation.partySize ?? 1)} icon="users" />
          {reservation.specialRequests ? (
            <Row label={t ? 'Notas' : 'Notes'} value={reservation.specialRequests} icon="file-text" />
          ) : null}
        </View>

        {canCancel && (
          <TouchableOpacity
            style={styles.modifyBtn}
            onPress={() => router.push(`/(app)/reservations/${reservation.id}/modify` as never)}
            activeOpacity={0.85}
          >
            <Feather name="edit-3" size={16} color={Colors.accentPrimary} />
            <Text style={styles.modifyLabel}>{t ? 'Modificar reserva' : 'Modify reservation'}</Text>
          </TouchableOpacity>
        )}

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.85}
          >
            {cancelling
              ? <ActivityIndicator color={Colors.accentDanger} size="small" />
              : <>
                  <Feather name="x-circle" size={16} color={Colors.accentDanger} />
                  <Text style={styles.cancelLabel}>{t ? 'Cancelar reservación' : 'Cancel reservation'}</Text>
                </>}
          </TouchableOpacity>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={showCancel}
        onClose={() => setShowCancel(false)}
        icon="x-circle"
        variant="danger"
        title={t ? 'Cancelar reservación' : 'Cancel reservation'}
        message={t
          ? 'La mesa se liberará para otros clientes. Esta acción no se puede deshacer.'
          : "The table will be released. This can't be undone."}
        confirmLabel={t ? 'Sí, cancelar' : 'Yes, cancel'}
        loading={cancelling}
        onConfirm={confirmCancel}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={16} color={Colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary, gap: 12 },
  notFound: { color: Colors.textSecondary, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  content: { padding: 20, gap: 16, paddingBottom: 40 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },

  qrCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrHeadline: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  qrBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  qrCode: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qrHint: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  qrExpandBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    marginTop: 8,
    backgroundColor: 'rgba(244,163,64,0.15)',
    borderRadius: 10,
  },
  qrExpandLbl: { color: Colors.accentPrimary, fontSize: 12, fontWeight: '700' },

  seatedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(56,199,147,0.1)',
    borderWidth: 1, borderColor: 'rgba(56,199,147,0.3)',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
  },
  seatedText: { color: Colors.accentSuccess, fontSize: 13, fontWeight: '600' },

  detailsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    alignItems: 'center',
  },
  rowIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { color: Colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 2 },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(228,88,88,0.08)',
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.25)',
    marginTop: 8,
  },
  cancelLabel: { color: Colors.accentDanger, fontSize: 14, fontWeight: '700' },
  modifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 14,
    backgroundColor: 'rgba(244,163,64,0.1)',
    borderWidth: 1, borderColor: 'rgba(244,163,64,0.3)',
    marginBottom: 10,
  },
  modifyLabel: { color: Colors.accentPrimary, fontSize: 14, fontWeight: '700' },
});
