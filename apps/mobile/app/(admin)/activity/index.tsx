import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Caption, Kicker, SegmentedControl } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import type { SegmentOption } from '@/components/ui';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];
type Filter = 'all' | 'SIGNUP' | 'RESERVATION' | 'POST' | 'REPORT';

const TYPE_META: Record<string, { icon: FeatherIcon; color: string; label: string }> = {
  SIGNUP: { icon: 'user-plus', color: Colors.accentPrimary, label: 'Registro' },
  RESERVATION: { icon: 'calendar', color: Colors.accentInfo, label: 'Reserva' },
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

  const segments: SegmentOption<Filter>[] = [
    { value: 'all', label: 'Todo' },
    { value: 'SIGNUP', label: 'Signups' },
    { value: 'RESERVATION', label: 'Reservas' },
    { value: 'POST', label: 'Posts' },
    { value: 'REPORT', label: 'Reportes' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader title="Actividad reciente" kicker="Feed" onBack={() => router.back()} />

      <View style={styles.tabsWrap}>
        <SegmentedControl<Filter> value={filter} onChange={setFilter} options={segments} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(it, i) => `${it.type}-${it.id}-${i}`}
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
              <Feather name="activity" size={32} color={Colors.textMuted} />
              <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
                Sin actividad en esta categoria.
              </Caption>
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
                  <Body size="sm">{item.text}</Body>
                  <View style={styles.metaRow}>
                    <Kicker style={{ color: m.color, fontSize: 9 }}>{m.label}</Kicker>
                    {item.meta ? (
                      <Caption tone="muted" size="sm">· {item.meta}</Caption>
                    ) : null}
                    <Caption tone="muted" size="sm">· {relTime(item.when)}</Caption>
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

  tabsWrap: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[3] },

  card: {
    flexDirection: 'row',
    gap: Spacing[3],
    alignItems: 'flex-start',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },

  empty: { alignItems: 'center', paddingTop: 60 },
});
