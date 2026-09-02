import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Caption,
  ConfirmDialog,
  Input,
  Kicker,
  SegmentedControl,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { AdminHeader, StatusPill } from '@/components/admin';
import type { SegmentOption } from '@/components/ui';

type Filter = 'all' | 'PUBLISHED' | 'DRAFT';

const STATUS_TONE: Record<string, { tone: 'success' | 'neutral' | 'danger' | 'info'; label: string }> = {
  PUBLISHED: { tone: 'success', label: 'ACTIVO' },
  DRAFT: { tone: 'neutral', label: 'BORRADOR' },
  CANCELLED: { tone: 'danger', label: 'CANCELADO' },
  COMPLETED: { tone: 'info', label: 'FINALIZADO' },
  FULL: { tone: 'info', label: 'CUPO LLENO' },
};

export default function AdminEventsList() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const me = useAuthStore((s) => s.user);
  // Backend: delete is ADMIN/SUPER_ADMIN-only; create/update stay open to MODERATOR.
  const canDelete = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);
  const [confirmDup, setConfirmDup] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await eventsApi.list({ limit: 100, includeAll: true });
      setEvents(r.data?.data?.data ?? r.data?.data ?? []);
    } catch (err) {
      setError(apiError(err));
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function performDelete() {
    if (!confirmDel) return;
    const id = confirmDel.id;
    const previous = events;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setConfirmDel(null);
    try {
      await adminApi.deleteEvent(id);
    } catch (err) {
      setEvents(previous);
      Alert.alert('Error', apiError(err));
    }
  }

  async function performDuplicate() {
    if (!confirmDup) return;
    const id = confirmDup.id;
    setConfirmDup(null);
    try {
      const r = await adminApi.duplicateEvent(id);
      const created = r.data?.data ?? r.data ?? {};
      load();
      if (created.id) router.push(`/(admin)/manage/events/${created.id}` as never);
    } catch (err) {
      Alert.alert('Error', apiError(err));
    }
  }

  const shown = useMemo(() => {
    let list = events;
    if (filter !== 'all') list = list.filter((e) => e.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => (e.title ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [events, filter, search]);

  const segments: SegmentOption<Filter>[] = [
    { value: 'all', label: `Todos (${events.length})` },
    { value: 'PUBLISHED', label: 'Activos' },
    { value: 'DRAFT', label: 'Borrador' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Eventos"
        kicker="Gestión"
        onBack={goBack}
        right={
          <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
            <Pressable
              onPress={() => router.push('/(admin)/manage/events/categories' as never)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Categorías"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Feather name="tag" size={16} color={Colors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(admin)/manage/events/new' as never)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Nuevo evento"
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            >
              <Feather name="plus" size={18} color={Colors.textInverse} />
            </Pressable>
          </View>
        }
      />

      <View style={styles.searchWrap}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar evento..."
          leftIcon={<Feather name="search" size={16} color={Colors.textMuted} />}
        />
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={segments}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120, gap: Spacing[2] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={Colors.accentPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="calendar" size={32} color={Colors.textMuted} />
              <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
                No hay eventos que coincidan.
              </Caption>
            </View>
          }
          renderItem={({ item }) => {
            const statusInfo = STATUS_TONE[item.status] ?? STATUS_TONE.DRAFT;
            return (
              <View style={styles.card}>
                <Pressable
                  style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
                  onPress={() => router.push(`/(admin)/manage/events/${item.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                >
                  <View style={{ flex: 1 }}>
                    <Subhead numberOfLines={1}>{item.title}</Subhead>
                    <Caption tone="muted" style={{ marginTop: 4 }}>
                      {item.startDate
                        ? new Date(item.startDate).toLocaleString('es', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                      {' · '}
                      {item.currentCapacity ?? 0} asistentes
                    </Caption>
                  </View>
                  <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
                </Pressable>
                <View style={styles.quickActions}>
                  <ActionChip
                    icon="edit-2"
                    label="Editar"
                    onPress={() => router.push(`/(admin)/manage/events/${item.id}` as never)}
                  />
                  <ActionChip
                    icon="copy"
                    label="Duplicar"
                    onPress={() => setConfirmDup({ id: item.id, title: item.title })}
                  />
                  {canDelete ? (
                    <ActionChip
                      icon="trash-2"
                      label="Eliminar"
                      danger
                      onPress={() => setConfirmDel({ id: item.id, title: item.title })}
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={performDelete}
        title="Eliminar evento"
        description={`¿Eliminar "${confirmDel?.title ?? ''}" permanentemente? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmVariant="danger"
      />
      <ConfirmDialog
        open={!!confirmDup}
        onClose={() => setConfirmDup(null)}
        onConfirm={performDuplicate}
        title="Duplicar evento"
        description={`¿Crear una copia de "${confirmDup?.title ?? ''}"? Quedará en BORRADOR con título "(copia)" y capacidad reseteada.`}
        confirmLabel="Duplicar"
      />
    </SafeAreaView>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? Colors.accentDanger : Colors.accentPrimary;
  const bg = danger ? 'rgba(196,104,104,0.10)' : 'rgba(201,169,97,0.10)';
  const border = danger ? 'rgba(196,104,104,0.30)' : 'rgba(201,169,97,0.30)';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionChip,
        { backgroundColor: bg, borderColor: border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={12} color={color} />
      <Kicker style={{ color, fontSize: 10 }}>{label}</Kicker>
    </Pressable>
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchWrap: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[2],
  },
  tabsWrap: {
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingBottom: Spacing[3],
  },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 30,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing[2] },
});
