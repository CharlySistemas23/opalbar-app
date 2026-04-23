import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

type Filter = 'all' | 'PENDING' | 'RESOLVED' | 'DISMISSED';

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  POST: { icon: 'message-square', color: Colors.accentPrimary, label: 'Post' },
  COMMENT: { icon: 'message-circle', color: '#60A5FA', label: 'Comentario' },
  USER: { icon: 'user', color: '#A855F7', label: 'Usuario' },
  REVIEW: { icon: 'star', color: '#EC4899', label: 'Reseña' },
};

export default function AdminReports() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('PENDING');

  const load = useCallback(async () => {
    try {
      const r = await adminApi.reports({ limit: 100 });
      setReports(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    if (filter === 'all') return reports;
    return reports.filter((r) => r.status === filter);
  }, [reports, filter]);

  async function resolve(id: string, status: 'RESOLVED' | 'DISMISSED' = 'RESOLVED') {
    try {
      await adminApi.resolveReport(id, status);
      setReports((p) => p.filter((x) => x.id !== id));
    } catch (err) { Alert.alert('Error', apiError(err)); }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logo}><Feather name="flag" size={16} color={Colors.accentPrimary} /></View>
        <Text style={styles.title}>Reportes</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.count}>
          <Text style={styles.countText}>{reports.filter(r => r.status === 'PENDING').length}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Tab active={filter === 'PENDING'} label="Pendientes" onPress={() => setFilter('PENDING')} />
        <Tab active={filter === 'RESOLVED'} label="Resueltos" onPress={() => setFilter('RESOLVED')} />
        <Tab active={filter === 'DISMISSED'} label="Descartados" onPress={() => setFilter('DISMISSED')} />
        <Tab active={filter === 'all'} label="Todos" onPress={() => setFilter('all')} />
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
              <Feather name="check-circle" size={48} color={Colors.accentSuccess} />
              <Text style={styles.emptyTitle}>Sin reportes</Text>
              <Text style={styles.emptyText}>Todo limpio por ahora.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = TYPE_META[item.targetType] ?? TYPE_META.POST;
            return (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardTop}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/(admin)/reports/${item.id}` as never)}
                >
                  <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
                    <Feather name={meta.icon} size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      Reporte de {meta.label.toLowerCase()}
                    </Text>
                    <Text style={styles.cardReason}>{item.reason.replace(/_/g, ' ').toLowerCase()}</Text>
                    <Text style={styles.cardTime}>hace {relTime(item.createdAt)}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {item.description ? (
                  <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>
                ) : null}
                {item.status === 'PENDING' && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.dismissBtn} onPress={() => resolve(item.id, 'DISMISSED')}>
                      <Text style={styles.dismissLbl}>Descartar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resolveBtn} onPress={() => resolve(item.id, 'RESOLVED')}>
                      <Feather name="check" size={14} color={Colors.textInverse} />
                      <Text style={styles.resolveLbl}>Resolver</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  logo: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  count: {
    minWidth: 40, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(228,88,88,0.15)',
    paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { color: Colors.accentDanger, fontSize: 13, fontWeight: '800' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardReason: { color: Colors.accentDanger, fontSize: 12, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  cardTime: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },

  desc: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  dismissBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 36, borderRadius: 10,
    backgroundColor: Colors.bgElevated,
  },
  dismissLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  resolveBtn: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 36, borderRadius: 10,
    backgroundColor: Colors.accentSuccess,
  },
  resolveLbl: { color: Colors.textInverse, fontSize: 12, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
