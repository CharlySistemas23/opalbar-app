// ─────────────────────────────────────────────
//  Admin Dashboard — Editorial Premium
//
//  Logica intacta. Solo se rediseno el chrome:
//   · Hero greeting con tipografia serif (Heading)
//   · KPI chips compactas con tokens
//   · Inbox + Activity como AdminRows
// ─────────────────────────────────────────────
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { Body, Caption, Heading, Kicker, Numeric, Subhead } from '@/components/ui';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

const ACTIVITY_META: Record<string, { icon: FeatherIcon; color: string }> = {
  SIGNUP: { icon: 'user-plus', color: Colors.accentPrimary },
  RESERVATION: { icon: 'calendar', color: Colors.accentInfo },
  POST: { icon: 'message-square', color: Colors.accentSuccess },
  REPORT: { icon: 'flag', color: Colors.accentDanger },
};

const INBOX_META: Record<string, { icon: FeatherIcon; color: string }> = {
  FLAG: { icon: 'alert-triangle', color: Colors.accentDanger },
  REPORT: { icon: 'flag', color: Colors.accentDanger },
  TICKET: { icon: 'life-buoy', color: Colors.accentInfo },
  POST: { icon: 'message-square', color: Colors.accentSuccess },
  REVIEW: { icon: 'star', color: Colors.accentWarning },
  RESERVATION: { icon: 'calendar', color: Colors.accentPrimary },
};

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// The backend's FLAG inbox items point at `/(admin)/flags` — that screen is
// unrelated (on/off feature-flag toggles), not content moderation. There's no
// per-flag detail screen on mobile, so route by the flag's target instead of
// trusting `deepLink` for this one type. Every other type's deepLink is fine.
function resolveInboxRoute(it: any): string {
  if (it?.type !== 'FLAG') return it?.deepLink;
  const targetType = it?.meta?.targetType;
  const targetId = it?.meta?.targetId as string | undefined;
  switch (targetType) {
    case 'POST':
      return targetId ? `/(admin)/manage/community/${targetId}` : '/(admin)/manage/community';
    case 'REVIEW':
      return '/(admin)/manage/reviews';
    case 'USER_PROFILE':
      return targetId ? `/(admin)/users/${targetId}` : '/(admin)/users';
    case 'COMMENT':
    default:
      // Comments/flags without a safe per-item screen land on the community
      // moderation list rather than guessing a wrong id.
      return '/(admin)/manage/community';
  }
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [inboxError, setInboxError] = useState(false);
  const { counts, refresh: refreshCounts } = useAdminCounts();

  const load = useCallback(async () => {
    const [sRes, aRes, iRes] = await Promise.allSettled([
      adminApi.stats(),
      adminApi.activity(6),
      adminApi.inbox(5),
    ]);

    if (sRes.status === 'fulfilled') {
      setStats(sRes.value.data?.data ?? sRes.value.data ?? null);
      setStatsError(false);
    } else {
      setStatsError(true);
    }

    if (aRes.status === 'fulfilled') {
      setActivity(aRes.value.data?.data ?? aRes.value.data ?? []);
      setActivityError(false);
    } else {
      setActivityError(true);
    }

    if (iRes.status === 'fulfilled') {
      const inboxData = iRes.value.data?.data ?? iRes.value.data ?? {};
      setInbox(inboxData.items ?? []);
      setInboxError(false);
    } else {
      setInboxError(true);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshCounts();
    }, [load, refreshCounts]),
  );

  const initials =
    (user?.profile?.firstName?.[0] ?? user?.email?.[0] ?? 'A').toUpperCase();

  const kpis = useMemo(
    () => [
      { label: 'Usuarios', value: stats?.totalUsers ?? 0, icon: 'users' as FeatherIcon },
      { label: 'Eventos hoy', value: stats?.activeEvents ?? 0, icon: 'calendar' as FeatherIcon },
      { label: 'Reservas pend.', value: stats?.pendingReservations ?? 0, icon: 'bookmark' as FeatherIcon },
      { label: 'Reportes', value: stats?.openReports ?? 0, icon: 'flag' as FeatherIcon, danger: true },
    ],
    [stats],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={Colors.accentPrimary}
          />
        }
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Kicker tone="muted">{getGreeting()}</Kicker>
            <Heading size="lg" style={{ marginTop: 4 }} numberOfLines={1}>
              {user?.profile?.firstName ?? 'Admin'}
            </Heading>
            <Caption tone="muted" style={{ marginTop: 6, textTransform: 'capitalize' }}>
              {new Date().toLocaleDateString('es', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Caption>
          </View>

          <View style={styles.heroActions}>
            <Pressable
              style={({ pressed }) => [styles.modePill, pressed && styles.pressed]}
              onPress={() => router.replace('/(tabs)/home' as never)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Cambiar a modo usuario"
            >
              <Feather name="smartphone" size={13} color={Colors.accentPrimary} />
              <Text style={styles.modePillText}>Usuario</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/profile' as never)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Perfil"
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>
          </View>
        </View>

        {/* KPI row */}
        {!loading && statsError ? (
          <Pressable
            style={({ pressed }) => [styles.inlineError, pressed && styles.pressed]}
            onPress={load}
            accessibilityRole="button"
            accessibilityLabel="Reintentar cargar estadísticas"
          >
            <Feather name="alert-circle" size={14} color={Colors.accentDanger} />
            <Caption style={{ color: Colors.accentDanger, flex: 1 }}>
              No se pudieron cargar las estadísticas.
            </Caption>
            <Caption style={{ color: Colors.accentDanger, fontWeight: '700' }}>Reintentar</Caption>
          </Pressable>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiRow}
          >
            {kpis.map((k) => (
              <View key={k.label} style={styles.kpi}>
                <View style={styles.kpiIconBox}>
                  <Feather
                    name={k.icon}
                    size={14}
                    color={k.danger ? Colors.accentDanger : Colors.accentPrimary}
                  />
                </View>
                {loading ? (
                  <ActivityIndicator
                    color={k.danger ? Colors.accentDanger : Colors.accentPrimary}
                    size="small"
                    style={{ marginTop: 8 }}
                  />
                ) : (
                  <Numeric size="sm" tone={k.danger ? 'danger' : 'primary'}>
                    {k.value}
                  </Numeric>
                )}
                <Caption tone="muted" size="sm" style={{ marginTop: 2 }}>
                  {k.label}
                </Caption>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Mis clientes CTA — insights/audience is ADMIN/SUPER_ADMIN only on the backend */}
        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
        <Pressable
          style={({ pressed }) => [styles.insightsCta, pressed && styles.pressed]}
          onPress={() => router.push('/(admin)/analytics' as never)}
          accessibilityRole="button"
          accessibilityLabel="Ver analíticas de clientes"
        >
          <View style={styles.insightsCtaIcon}>
            <Feather name="bar-chart-2" size={16} color={Colors.accentPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Subhead>Mis clientes</Subhead>
            <Caption tone="muted" style={{ marginTop: 2 }}>
              Quiénes son, qué les interesa, cómo te encontraron
            </Caption>
          </View>
          <Feather name="chevron-right" size={18} color={Colors.textMuted} />
        </Pressable>
        )}

        {/* Inbox section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Kicker tone="muted">Bandeja de hoy</Kicker>
            {counts.total > 0 && (
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{counts.total}</Text>
              </View>
            )}
          </View>
          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={() => router.push('/(admin)/manage' as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Gestionar bandeja"
          >
            <Text style={styles.sectionLink}>Gestionar</Text>
          </Pressable>
        </View>

        <View style={styles.inboxCard}>
          {loading && inbox.length === 0 ? (
            <View style={styles.centerSmall}>
              <ActivityIndicator color={Colors.accentPrimary} />
            </View>
          ) : !loading && inboxError ? (
            <Pressable
              style={({ pressed }) => [styles.inboxEmpty, pressed && styles.pressed]}
              onPress={load}
              accessibilityRole="button"
              accessibilityLabel="Reintentar cargar bandeja"
            >
              <View style={[styles.inboxEmptyIcon, { backgroundColor: 'rgba(196,104,104,0.14)' }]}>
                <Feather name="alert-circle" size={20} color={Colors.accentDanger} />
              </View>
              <Subhead style={{ marginTop: 4 }}>No se pudo cargar</Subhead>
              <Caption style={{ color: Colors.accentDanger, fontWeight: '700' }}>Toca para reintentar</Caption>
            </Pressable>
          ) : inbox.length === 0 ? (
            <View style={styles.inboxEmpty}>
              <View style={styles.inboxEmptyIcon}>
                <Feather name="check" size={20} color={Colors.accentSuccess} />
              </View>
              <Subhead style={{ marginTop: 4 }}>Todo al día</Subhead>
              <Caption tone="muted">Nada pendiente. Buen trabajo.</Caption>
            </View>
          ) : (
            inbox.map((it: any, idx: number) => {
              const meta = INBOX_META[it.type] ?? INBOX_META.POST;
              return (
                <Pressable
                  key={it.id}
                  style={({ pressed }) => [
                    styles.inboxItem,
                    idx === inbox.length - 1 && styles.inboxItemLast,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => router.push(resolveInboxRoute(it) as never)}
                  accessibilityRole="button"
                  accessibilityLabel={it.title}
                >
                  <View style={[styles.inboxIcon, { backgroundColor: meta.color + '1F' }]}>
                    <Feather name={meta.icon} size={14} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body size="sm" weight="semiBold" numberOfLines={1}>
                      {it.title}
                    </Body>
                    {it.preview ? (
                      <Caption tone="muted" size="sm" numberOfLines={1} style={{ marginTop: 2 }}>
                        {it.preview}
                      </Caption>
                    ) : null}
                  </View>
                  <View
                    style={[styles.urgencyDot, { backgroundColor: urgencyColor(it.urgency) }]}
                  />
                </Pressable>
              );
            })
          )}
        </View>

        {/* Activity */}
        <View style={styles.sectionHeader}>
          <Kicker tone="muted">Actividad reciente</Kicker>
          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={() => router.push('/(admin)/activity' as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ver toda la actividad"
          >
            <Text style={styles.sectionLink}>Ver todo</Text>
          </Pressable>
        </View>

        <View style={styles.activityCard}>
          {loading && activity.length === 0 ? (
            <View style={styles.centerSmall}>
              <ActivityIndicator color={Colors.accentPrimary} />
            </View>
          ) : !loading && activityError ? (
            <Pressable
              style={({ pressed }) => [styles.centerSmall, pressed && styles.pressed]}
              onPress={load}
              accessibilityRole="button"
              accessibilityLabel="Reintentar cargar actividad"
            >
              <Feather name="alert-circle" size={16} color={Colors.accentDanger} style={{ marginBottom: 4 }} />
              <Caption style={{ color: Colors.accentDanger, fontWeight: '700' }}>
                No se pudo cargar · toca para reintentar
              </Caption>
            </Pressable>
          ) : activity.length === 0 ? (
            <Caption tone="muted" align="center" style={{ paddingVertical: 14 }}>
              Sin actividad reciente.
            </Caption>
          ) : (
            activity.map((a, i) => {
              const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.SIGNUP;
              return (
                <View
                  key={`${a.type}-${a.id}-${i}`}
                  style={[
                    styles.activityRow,
                    i === activity.length - 1 && styles.activityRowLast,
                  ]}
                >
                  <View style={[styles.activityDot, { backgroundColor: meta.color }]} />
                  <Body size="sm" style={{ flex: 1 }} numberOfLines={1}>
                    {a.text}
                  </Body>
                  <Caption tone="muted" size="sm">{relTime(a.when)}</Caption>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function urgencyColor(urgency: number): string {
  if (urgency >= 75) return Colors.accentDanger;
  if (urgency >= 50) return Colors.accentWarning;
  return Colors.textMuted;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },

  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[5],
    gap: Spacing[3],
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,97,0.30)',
  },
  modePillText: {
    ...TypePresets.label,
    color: Colors.accentPrimary,
    fontSize: 11,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '700', fontSize: 13 },

  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius['2xl'],
    backgroundColor: 'rgba(196,104,104,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,104,104,0.30)',
  },
  kpiRow: {
    paddingHorizontal: Spacing[5],
    gap: Spacing[2],
    paddingBottom: Spacing[2],
  },
  kpi: {
    width: 132,
    padding: Spacing[3],
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 4,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(201,169,97,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  insightsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginHorizontal: Spacing[5],
    marginTop: Spacing[3],
    marginBottom: 4,
    padding: Spacing[3],
    borderRadius: Radius['2xl'],
    backgroundColor: 'rgba(201,169,97,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,97,0.25)',
  },
  insightsCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(201,169,97,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[6],
    paddingBottom: Spacing[2],
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: { color: Colors.textInverse, fontSize: 10, fontWeight: '700' },
  sectionLink: {
    ...TypePresets.label,
    color: Colors.accentPrimary,
    fontSize: 11,
  },

  inboxCard: {
    marginHorizontal: Spacing[5],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  centerSmall: { padding: Spacing[6], alignItems: 'center', justifyContent: 'center' },
  inboxEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[7],
    gap: 4,
  },
  inboxEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(111,168,138,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  inboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  inboxItemLast: { borderBottomWidth: 0 },
  inboxIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },

  activityCard: {
    marginHorizontal: Spacing[5],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  activityRowLast: { borderBottomWidth: 0 },
  activityDot: { width: 6, height: 6, borderRadius: 3 },
});
