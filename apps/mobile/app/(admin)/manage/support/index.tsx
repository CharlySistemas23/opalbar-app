import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';

type Filter = 'all' | 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  OPEN: { bg: 'rgba(244,163,64,0.15)', color: Colors.accentPrimary, label: 'ABIERTO' },
  IN_REVIEW: { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA', label: 'EN REVISIÓN' },
  WAITING_USER: { bg: 'rgba(168,85,247,0.15)', color: '#A855F7', label: 'ESPERANDO USER' },
  RESOLVED: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'RESUELTO' },
  CLOSED: { bg: 'rgba(107,107,120,0.15)', color: Colors.textMuted, label: 'CERRADO' },
};

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  LOW: { color: Colors.textMuted, label: 'Baja' },
  MEDIUM: { color: '#60A5FA', label: 'Media' },
  HIGH: { color: Colors.accentPrimary, label: 'Alta' },
  URGENT: { color: Colors.accentDanger, label: 'Urgente' },
};

export default function SupportTicketsAdmin() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const r = await adminApi.tickets({ limit: 100 });
      setTickets(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    if (filter === 'all') return tickets;
    return tickets.filter((t) => t.status === filter);
  }, [tickets, filter]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Mensajes de usuarios</Text>
        <TouchableOpacity
          style={styles.tmplHeaderBtn}
          onPress={() => router.push('/(admin)/manage/support/templates' as never)}
          hitSlop={10}
        >
          <Feather name="zap" size={18} color={Colors.accentPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <Tab active={filter === 'all'} label={`Todos (${tickets.length})`} onPress={() => setFilter('all')} />
        <Tab active={filter === 'OPEN'} label="Abiertos" onPress={() => setFilter('OPEN')} />
        <Tab active={filter === 'IN_REVIEW'} label="En proceso" onPress={() => setFilter('IN_REVIEW')} />
        <Tab active={filter === 'RESOLVED'} label="Resueltos" onPress={() => setFilter('RESOLVED')} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {filter === 'all' ? 'Sin mensajes todavía.' : 'Sin tickets en este estado.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const user = item.user;
            const name = `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || user?.email || 'Usuario';
            const st = STATUS_META[item.status] ?? STATUS_META.OPEN;
            const pr = PRIORITY_META[item.priority] ?? PRIORITY_META.MEDIUM;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/(admin)/manage/support/${item.id}` as never)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{name[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.subject}</Text>
                    <Text style={styles.cardUser} numberOfLines={1}>
                      {name} · hace {relTime(item.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                {item.description ? (
                  <Text style={styles.preview} numberOfLines={2}>{item.description}</Text>
                ) : null}
                <View style={styles.cardFoot}>
                  <View style={styles.priorityRow}>
                    <View style={[styles.priorityDot, { backgroundColor: pr.color }]} />
                    <Text style={styles.priorityText}>{pr.label}</Text>
                  </View>
                  {item.category ? (
                    <Text style={styles.categoryText}>#{String(item.category).toLowerCase()}</Text>
                  ) : null}
                </View>
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
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
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
  tmplHeaderBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(244,163,64,0.15)',
    borderWidth: 1, borderColor: 'rgba(244,163,64,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20, paddingVertical: 12,
    gap: 8, flexWrap: 'wrap',
  },
  tab: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#60A5FA',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 13 },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardUser: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  preview: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  cardFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 4,
  },
  priorityRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  categoryText: { color: Colors.textMuted, fontSize: 11 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
