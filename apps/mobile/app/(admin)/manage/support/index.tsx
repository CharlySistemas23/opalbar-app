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
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Caption, Kicker, SegmentedControl, Subhead } from '@/components/ui';
import { AdminHeader, StatusPill } from '@/components/admin';
import type { SegmentOption } from '@/components/ui';

type Filter = 'all' | 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

const STATUS_TONE: Record<
  string,
  { tone: 'accent' | 'info' | 'success' | 'neutral'; label: string }
> = {
  OPEN: { tone: 'accent', label: 'ABIERTO' },
  IN_REVIEW: { tone: 'info', label: 'EN REVISION' },
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

  const segments: SegmentOption<Filter>[] = [
    { value: 'all', label: `Todos (${tickets.length})` },
    { value: 'OPEN', label: 'Abiertos' },
    { value: 'IN_REVIEW', label: 'En proceso' },
    { value: 'RESOLVED', label: 'Resueltos' },
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
        <SegmentedControl<Filter> value={filter} onChange={setFilter} options={segments} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={36} color={Colors.textMuted} />
              <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
                {filter === 'all' ? 'Sin mensajes todavia.' : 'Sin tickets en este estado.'}
              </Caption>
            </View>
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
                {item.description ? (
                  <Caption tone="secondary" numberOfLines={2}>
                    {item.description}
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
