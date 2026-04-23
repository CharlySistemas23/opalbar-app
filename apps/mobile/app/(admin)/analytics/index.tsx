import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { Colors } from '@/constants/tokens';

// ─────────────────────────────────────────────
//  Admin · Analytics / "Mis clientes"
//  Per-user detail lives in (admin)/users/[id]. This screen answers the
//  aggregate question: who are my customers and what do they want?
// ─────────────────────────────────────────────

type Insights = {
  totals: {
    totalActive: number;
    signups30d: number;
    activeLast7d: number;
    averagePoints: number;
    totalPointsInCirculation: number;
  };
  signupsByDay: { day: string; count: number }[];
  statusBreakdown: { key: string; count: number }[];
  genderBreakdown: { key: string; count: number }[];
  discoveryBreakdown: { key: string; count: number }[];
  ageBuckets: Record<string, number>;
  topCities: { city: string; count: number }[];
  topInterests: {
    categoryId: string;
    name: string;
    slug?: string;
    color?: string;
    icon?: string;
    count: number;
  }[];
  loyaltyBreakdown: { id: string | null; name: string; color?: string; count: number }[];
  engagementBuckets: Record<string, number>;
  reservationHours: { hour: string; count: number }[];
  reservationDow: { dow: number; count: number }[];
  topUsers: {
    id: string;
    email: string | null;
    points: number;
    profile?: {
      firstName: string;
      lastName: string;
      avatarUrl?: string | null;
      loyaltyLevel?: { name: string; color?: string } | null;
    } | null;
  }[];
};

const GENDER_LABEL: Record<string, string> = {
  FEMALE: 'Mujer',
  MALE: 'Hombre',
  NON_BINARY: 'No binario',
  OTHER: 'Otro',
  PREFER_NOT_TO_SAY: 'Prefiere no decir',
  UNKNOWN: 'Sin dato',
};

const DISCOVERY_LABEL: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  FRIEND: 'Amigo',
  WALKED_BY: 'Pasó por aquí',
  EVENT: 'Evento',
  INFLUENCER: 'Influencer',
  OTHER: 'Otro',
  UNKNOWN: 'Sin dato',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  BANNED: 'Baneado',
  PENDING_VERIFICATION: 'Pendiente',
  DELETED: 'Eliminado',
};

const DOW_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const ENGAGEMENT_LABEL: Record<string, { label: string; color: string }> = {
  inactive: { label: 'Sin posts', color: '#6B6B78' },
  casual: { label: '1–2 posts', color: '#60A5FA' },
  engaged: { label: '3–9 posts', color: Colors.accentPrimary },
  super: { label: '10+ posts', color: '#EC4899' },
};

export default function AdminAnalytics() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.audienceInsights();
      setInsights((r.data?.data ?? r.data) as Insights);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const signupSparkline = useMemo(() => {
    if (!insights) return null;
    const days = insights.signupsByDay.slice(-30);
    const max = Math.max(1, ...days.map((d) => d.count));
    const total = days.reduce((a, d) => a + d.count, 0);
    return { days, max, total };
  }, [insights]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Feather name="users" size={16} color={Colors.accentPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mis clientes</Text>
          <Text style={styles.subtitle}>Qué les gusta, quiénes son y cómo se mueven</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 16 }}
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
        {loading ? (
          <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 40 }} />
        ) : error || !insights ? (
          <View style={styles.errorBox}>
            <Feather name="alert-triangle" size={16} color={Colors.accentDanger} />
            <Text style={styles.errorText}>{error ?? 'Sin datos'}</Text>
          </View>
        ) : (
          <>
            {/* KPI row */}
            <View style={styles.kpiRow}>
              <KpiTile
                label="Clientes activos"
                value={insights.totals.totalActive}
                icon="users"
                color={Colors.accentPrimary}
              />
              <KpiTile
                label="Nuevos 30 días"
                value={insights.totals.signups30d}
                icon="trending-up"
                color={Colors.accentSuccess}
              />
              <KpiTile
                label="Activos 7 días"
                value={insights.totals.activeLast7d}
                icon="zap"
                color="#60A5FA"
              />
              <KpiTile
                label="Puntos prom."
                value={insights.totals.averagePoints}
                icon="award"
                color="#EC4899"
              />
            </View>

            {/* Signups sparkline */}
            {signupSparkline && signupSparkline.days.length > 0 && (
              <Card>
                <SectionHeader
                  icon="bar-chart-2"
                  title="Signups últimos 30 días"
                  subtitle={`${signupSparkline.total} registros`}
                />
                <View style={styles.sparkRow}>
                  {signupSparkline.days.map((d) => {
                    const h = Math.max(2, Math.round((d.count / signupSparkline.max) * 72));
                    return (
                      <View key={d.day} style={styles.sparkBarWrap}>
                        <View style={[styles.sparkBar, { height: h }]} />
                      </View>
                    );
                  })}
                </View>
                <View style={styles.sparkAxisRow}>
                  <Text style={styles.sparkAxis}>
                    {signupSparkline.days[0]?.day?.slice(5) ?? ''}
                  </Text>
                  <Text style={styles.sparkAxis}>
                    {signupSparkline.days[signupSparkline.days.length - 1]?.day?.slice(5) ?? ''}
                  </Text>
                </View>
              </Card>
            )}

            {/* Top interests */}
            <Card>
              <SectionHeader
                icon="heart"
                title="Qué les interesa"
                subtitle="Categorías más elegidas"
              />
              {insights.topInterests.length === 0 ? (
                <EmptyHint text="Aún nadie ha seleccionado intereses" />
              ) : (
                insights.topInterests.map((row, i) => (
                  <BarRow
                    key={row.categoryId}
                    rank={i + 1}
                    label={row.name}
                    count={row.count}
                    max={insights.topInterests[0].count}
                    color={row.color ?? Colors.accentPrimary}
                  />
                ))
              )}
            </Card>

            {/* Demographics grid */}
            <View style={styles.twoCol}>
              <Card style={{ flex: 1 }}>
                <SectionHeader icon="user" title="Edad" />
                {Object.entries(insights.ageBuckets).map(([bucket, count]) => (
                  <MiniBar
                    key={bucket}
                    label={bucket}
                    count={count}
                    max={Math.max(1, ...Object.values(insights.ageBuckets))}
                  />
                ))}
              </Card>
              <Card style={{ flex: 1 }}>
                <SectionHeader icon="users" title="Género" />
                {insights.genderBreakdown.length === 0 ? (
                  <EmptyHint text="Sin datos" />
                ) : (
                  insights.genderBreakdown.map((row) => (
                    <MiniBar
                      key={row.key}
                      label={GENDER_LABEL[row.key] ?? row.key}
                      count={row.count}
                      max={Math.max(...insights.genderBreakdown.map((r) => r.count))}
                    />
                  ))
                )}
              </Card>
            </View>

            {/* Discovery source */}
            <Card>
              <SectionHeader
                icon="compass"
                title="Cómo nos conocen"
                subtitle="Canal de adquisición"
              />
              {insights.discoveryBreakdown.length === 0 ? (
                <EmptyHint text="Sin datos — activa la pregunta en el signup" />
              ) : (
                insights.discoveryBreakdown
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <BarRow
                      key={row.key}
                      label={DISCOVERY_LABEL[row.key] ?? row.key}
                      count={row.count}
                      max={Math.max(...insights.discoveryBreakdown.map((r) => r.count))}
                      color="#A855F7"
                    />
                  ))
              )}
            </Card>

            {/* Top cities */}
            {insights.topCities.length > 0 && (
              <Card>
                <SectionHeader icon="map-pin" title="De dónde vienen" />
                {insights.topCities.map((row) => (
                  <BarRow
                    key={row.city}
                    label={row.city}
                    count={row.count}
                    max={insights.topCities[0].count}
                    color="#60A5FA"
                  />
                ))}
              </Card>
            )}

            {/* Engagement buckets */}
            <Card>
              <SectionHeader
                icon="activity"
                title="Nivel de engagement"
                subtitle="Por volumen de publicaciones"
              />
              <View style={styles.engagementRow}>
                {Object.entries(insights.engagementBuckets).map(([k, count]) => {
                  const meta = ENGAGEMENT_LABEL[k] ?? { label: k, color: Colors.accentPrimary };
                  const total = Object.values(insights.engagementBuckets).reduce((a, b) => a + b, 0) || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <View key={k} style={styles.engagementTile}>
                      <View style={[styles.engagementDot, { backgroundColor: meta.color }]} />
                      <Text style={styles.engagementCount}>{count}</Text>
                      <Text style={styles.engagementLabel}>{meta.label}</Text>
                      <Text style={styles.engagementPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Reservation patterns */}
            {insights.reservationHours.length > 0 && (
              <Card>
                <SectionHeader
                  icon="clock"
                  title="A qué hora reservan"
                  subtitle="Últimos 90 días"
                />
                <View style={styles.hourRow}>
                  {insights.reservationHours.map((h) => {
                    const max = Math.max(...insights.reservationHours.map((x) => x.count));
                    const height = Math.max(4, Math.round((h.count / max) * 60));
                    return (
                      <View key={h.hour} style={styles.hourBarWrap}>
                        <Text style={styles.hourValue}>{h.count || ''}</Text>
                        <View style={[styles.hourBar, { height }]} />
                        <Text style={styles.hourLabel}>{h.hour}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            )}

            {insights.reservationDow.length > 0 && (
              <Card>
                <SectionHeader icon="calendar" title="Qué días reservan" />
                <View style={styles.dowRow}>
                  {insights.reservationDow.map((d) => {
                    const max = Math.max(...insights.reservationDow.map((x) => x.count));
                    const height = Math.max(4, Math.round((d.count / max) * 60));
                    return (
                      <View key={d.dow} style={styles.hourBarWrap}>
                        <Text style={styles.hourValue}>{d.count || ''}</Text>
                        <View style={[styles.hourBar, { height, backgroundColor: '#FBBF24' }]} />
                        <Text style={styles.hourLabel}>{DOW_LABEL[d.dow]}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            )}

            {/* Loyalty */}
            {insights.loyaltyBreakdown.length > 0 && (
              <Card>
                <SectionHeader icon="award" title="Niveles de lealtad" />
                {insights.loyaltyBreakdown
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <BarRow
                      key={row.id ?? 'none'}
                      label={row.name}
                      count={row.count}
                      max={Math.max(...insights.loyaltyBreakdown.map((r) => r.count))}
                      color={row.color ?? Colors.accentPrimary}
                    />
                  ))}
              </Card>
            )}

            {/* Status */}
            <Card>
              <SectionHeader icon="shield" title="Estado de cuentas" />
              <View style={styles.statusRow}>
                {insights.statusBreakdown.map((row) => (
                  <View key={row.key} style={styles.statusChip}>
                    <Text style={styles.statusChipLabel}>
                      {STATUS_LABEL[row.key] ?? row.key}
                    </Text>
                    <Text style={styles.statusChipCount}>{row.count}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Top users */}
            {insights.topUsers.length > 0 && (
              <Card>
                <SectionHeader icon="star" title="Top 10 por puntos" />
                {insights.topUsers.map((u, i) => {
                  const name =
                    `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.trim() ||
                    u.email ||
                    'Usuario';
                  return (
                    <View key={u.id} style={styles.topUserRow}>
                      <Text style={styles.topUserRank}>#{i + 1}</Text>
                      {u.profile?.avatarUrl ? (
                        <Image source={{ uri: u.profile.avatarUrl }} style={styles.topUserAvatar} />
                      ) : (
                        <View style={[styles.topUserAvatar, styles.topUserAvatarFallback]}>
                          <Text style={styles.topUserInitials}>
                            {name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.topUserName}>{name}</Text>
                        {u.profile?.loyaltyLevel?.name && (
                          <Text
                            style={[
                              styles.topUserLoyalty,
                              u.profile.loyaltyLevel.color
                                ? { color: u.profile.loyaltyLevel.color }
                                : null,
                            ]}
                          >
                            {u.profile.loyaltyLevel.name}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.topUserPoints}>{u.points} pts</Text>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function Card({ children, style }: any) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionHeader({ icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon} size={14} color={Colors.accentPrimary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function BarRow({
  label,
  count,
  max,
  color,
  rank,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
  rank?: number;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 2;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelBox}>
        {rank != null && <Text style={styles.barRank}>#{rank}</Text>}
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barCount}>{count}</Text>
    </View>
  );
}

function MiniBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(3, Math.round((count / max) * 100)) : 3;
  return (
    <View style={styles.miniRow}>
      <Text style={styles.miniLabel}>{label}</Text>
      <View style={styles.miniTrack}>
        <View style={[styles.miniFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.miniCount}>{count}</Text>
    </View>
  );
}

function KpiTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  return (
    <View style={styles.kpiTile}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '22' }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Feather name="info" size={12} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    padding: 14,
  },
  errorText: { color: Colors.accentDanger, fontSize: 13, flex: 1 },

  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiTile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },

  twoCol: { flexDirection: 'row', gap: 10 },

  // Bar rows
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabelBox: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 110 },
  barRank: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    width: 18,
  },
  barLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600', flex: 1 },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5 },
  barCount: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    width: 34,
    textAlign: 'right',
  },

  // Mini bars (dense 2-col cards)
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  miniLabel: { color: Colors.textPrimary, fontSize: 11, width: 46 },
  miniTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  miniFill: { height: '100%', backgroundColor: Colors.accentPrimary, borderRadius: 3 },
  miniCount: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    width: 22,
    textAlign: 'right',
  },

  // Signups sparkline
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 80,
  },
  sparkBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  sparkBar: {
    width: '100%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 2,
    minHeight: 2,
  },
  sparkAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sparkAxis: { color: Colors.textMuted, fontSize: 9 },

  // Engagement
  engagementRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  engagementTile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  engagementDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  engagementCount: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  engagementLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  engagementPct: { color: Colors.textMuted, fontSize: 10 },

  // Hour / DOW bars
  hourRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 2,
  },
  hourBarWrap: { flex: 1, alignItems: 'center', gap: 2 },
  hourValue: { color: Colors.textMuted, fontSize: 9, fontWeight: '700' },
  hourBar: {
    width: '80%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 3,
    minHeight: 2,
  },
  hourLabel: { color: Colors.textSecondary, fontSize: 9, fontWeight: '600' },
  dowRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },

  // Status
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusChipLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  statusChipCount: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },

  // Top users
  topUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  topUserRank: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    width: 22,
  },
  topUserAvatar: { width: 32, height: 32, borderRadius: 16 },
  topUserAvatarFallback: {
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUserInitials: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  topUserName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  topUserLoyalty: { color: Colors.accentPrimary, fontSize: 10, fontWeight: '700' },
  topUserPoints: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '800' },

  // Empty
  empty: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  emptyText: { color: Colors.textMuted, fontSize: 11, flex: 1 },
});
