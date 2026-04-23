import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { Colors } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];
type Filter = 'all' | 'SIGNUP' | 'RESERVATION' | 'POST' | 'REPORT';

const TYPE_META: Record<string, { icon: FeatherIcon; color: string; label: string }> = {
  SIGNUP: { icon: 'user-plus', color: Colors.accentPrimary, label: 'Registro' },
  RESERVATION: { icon: 'calendar', color: '#60A5FA', label: 'Reserva' },
  POST: { icon: 'message-square', color: Colors.accentSuccess, label: 'Post' },
  REPORT: { icon: 'flag', color: Colors.accentDanger, label: 'Reporte' },
};

export default function ActivityFeed() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const r = await adminApi.activity(80);
      setItems(r.data?.data ?? r.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Actividad reciente</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <Tab active={filter === 'all'} label="Todo" onPress={() => setFilter('all')} />
        <Tab active={filter === 'SIGNUP'} label="Signups" onPress={() => setFilter('SIGNUP')} />
        <Tab active={filter === 'RESERVATION'} label="Reservas" onPress={() => setFilter('RESERVATION')} />
        <Tab active={filter === 'POST'} label="Posts" onPress={() => setFilter('POST')} />
        <Tab active={filter === 'REPORT'} label="Reportes" onPress={() => setFilter('REPORT')} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(it, i) => `${it.type}-${it.id}-${i}`}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="activity" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Sin actividad en esta categoría.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const m = TYPE_META[item.type] ?? TYPE_META.SIGNUP;
            return (
              <View style={styles.card}>
                <View style={[styles.iconBox, { backgroundColor: m.color + '20' }]}>
                  <Feather name={m.icon} size={16} color={m.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardText}>{item.text}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.typeLabel}>{m.label}</Text>
                    {item.meta ? <Text style={styles.metaTag}>· {item.meta}</Text> : null}
                    <Text style={styles.time}>· {relTime(item.when)}</Text>
                  </View>
                </View>
              </View>
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

  tabs: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    flexWrap: 'wrap',
  },
  tab: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  card: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: Colors.bgCard,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  typeLabel: { color: Colors.accentPrimary, fontSize: 10, fontWeight: '700' },
  metaTag: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  time: { color: Colors.textMuted, fontSize: 10 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
