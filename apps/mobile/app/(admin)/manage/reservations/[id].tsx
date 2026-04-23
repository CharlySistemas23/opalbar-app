import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { apiClient, reservationsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: 'rgba(244,163,64,0.15)', color: Colors.accentPrimary, label: 'PENDIENTE' },
  CONFIRMED: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'CONFIRMADA' },
  SEATED:    { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA', label: 'EN MESA' },
  COMPLETED: { bg: 'rgba(168,85,247,0.15)', color: '#A855F7', label: 'COMPLETADA' },
  CANCELLED: { bg: 'rgba(228,88,88,0.15)', color: Colors.accentDanger, label: 'CANCELADA' },
};

export default function AdminReservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
    } finally { setBusy(false); }
  }

  function confirmAction(label: string, status: string, destructive?: boolean) {
    Alert.alert(label, `¿Marcar como ${status}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: label, style: destructive ? 'destructive' : 'default', onPress: () => changeStatus(status) },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (!res) return <View style={styles.center}><Text style={{ color: Colors.textMuted }}>Reserva no encontrada</Text></View>;

  const meta = STATUS_META[res.status] ?? STATUS_META.PENDING;
  const user = res.user;
  const name = `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || 'Usuario';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Reserva</Text>
        <View style={[styles.pill, { backgroundColor: meta.bg }]}>
          <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 14 }}>
        <View style={styles.card}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{name}</Text>
              <Text style={styles.userMeta}>{user?.email}</Text>
              {user?.phone && <Text style={styles.userMeta}>{user.phone}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Row icon="calendar" label="Fecha" value={res.date ? new Date(res.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} />
          <Row icon="clock" label="Horario" value={res.timeSlot ?? '—'} />
          <Row icon="users" label="Personas" value={String(res.partySize ?? 1)} />
          <Row icon="home" label="Venue" value={res.venue?.name ?? '—'} />
          {res.event && <Row icon="star" label="Evento" value={res.event.title} />}
          <Row icon="hash" label="Código" value={(res.confirmCode ?? '').slice(-8).toUpperCase()} mono />
        </View>

        {res.specialRequests && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>NOTAS DEL CLIENTE</Text>
            <Text style={styles.notes}>{res.specialRequests}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ACCIONES</Text>
          {res.status === 'PENDING' && (
            <TouchableOpacity style={styles.confirmBtn} onPress={() => changeStatus('CONFIRMED')} disabled={busy}>
              <Feather name="check-circle" size={16} color={Colors.textInverse} />
              <Text style={styles.confirmLbl}>Confirmar reserva</Text>
            </TouchableOpacity>
          )}
          {(res.status === 'PENDING' || res.status === 'CONFIRMED') && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => changeStatus('SEATED')} disabled={busy}>
              <Feather name="user-check" size={16} color={Colors.textInverse} />
              <Text style={styles.primaryLbl}>Marcar en mesa</Text>
            </TouchableOpacity>
          )}
          {res.status === 'SEATED' && (
            <TouchableOpacity style={styles.completeBtn} onPress={() => changeStatus('COMPLETED')} disabled={busy}>
              <Feather name="flag" size={16} color={Colors.textInverse} />
              <Text style={styles.primaryLbl}>Marcar completada</Text>
            </TouchableOpacity>
          )}
          {res.status !== 'CANCELLED' && res.status !== 'COMPLETED' && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => confirmAction('Cancelar', 'CANCELLED', true)} disabled={busy}>
              <Feather name="x-circle" size={16} color={Colors.accentDanger} />
              <Text style={styles.cancelLbl}>Cancelar reserva</Text>
            </TouchableOpacity>
          )}
          {busy && <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 8 }} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, mono }: any) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={14} color={Colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, mono && { fontFamily: 'monospace', letterSpacing: 2 }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  userRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 15 },
  userName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  userMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  row: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 },
  rowIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  rowValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 2 },

  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  notes: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12, backgroundColor: Colors.accentSuccess,
  },
  confirmLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12, backgroundColor: Colors.accentPrimary,
  },
  primaryLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12, backgroundColor: '#A855F7',
  },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  cancelLbl: { color: Colors.accentDanger, fontSize: 14, fontWeight: '700' },
});
