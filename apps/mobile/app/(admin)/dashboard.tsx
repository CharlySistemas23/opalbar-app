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
import { Colors } from '@/constants/tokens';

// ─────────────────────────────────────────────
//  Admin Dashboard — rethought for elegance + signal
//  · Hero greeting + user avatar (top-right)
//  · 4 KPI chips in horizontal scroll (flat, airy)
//  · Unified Inbox (primary work area)
//  · Activity feed (secondary, compact)
//  · No duplicate quick actions (those live in Manage)
// ─────────────────────────────────────────────

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

const ACTIVITY_META: Record<string, { icon: FeatherIcon; color: string }> = {
  SIGNUP: { icon: 'user-plus', color: Colors.accentPrimary },
  RESERVATION: { icon: 'calendar', color: '#60A5FA' },
  POST: { icon: 'message-square', color: Colors.accentSuccess },
  REPORT: { icon: 'flag', color: Colors.accentDanger },
};

const INBOX_META: Record<string, { icon: FeatherIcon; color: string }> = {
  FLAG: { icon: 'alert-triangle', color: Colors.accentDanger },
  REPORT: { icon: 'flag', color: Colors.accentDanger },
  TICKET: { icon: 'life-buoy', color: '#60A5FA' },
  POST: { icon: 'message-square', color: Colors.accentSuccess },
  REVIEW: { icon: 'star', color: Colors.accentWarning },
  RESERVATION: { icon: 'calendar', color: Colors.accentPrimary },
};

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
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

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { counts, refresh: refreshCounts } = useAdminCounts();

  const load = useCallback(async () => {
    try {
      const [sRes, aRes, iRes] = await Promise.all([
        adminApi.stats().catch(() => null),
        adminApi.activity(6).catch(() => null),
        adminApi.inbox(5).catch(() => null),
      ]);
      setStats(sRes?.data?.data ?? sRes?.data ?? null);
      setActivity(aRes?.data?.data ?? aRes?.data ?? []);
      const inboxData = iRes?.data?.data ?? iRes?.data ?? {};
      setInbox(inboxData.items ?? []);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
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
      { label: 'Usuarios', value: stats?.totalUsers ?? 0, color: Colors.accentPrimary, icon: 'users' as FeatherIcon },
      { label: 'Eventos hoy', value: stats?.activeEvents ?? 0, color: Colors.accentSuccess, icon: 'calendar' as FeatherIcon },
      { label: 'Reservas pend.', value: stats?.pendingReservations ?? 0, color: Colors.accentInfo, icon: 'bookmark' as FeatherIcon },
      { label: 'Reportes', value: stats?.openReports ?? 0, color: Colors.accentDanger, icon: 'flag' as FeatherIcon },
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
        {/* ── Hero header ─────────────────────── */}
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>
              {getGreeting()},
            </Text>
            <Text style={styles.heroName} numberOfLines={1}>
              {user?.profile?.firstName ?? 'Admin'}
            </Text>
            <Text style={styles.heroSub}>
              {new Date().toLocaleDateString('es', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>

          <View style={styles.heroActions}>
            <Pressable
              style={({ pressed }) => [styles.modePill, pressed && styles.pressed]}
              onPress={() => router.replace('/(tabs)/home' as never)}
              hitSlop={6}
            >
              <Feather name="smartphone" size={13} color={Colors.accentPrimary} />
              <Text style={styles.modePillText}>Usuario</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/profile' as never)}
              hitSlop={6}
            >
              {user?.profile?.avatarUrl ? (
                <Text style={styles.avatarText}>{initials}</Text>
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── KPI row (horizontal scroll, airy chips) ─ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiRow}
        >
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpi}>
              <View style={[styles.kpiIconBox, { backgroundColor: k.color + '1F' }]}>
                <Feather name={k.icon} size={15} color={k.color} />
              </View>
              {loading ? (
                <ActivityIndicator color={k.color} size="small" style={{ marginTop: 8 }} />
              ) : (
                <Text style={styles.kpiValue}>{k.value}</Text>
              )}
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── Mis clientes CTA ──────────────── */}
        <Pressable
          style={({ pressed }) => [styles.insightsCta, pressed && styles.pressed]}
          onPress={() => router.push('/(admin)/analytics' as never)}
        >
          <View style={styles.insightsCtaIcon}>
            <Feather name="bar-chart-2" size={18} color={Colors.accentPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightsCtaTitle}>Mis clientes</Text>
            <Text style={styles.insightsCtaSub}>
              Quiénes son, qué les interesa, cómo te encontraron
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={Colors.textMuted} />
        </Pressable>

        {/* ── Inbox ──────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Bandeja de hoy</Text>
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
          >
            <Text style={styles.sectionLink}>Gestionar</Text>
          </Pressable>
        </View>

        <View style={styles.inboxCard}>
          {loading && inbox.length === 0 ? (
            <View style={styles.centerSmall}>
              <ActivityIndicator color={Colors.accentPrimary} />
            </View>
          ) : inbox.length === 0 ? (
            <View style={styles.inboxEmpty}>
              <View style={styles.inboxEmptyIcon}>
                <Feather name="check" size={22} color={Colors.accentSuccess} />
              </View>
              <Text style={styles.inboxEmptyTitle}>Todo al día</Text>
              <Text style={styles.inboxEmptySub}>Nada pendiente. Buen trabajo.</Text>
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
                  onPress={() => router.push(it.deepLink as never)}
                >
                  <View style={[styles.inboxIcon, { backgroundColor: meta.color + '1F' }]}>
                    <Feather name={meta.icon} size={15} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inboxTitle} numberOfLines={1}>
                      {it.title}
                    </Text>
                    {it.preview ? (
                      <Text style={styles.inboxPreview} numberOfLines={1}>
                        {it.preview}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.urgencyDot, { backgroundColor: urgencyColor(it.urgency) }]} />
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Activity ────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={() => router.push('/(admin)/activity' as never)}
            hitSlop={8}
          >
            <Text style={styles.sectionLink}>Ver todo</Text>
          </Pressable>
        </View>

        <View style={styles.activityCard}>
          {loading && activity.length === 0 ? (
            <View style={styles.centerSmall}>
              <ActivityIndicator color={Colors.accentPrimary} />
            </View>
          ) : activity.length === 0 ? (
            <Text style={styles.activityEmpty}>Sin actividad reciente.</Text>
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
                  <Text style={styles.activityText} numberOfLines={1}>
                    {a.text}
                  </Text>
                  <Text style={styles.activityTime}>{relTime(a.when)}</Text>
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

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  heroGreeting: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  heroName: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 3,
    textTransform: 'capitalize',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244,163,64,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,163,64,0.3)',
  },
  modePillText: { color: Colors.accentPrimary, fontSize: 11, fontWeight: '700' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 14 },

  // KPI row
  kpiRow: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 8,
  },

  // Insights CTA
  insightsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(244,163,64,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,163,64,0.35)',
  },
  insightsCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsCtaTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  insightsCtaSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  kpi: {
    width: 130,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 4,
  },
  kpiIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiValue: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  kpiLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: { color: Colors.textInverse, fontSize: 11, fontWeight: '800' },
  sectionLink: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '600' },

  // Inbox card
  inboxCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  centerSmall: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  inboxEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  inboxEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56,199,147,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  inboxEmptyTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  inboxEmptySub: { color: Colors.textMuted, fontSize: 12 },

  inboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  inboxItemLast: { borderBottomWidth: 0 },
  inboxIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  inboxPreview: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  urgencyDot: { width: 7, height: 7, borderRadius: 3.5 },

  // Activity
  activityCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  activityEmpty: { color: Colors.textMuted, fontSize: 12, paddingVertical: 14, textAlign: 'center' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  activityRowLast: { borderBottomWidth: 0 },
  activityDot: { width: 7, height: 7, borderRadius: 3.5 },
  activityText: { flex: 1, color: Colors.textPrimary, fontSize: 13 },
  activityTime: { color: Colors.textMuted, fontSize: 11 },
});
