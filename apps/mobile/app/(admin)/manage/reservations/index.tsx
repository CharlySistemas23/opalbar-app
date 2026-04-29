import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, venueApi } from '@/api/client';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';
import { UserPicker, type PickedUser } from '@/components/admin/UserPicker';

type Filter = 'all' | 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED';

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: 'rgba(244,163,64,0.15)', color: Colors.accentPrimary, label: 'PENDIENTE' },
  CONFIRMED: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'CONFIRMADA' },
  SEATED:    { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA', label: 'EN MESA' },
  COMPLETED: { bg: 'rgba(168,85,247,0.15)', color: '#A855F7', label: 'COMPLETADA' },
  CANCELLED: { bg: 'rgba(228,88,88,0.15)', color: Colors.accentDanger, label: 'CANCELADA' },
};

export default function AdminReservationsList() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  // Crear reserva manual
  const [creating, setCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<PickedUser | null>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [draft, setDraft] = useState({ venueId: '', date: '', timeSlot: '20:00', partySize: '2', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (creating && venues.length === 0) {
      venueApi.list({ limit: 50 }).then((r) => {
        const list = r.data?.data?.data ?? r.data?.data ?? r.data ?? [];
        setVenues(Array.isArray(list) ? list : []);
        if (list.length && !draft.venueId) setDraft((d) => ({ ...d, venueId: list[0].id }));
      }).catch(() => {});
    }
  }, [creating]);

  async function submitReservation() {
    if (!picked || !draft.venueId || !draft.date || !draft.timeSlot || !draft.partySize) {
      Alert.alert('Faltan datos', 'Cliente, venue, fecha, hora y personas son requeridos.');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createReservation({
        userId: picked.id,
        venueId: draft.venueId,
        date: draft.date,
        timeSlot: draft.timeSlot,
        partySize: Number(draft.partySize),
        notes: draft.notes.trim() || undefined,
      });
      setCreating(false); setPicked(null);
      setDraft({ venueId: venues[0]?.id ?? '', date: '', timeSlot: '20:00', partySize: '2', notes: '' });
      load();
      Alert.alert('Reserva creada', 'Quedó CONFIRMADA. El cliente fue notificado.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo crear');
    } finally { setSubmitting(false); }
  }

  const load = useCallback(async () => {
    try {
      const r = await adminApi.reservations({ limit: 100 });
      setRows(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [rows]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Reservaciones</Text>
        <TouchableOpacity
          style={styles.configBtn}
          onPress={() => setCreating(true)}
          hitSlop={10}
        >
          <Feather name="plus" size={20} color={Colors.accentPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.configBtn}
          onPress={() => router.push('/(admin)/manage/reservations/config' as never)}
          hitSlop={10}
        >
          <Feather name="sliders" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <Tab active={filter === 'all'} label={`Todas (${rows.length})`} onPress={() => setFilter('all')} />
        <Tab active={filter === 'PENDING'} label={`Pendiente (${counts.PENDING ?? 0})`} onPress={() => setFilter('PENDING')} />
        <Tab active={filter === 'CONFIRMED'} label={`Confirmada (${counts.CONFIRMED ?? 0})`} onPress={() => setFilter('CONFIRMED')} />
        <Tab active={filter === 'SEATED'} label={`En mesa (${counts.SEATED ?? 0})`} onPress={() => setFilter('SEATED')} />
        <Tab active={filter === 'CANCELLED'} label={`Canceladas (${counts.CANCELLED ?? 0})`} onPress={() => setFilter('CANCELLED')} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="home" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Sin reservaciones en esta categoría.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.PENDING;
            const user = item.user;
            const name = `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || user?.email || 'Usuario';
            const dateStr = item.date
              ? new Date(item.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })
              : '';
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/(admin)/manage/reservations/${item.id}` as never)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{name[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
                    <Text style={styles.cardMeta}>
                      {dateStr} · {item.timeSlot} · {item.partySize} pers.
                    </Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {item.specialRequests ? (
                  <Text style={styles.notes} numberOfLines={2}>🗒 {item.specialRequests}</Text>
                ) : null}
                {item.event ? (
                  <View style={styles.eventBadge}>
                    <Feather name="star" size={11} color="#A855F7" />
                    <Text style={styles.eventText} numberOfLines={1}>
                      Evento: {item.event.title}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal: Nueva reserva manual */}
      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <View style={mStyles.backdrop}>
          <View style={mStyles.sheet}>
            <View style={mStyles.header}>
              <Text style={mStyles.title}>Nueva reserva manual</Text>
              <TouchableOpacity onPress={() => setCreating(false)} hitSlop={10}>
                <Feather name="x" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
              {/* Cliente */}
              <Text style={mStyles.lbl}>Cliente</Text>
              {picked ? (
                <TouchableOpacity onPress={() => setPickerOpen(true)} style={mStyles.pickedRow}>
                  <Feather name="user" size={14} color={Colors.accentSuccess} />
                  <Text style={mStyles.pickedTxt} numberOfLines={1}>
                    {`${picked.profile?.firstName ?? ''} ${picked.profile?.lastName ?? ''}`.trim() || picked.email}
                  </Text>
                  <Text style={mStyles.changeTxt}>cambiar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setPickerOpen(true)} style={mStyles.pickerBtn}>
                  <Feather name="search" size={14} color={Colors.textMuted} />
                  <Text style={mStyles.pickerBtnTxt}>Buscar usuario…</Text>
                </TouchableOpacity>
              )}

              {/* Venue */}
              <Text style={[mStyles.lbl, { marginTop: 14 }]}>Venue</Text>
              <View style={mStyles.chipRow}>
                {venues.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setDraft({ ...draft, venueId: v.id })}
                    style={[mStyles.chip, draft.venueId === v.id && mStyles.chipActive]}
                  >
                    <Text style={[mStyles.chipTxt, draft.venueId === v.id && mStyles.chipTxtActive]}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fecha */}
              <Text style={[mStyles.lbl, { marginTop: 14 }]}>Fecha (YYYY-MM-DD)</Text>
              <TextInput
                value={draft.date}
                onChangeText={(v) => setDraft({ ...draft, date: v })}
                placeholder="2026-05-15"
                placeholderTextColor={Colors.textMuted}
                style={mStyles.input}
              />

              {/* Hora + personas */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[mStyles.lbl, { marginTop: 14 }]}>Hora</Text>
                  <TextInput
                    value={draft.timeSlot}
                    onChangeText={(v) => setDraft({ ...draft, timeSlot: v })}
                    placeholder="20:00"
                    placeholderTextColor={Colors.textMuted}
                    style={mStyles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[mStyles.lbl, { marginTop: 14 }]}>Personas</Text>
                  <TextInput
                    value={draft.partySize}
                    onChangeText={(v) => setDraft({ ...draft, partySize: v.replace(/[^0-9]/g, '') })}
                    keyboardType="number-pad"
                    placeholder="2"
                    placeholderTextColor={Colors.textMuted}
                    style={mStyles.input}
                  />
                </View>
              </View>

              {/* Notas */}
              <Text style={[mStyles.lbl, { marginTop: 14 }]}>Notas (opcional)</Text>
              <TextInput
                value={draft.notes}
                onChangeText={(v) => setDraft({ ...draft, notes: v })}
                placeholder="Pedido especial, mesa preferida…"
                placeholderTextColor={Colors.textMuted}
                multiline
                style={[mStyles.input, { minHeight: 60 }]}
              />
            </ScrollView>

            <View style={mStyles.actions}>
              <TouchableOpacity style={[mStyles.btn, mStyles.btnGhost]} onPress={() => setCreating(false)}>
                <Text style={mStyles.btnGhostLbl}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mStyles.btn, mStyles.btnPrimary, (submitting || !picked) && { opacity: 0.5 }]}
                onPress={submitReservation}
                disabled={submitting || !picked}
              >
                <Text style={mStyles.btnPrimaryLbl}>{submitting ? 'Creando…' : 'Crear reserva'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <UserPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(u) => setPicked(u)}
        title="Buscar cliente"
      />
    </SafeAreaView>
  );
}

function Tab({ active, label, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  configBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  tabs: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, flexWrap: 'wrap',
  },
  tab: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 13 },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  notes: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16 },
  eventBadge: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderRadius: 6, alignSelf: 'flex-start',
  },
  eventText: { color: '#A855F7', fontSize: 11, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});

const mStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.bgElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  lbl: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.textPrimary, fontSize: 14,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
  },
  pickerBtnTxt: { color: Colors.textMuted, fontSize: 14 },
  pickedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(56,199,147,0.10)',
    borderWidth: 1, borderColor: 'rgba(56,199,147,0.30)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
  },
  pickedTxt: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  changeTxt: { color: Colors.textMuted, fontSize: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderStrong },
  chipActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  chipTxt: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  chipTxtActive: { color: '#000' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderStrong },
  btnGhostLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  btnPrimary: { backgroundColor: Colors.accentPrimary },
  btnPrimaryLbl: { color: '#000', fontSize: 14, fontWeight: '700' },
});
