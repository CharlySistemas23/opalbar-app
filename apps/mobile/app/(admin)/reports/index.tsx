import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Pressable } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { Colors, Spacing } from '@/constants/tokens';
import { Caption, Input, SegmentedControl, Subhead } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { AdminHeader } from '@/components/admin';
import type { SegmentOption } from '@/components/ui';

type Filter = 'all' | 'PENDING' | 'RESOLVED' | 'DISMISSED';

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  POST: { icon: 'message-square', color: Colors.accentPrimary, label: 'Post' },
  COMMENT: { icon: 'message-circle', color: Colors.accentInfo, label: 'Comentario' },
  USER: { icon: 'user', color: Colors.accentChampagne, label: 'Usuario' },
  REVIEW: { icon: 'star', color: Colors.accentChampagne, label: 'Reseña' },
};

const PAGE = 20;

export default function AdminReports() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ page: number; hasNextPage: boolean; total: number }>({ page: 1, hasNextPage: false, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('PENDING');
  // `search` is debounced from `searchInput` below, then feeds into `params`
  // so a single load fires per commit (no double-fetch from combining a
  // focus-effect reload with a separate search-effect reload).
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const reqId = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { counts: pendingCounts, refresh: refreshPendingCount } = useAdminCounts();

  const params = useCallback(
    (page: number) => ({
      page,
      limit: PAGE,
      status: filter === 'all' ? 'ALL' : filter,
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [filter, search],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const id = ++reqId.current;
      if (!opts?.silent) { setLoading(true); setError(null); }
      try {
        const r = await adminApi.reports(params(1));
        if (id !== reqId.current) return;
        const payload = r.data?.data;
        setReports(payload?.data ?? []);
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

  // Tab change and committed search both change `params` → new `load`
  // identity → this re-fires (also covers focus-return refresh, e.g. after
  // resolving a report from its detail screen).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Debounce the raw input into `search` so typing doesn't fire a request
  // per keystroke; committing `search` is what actually triggers `load`.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(searchInput); }, searchInput ? 350 : 0);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchInput]);

  async function loadMore() {
    if (loadingMore || loading || !meta.hasNextPage) return;
    setLoadingMore(true);
    try {
      const r = await adminApi.reports(params(meta.page + 1));
      const payload = r.data?.data;
      const next: any[] = payload?.data ?? [];
      setReports((prev) => {
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

  const shown = reports;

  async function resolve(id: string, status: 'RESOLVED' | 'DISMISSED' = 'RESOLVED') {
    try {
      await adminApi.resolveReport(id, status);
      setReports((p) => p.filter((x) => x.id !== id));
      setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
      refreshPendingCount();
    } catch (err) { Alert.alert('Error', apiError(err)); }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Reportes"
        kicker="Moderación"
        onBack={() => router.back()}
        right={
          <View style={styles.count}>
            <Caption tone="danger" style={{ fontWeight: '700' }}>
              {pendingCounts.reports}
            </Caption>
          </View>
        }
      />

      <View style={styles.tabsWrap}>
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'PENDING', label: 'Pendientes' },
            { value: 'RESOLVED', label: 'Resueltos' },
            { value: 'DISMISSED', label: 'Descartados' },
            { value: 'all', label: 'Todos' },
          ] as SegmentOption<Filter>[]}
        />
        <Input
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Buscar por motivo, nombre o correo"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon={<Feather name="search" size={14} color={Colors.textMuted} />}
          rightIcon={searchInput ? <Feather name="x" size={14} color={Colors.textMuted} /> : undefined}
          onRightIconPress={searchInput ? () => setSearchInput('') : undefined}
          rightIconLabel="Limpiar búsqueda"
          style={{ marginTop: Spacing[3] }}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={48} color={Colors.accentSuccess} />
              <Text style={styles.emptyTitle}>{search ? 'Sin resultados' : 'Sin reportes'}</Text>
              <Text style={styles.emptyText}>{search ? `Nada coincide con "${search.trim()}".` : 'Todo limpio por ahora.'}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={Colors.accentPrimary} />
              </View>
            ) : null
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

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  count: {
    minWidth: 40, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(196,104,104,0.14)',
    paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  tabsWrap: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[3] },

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
