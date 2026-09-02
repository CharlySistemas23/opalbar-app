import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  ScrollView,
} from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Caption, SegmentedControl, Subhead } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { AdminHeader, StatusPill } from '@/components/admin';
import type { SegmentOption } from '@/components/ui';

type Filter = 'all' | 'OPEN' | 'IN_REVIEW' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
type PriorityFilter = 'all' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const STATUS_TONE: Record<
  string,
  { tone: 'accent' | 'info' | 'success' | 'neutral'; label: string }
> = {
  OPEN: { tone: 'accent', label: 'ABIERTO' },
  IN_REVIEW: { tone: 'info', label: 'EN REVISIÓN' },
  WAITING_USER: { tone: 'neutral', label: 'ESPERANDO' },
  RESOLVED: { tone: 'success', label: 'RESUELTO' },
  CLOSED: { tone: 'neutral', label: 'CERRADO' },
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: Colors.textMuted,
  MEDIUM: Colors.accentInfo,
  HIGH: Colors.accentPrimary,
  URGENT: Colors.accentDanger,
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const PAGE = 20;

export default function SupportTicketsAdmin() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const [tickets, setTickets] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ page: number; hasNextPage: boolean; total: number }>({ page: 1, hasNextPage: false, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const reqId = useRef(0);

  const params = useCallback(
    (page: number) => ({
      page,
      limit: PAGE,
      ...(filter !== 'all' ? { status: filter } : {}),
      ...(priority !== 'all' ? { priority } : {}),
    }),
    [filter, priority],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const id = ++reqId.current;
      if (!opts?.silent) { setLoading(true); setError(null); }
      try {
        const r = await adminApi.tickets(params(1));
        if (id !== reqId.current) return;
        const payload = r.data?.data;
        setTickets(payload?.data ?? []);
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
      const r = await adminApi.tickets(params(meta.page + 1));
      const payload = r.data?.data;
      const next: any[] = payload?.data ?? [];
      setTickets((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...next.filter((t) => !seen.has(t.id))];
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

  const shown = tickets;

  const segments: SegmentOption<Filter>[] = [
    { value: 'all', label: `Todos (${meta.total})` },
    { value: 'OPEN', label: 'Abiertos' },
    { value: 'IN_REVIEW', label: 'En proceso' },
    { value: 'WAITING_USER', label: 'Esperando' },
    { value: 'RESOLVED', label: 'Resueltos' },
    { value: 'CLOSED', label: 'Cerrados' },
  ];

  const priorities: { value: PriorityFilter; label: string }[] = [
    { value: 'all', label: 'Toda prioridad' },
    { value: 'URGENT', label: PRIORITY_LABEL.URGENT },
    { value: 'HIGH', label: PRIORITY_LABEL.HIGH },
    { value: 'MEDIUM', label: PRIORITY_LABEL.MEDIUM },
    { value: 'LOW', label: PRIORITY_LABEL.LOW },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Mensajes de usuarios"
        kicker="Soporte"
        onBack={goBack}
        right={
          <Pressable
            onPress={() => router.push('/(admin)/manage/support/templates' as never)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Plantillas"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Feather name="zap" size={14} color={Colors.accentPrimary} />
          </Pressable>
        }
      />

      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ marginHorizontal: -Spacing[5] }} contentContainerStyle={{ paddingHorizontal: Spacing[5] }}>
          <SegmentedControl<Filter> value={filter} onChange={setFilter} options={segments} fullWidth={false} />
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ marginHorizontal: -Spacing[5], marginTop: Spacing[2] }} contentContainerStyle={{ paddingHorizontal: Spacing[5], gap: 6 }}>
          {priorities.map((p) => {
            const active = priority === p.value;
            const color = p.value === 'all' ? Colors.textSecondary : PRIORITY_COLOR[p.value] ?? Colors.textSecondary;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPriority(p.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.priorityChip,
                  active && { borderColor: color, backgroundColor: color + '18' },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Caption size="sm" style={{ color: active ? color : Colors.textMuted, fontWeight: '700' }}>
                  {p.label}
                </Caption>
              </Pressable>
            );
          })}
        </ScrollView>
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
          keyExtractor={(t) => t.id}
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
            <EmptyState
              icon="inbox"
              title="Sin tickets"
              message={filter === 'all' && priority === 'all' ? 'Sin mensajes todavía.' : 'Sin tickets que coincidan con este filtro.'}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: Spacing[4] }}>
                <ActivityIndicator color={Colors.accentPrimary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const user = item.user;
            const name =
              `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() ||
              user?.email ||
              'Usuario';
            const st = STATUS_TONE[item.status] ?? STATUS_TONE.OPEN;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => router.push(`/(admin)/manage/support/${item.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={item.subject}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Body tone="inverse" weight="bold">
                      {name[0]?.toUpperCase() ?? '?'}
                    </Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Subhead numberOfLines={1}>{item.subject}</Subhead>
                    <Caption tone="muted" style={{ marginTop: 2 }}>
                      {name} · hace {relTime(item.createdAt)}
                    </Caption>
                  </View>
                  <StatusPill label={st.label} tone={st.tone} />
                </View>
                {item.messages?.[0]?.content ? (
                  <Caption tone="secondary" numberOfLines={2}>
                    {item.messages[0].content}
                  </Caption>
                ) : null}
                <View style={styles.cardFoot}>
                  <View style={styles.priorityRow}>
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: PRIORITY_COLOR[item.priority] ?? Colors.textMuted },
                      ]}
                    />
                    <Caption tone="secondary" size="sm" style={{ fontWeight: '600' }}>
                      {PRIORITY_LABEL[item.priority] ?? 'Media'}
                    </Caption>
                  </View>
                  {item.category ? (
                    <Caption tone="muted" size="sm">
                      #{String(item.category).toLowerCase()}
                    </Caption>
                  ) : null}
                </View>
              </Pressable>
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
  pressed: { opacity: 0.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,97,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabsWrap: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[3] },
  priorityChip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

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
    backgroundColor: Colors.accentInfo,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  priorityRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  priorityDot: { width: 7, height: 7, borderRadius: 3.5 },

  empty: { alignItems: 'center', paddingTop: 80 },
});
