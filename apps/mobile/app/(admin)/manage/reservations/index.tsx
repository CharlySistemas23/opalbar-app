import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Button,
  Caption,
  Input,
  Kicker,
  Sheet,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { AdminHeader, StatusPill } from '@/components/admin';
import { UserPicker, type PickedUser } from '@/components/admin/UserPicker';

type Filter = 'all' | 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

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

const PAGE = 20;

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
  const [draft, setDraft] = useState({
    venueId: '',
    date: '',
    timeSlot: '20:00',
    partySize: '2',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (creating && venues.length === 0) {
      // Admin endpoint — includes deactivated venues too, unlike the public
      // list (which would silently make a paused venue unreachable here).
      adminApi
        .venues()
        .then((r) => {
          const all = r.data?.data ?? r.data ?? [];
          // Only active venues make sense to book a table at.
          const list = (Array.isArray(all) ? all : []).filter((v: any) => v.isActive !== false);
          setVenues(list);
          if (list.length && !draft.venueId) setDraft((d) => ({ ...d, venueId: list[0].id }));
        })
        .catch(() => {});
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
      setCreating(false);
      setPicked(null);
      setDraft({ venueId: venues[0]?.id ?? '', date: '', timeSlot: '20:00', partySize: '2', notes: '' });
      load();
      Alert.alert('Reserva creada', 'Quedó CONFIRMADA. El cliente fue notificado.');
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const [meta, setMeta] = useState<{ page: number; hasNextPage: boolean; total: number }>({ page: 1, hasNextPage: false, total: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const params = useCallback(
    (page: number) => ({ page, limit: PAGE, ...(filter !== 'all' ? { status: filter } : {}) }),
    [filter],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const id = ++reqId.current;
      if (!opts?.silent) { setLoading(true); setError(null); }
      try {
        const r = await adminApi.reservations(params(1));
        if (id !== reqId.current) return;
        const payload = r.data?.data;
        setRows(payload?.data ?? []);
        setMeta({
          page: payload?.meta?.page ?? 1,
          hasNextPage: !!payload?.meta?.hasNextPage,
          total: payload?.meta?.total ?? payload?.data?.length ?? 0,
        });
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(apiError(err));
      } finally {
        if (id === reqId.current) { setLoading(false); setRefreshing(false); }
      }
    },
    [params],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function loadMore() {
    if (loadingMore || loading || !meta.hasNextPage) return;
    setLoadingMore(true);
    try {
      const r = await adminApi.reservations(params(meta.page + 1));
      const payload = r.data?.data;
      const next: any[] = payload?.data ?? [];
      setRows((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...next.filter((x) => !seen.has(x.id))];
      });
      setMeta({
        page: payload?.meta?.page ?? meta.page + 1,
        hasNextPage: !!payload?.meta?.hasNextPage,
        total: payload?.meta?.total ?? meta.total,
      });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const shown = rows;

  const tabs: { value: Filter; label: string }[] = [
    { value: 'all', label: `Todas (${meta.total})` },
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'CONFIRMED', label: 'Confirmada' },
    { value: 'SEATED', label: 'En mesa' },
    { value: 'COMPLETED', label: 'Completada' },
    { value: 'CANCELLED', label: 'Cancelada' },
    { value: 'NO_SHOW', label: 'No se presentó' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Reservaciones"
        kicker="Gestión"
        onBack={goBack}
        right={
          <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
            <Pressable
              onPress={() => setCreating(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Nueva reserva"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Feather name="plus" size={16} color={Colors.accentPrimary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(admin)/manage/reservations/config' as never)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Configuración"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Feather name="sliders" size={16} color={Colors.textPrimary} />
            </Pressable>
          </View>
        }
      />

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => setFilter(t.value)}
            style={({ pressed }) => [
              styles.tab,
              filter === t.value && styles.tabActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: filter === t.value }}
          >
            <Kicker
              style={[
                { fontSize: 10 },
                filter === t.value ? { color: Colors.textInverse } : { color: Colors.textMuted },
              ]}
            >
              {t.label}
            </Kicker>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120, gap: Spacing[2] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={Colors.accentPrimary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <EmptyState icon="home" title="Sin reservaciones" message="Sin reservaciones en esta categoría." />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: Spacing[4] }}>
                <ActivityIndicator color={Colors.accentPrimary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const meta = STATUS_TONE[item.status] ?? STATUS_TONE.PENDING;
            const user = item.user;
            const name =
              `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() ||
              user?.email ||
              'Usuario';
            const dateStr = item.date
              ? new Date(item.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })
              : '';
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => router.push(`/(admin)/manage/reservations/${item.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`Reserva de ${name}, ${dateStr}`}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Body weight="bold" tone="inverse">
                      {name[0]?.toUpperCase() ?? '?'}
                    </Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Subhead numberOfLines={1}>{name}</Subhead>
                    <Caption tone="muted" style={{ marginTop: 2 }}>
                      {dateStr} · {item.timeSlot} · {item.partySize} pers.
                    </Caption>
                  </View>
                  <StatusPill label={meta.label} tone={meta.tone} />
                </View>
                {item.specialRequests ? (
                  <Caption tone="secondary" numberOfLines={2} style={{ marginTop: Spacing[2] }}>
                    {item.specialRequests}
                  </Caption>
                ) : null}
                {item.event ? (
                  <View style={styles.eventBadge}>
                    <Feather name="star" size={11} color={Colors.accentPrimary} />
                    <Caption tone="accent" size="sm" numberOfLines={1}>
                      Evento: {item.event.title}
                    </Caption>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Nueva reserva manual"
      >
        <View style={{ gap: Spacing[3] }}>
          <View>
            <Kicker style={{ marginBottom: 6 }}>Cliente</Kicker>
            {picked ? (
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={styles.pickedRow}
                accessibilityRole="button"
                accessibilityLabel="Cambiar cliente"
              >
                <Feather name="user" size={14} color={Colors.accentSuccess} />
                <Body size="sm" weight="semiBold" style={{ flex: 1 }} numberOfLines={1}>
                  {`${picked.profile?.firstName ?? ''} ${picked.profile?.lastName ?? ''}`.trim() ||
                    picked.email}
                </Body>
                <Caption tone="muted" size="sm">cambiar</Caption>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={styles.pickerBtn}
                accessibilityRole="button"
                accessibilityLabel="Buscar usuario"
              >
                <Feather name="search" size={14} color={Colors.textMuted} />
                <Caption tone="muted">Buscar usuario...</Caption>
              </Pressable>
            )}
          </View>

          <View>
            <Kicker style={{ marginBottom: 6 }}>Venue</Kicker>
            <View style={styles.chipRow}>
              {venues.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setDraft({ ...draft, venueId: v.id })}
                  style={[styles.chip, draft.venueId === v.id && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityLabel={v.name}
                  accessibilityState={{ selected: draft.venueId === v.id }}
                >
                  <Kicker
                    style={[
                      { fontSize: 10 },
                      draft.venueId === v.id
                        ? { color: Colors.textInverse }
                        : { color: Colors.textSecondary },
                    ]}
                  >
                    {v.name}
                  </Kicker>
                </Pressable>
              ))}
            </View>
          </View>

          <Input
            label="Fecha (YYYY-MM-DD)"
            value={draft.date}
            onChangeText={(v) => setDraft({ ...draft, date: v })}
            placeholder="2026-05-15"
          />

          <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Hora"
                value={draft.timeSlot}
                onChangeText={(v) => setDraft({ ...draft, timeSlot: v })}
                placeholder="20:00"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Personas"
                value={draft.partySize}
                onChangeText={(v) => setDraft({ ...draft, partySize: v.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                placeholder="2"
              />
            </View>
          </View>

          <Input
            label="Notas (opcional)"
            value={draft.notes}
            onChangeText={(v) => setDraft({ ...draft, notes: v })}
            placeholder="Pedido especial, mesa preferida..."
            multiline
            style={{ minHeight: 60 }}
          />

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancelar"
                variant="secondary"
                onPress={() => setCreating(false)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={submitting ? 'Creando...' : 'Crear reserva'}
                variant="primary"
                onPress={submitReservation}
                loading={submitting}
                disabled={submitting || !picked}
              />
            </View>
          </View>
        </View>
      </Sheet>

      <UserPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(u) => setPicked(u)}
        title="Buscar cliente"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[2],
  },
  tab: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing[2],
  },
  cardTop: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventBadge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },

  empty: { alignItems: 'center', paddingTop: 60 },

  // Sheet content
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    minHeight: 52,
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(111,168,138,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(111,168,138,0.30)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    minHeight: 52,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },

  actions: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[3],
    paddingTop: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
