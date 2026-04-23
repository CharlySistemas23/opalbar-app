import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';

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
