import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';

type Filter = 'all' | 'PUBLISHED' | 'DRAFT';

export default function AdminEventsList() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await eventsApi.list({ limit: 100, includeAll: true });
      setEvents(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete(id: string, title: string) {
    Alert.alert(
      'Eliminar evento',
      `¿Eliminar "${title}" permanentemente? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            // Optimistic: desaparece del UI al instante, se repone si falla.
            const previous = events;
            setEvents((prev) => prev.filter((e) => e.id !== id));
            try {
              await adminApi.deleteEvent(id);
            } catch (err) {
              setEvents(previous);
              Alert.alert('Error', apiError(err));
            }
          },
        },
      ],
    );
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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Eventos</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.catBtn}
            onPress={() => router.push('/(admin)/manage/events/categories' as never)}
            hitSlop={10}
          >
            <Feather name="tag" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(admin)/manage/events/new' as never)}
            hitSlop={10}
          >
            <Feather name="plus" size={20} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar evento..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <View style={styles.tabs}>
        <Tab active={filter === 'all'} label={`Todos (${events.length})`} onPress={() => setFilter('all')} />
        <Tab active={filter === 'PUBLISHED'} label="Activos" onPress={() => setFilter('PUBLISHED')} />
        <Tab active={filter === 'DRAFT'} label="Borrador" onPress={() => setFilter('DRAFT')} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="calendar" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay eventos que coincidan.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                activeOpacity={0.85}
                onPress={() => router.push(`/(admin)/manage/events/${item.id}` as never)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {item.startDate ? new Date(item.startDate).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {' · '}
                    {item.currentCapacity ?? 0} asistentes
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </TouchableOpacity>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push(`/(admin)/manage/events/${item.id}` as never)}
                  activeOpacity={0.85}
                >
                  <Feather name="edit-2" size={13} color={Colors.accentPrimary} />
                  <Text style={styles.editLbl}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => confirmDelete(item.id, item.title)}
                  activeOpacity={0.85}
                >
                  <Feather name="trash-2" size={13} color={Colors.accentDanger} />
                  <Text style={styles.deleteLbl}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PUBLISHED: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'ACTIVO' },
    DRAFT: { bg: 'rgba(107,107,120,0.15)', color: Colors.textMuted, label: 'BORRADOR' },
    CANCELLED: { bg: 'rgba(228,88,88,0.15)', color: Colors.accentDanger, label: 'CANCELADO' },
    COMPLETED: { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA', label: 'FINALIZADO' },
  };
  const m = map[status] ?? map.DRAFT;
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }]}>
      <Text style={[styles.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  catBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 8,
    paddingHorizontal: 14, height: 44,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20, paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  quickActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 32, borderRadius: 8,
    backgroundColor: 'rgba(244,163,64,0.12)',
    borderWidth: 1, borderColor: 'rgba(244,163,64,0.3)',
  },
  editLbl: { color: Colors.accentPrimary, fontSize: 11, fontWeight: '700' },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 32, borderRadius: 8,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  deleteLbl: { color: Colors.accentDanger, fontSize: 11, fontWeight: '700' },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },

  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
