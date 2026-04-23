import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

type Campaign = {
  id: string;
  subject: string;
  template: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  audienceType: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  unsubCount: number;
  failCount: number;
  createdAt: string;
};

const STATUS_META: Record<Campaign['status'], { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Borrador',   color: Colors.textSecondary, bg: 'rgba(180,180,187,0.12)' },
  SCHEDULED: { label: 'Programada', color: Colors.accentInfo,    bg: 'rgba(96,165,250,0.14)' },
  SENDING:   { label: 'Enviando',   color: Colors.accentWarning, bg: 'rgba(244,163,64,0.14)' },
  SENT:      { label: 'Enviada',    color: Colors.accentSuccess, bg: 'rgba(56,199,147,0.14)' },
  FAILED:    { label: 'Fallida',    color: Colors.accentDanger,  bg: 'rgba(228,88,88,0.14)' },
  CANCELLED: { label: 'Cancelada',  color: Colors.textMuted,     bg: 'rgba(107,107,120,0.14)' },
};

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: 'Todos',
  NEW_7D: 'Nuevos (7d)',
  VIP: 'VIP',
  BIRTHDAY_MONTH: 'Cumpleañeros',
  INACTIVE_30D: 'Inactivos (30d)',
  CUSTOM: 'Segmento',
};

export default function MarketingList() {
  const router = useRouter();
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminApi.marketing.listCampaigns();
      setItems(res.data?.data ?? res.data ?? []);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'No pudimos cargar las campañas'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.hint}>Email marketing</Text>
          <Text style={styles.title}>Campañas</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(admin)/marketing/new' as never)}
          style={styles.newBtn}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={16} color={Colors.textInverse} />
          <Text style={styles.newBtnLabel}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentPrimary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="mail" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Aún no hay campañas</Text>
              <Text style={styles.emptySub}>
                Crea tu primer envío masivo — elige plantilla, audiencia y envía.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/(admin)/marketing/new' as never)}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={16} color={Colors.textInverse} />
                <Text style={styles.emptyBtnLabel}>Crear campaña</Text>
              </TouchableOpacity>
            </View>
          ) : (
            items.map((c) => {
              const meta = STATUS_META[c.status];
              const openRate = c.sentCount > 0
                ? Math.round((c.openCount / c.sentCount) * 100)
                : 0;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={styles.card}
                  onPress={() => router.push(`/(admin)/marketing/${c.id}` as never)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHead}>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={styles.audienceHint}>
                      {AUDIENCE_LABEL[c.audienceType] || c.audienceType}
                    </Text>
                  </View>

                  <Text style={styles.subject} numberOfLines={2}>{c.subject}</Text>

                  <View style={styles.statsRow}>
                    <Stat label="Enviados" value={`${c.sentCount}/${c.recipientCount}`} />
                    <View style={styles.statsDivider} />
                    <Stat label="Aperturas" value={`${openRate}%`} />
                    <View style={styles.statsDivider} />
                    <Stat label="Bajas" value={String(c.unsubCount)} />
                  </View>

                  {c.scheduledAt && c.status === 'SCHEDULED' ? (
                    <Text style={styles.footer}>
                      Programada · {new Date(c.scheduledAt).toLocaleString('es-MX', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  ) : c.sentAt ? (
                    <Text style={styles.footer}>
                      Enviada · {new Date(c.sentAt).toLocaleString('es-MX', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  ) : (
                    <Text style={styles.footer}>
                      Creada · {new Date(c.createdAt).toLocaleString('es-MX', {
                        day: '2-digit', month: 'short',
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
  },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 36, paddingHorizontal: 14,
    backgroundColor: Colors.accentPrimary, borderRadius: 18,
  },
  newBtnLabel: { color: Colors.textInverse, fontWeight: '700', fontSize: 13 },

  errorText: {
    color: Colors.accentDanger, fontSize: 13,
    marginBottom: 12, paddingHorizontal: 4,
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  audienceHint: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  subject: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 20 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    paddingVertical: 10,
  },
  statsDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: Colors.border },
  statValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },

  footer: { color: Colors.textMuted, fontSize: 11 },

  empty: {
    marginTop: 60, alignItems: 'center', gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 10 },
  emptySub: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 44, paddingHorizontal: 18,
    backgroundColor: Colors.accentPrimary, borderRadius: 22,
    marginTop: 8,
  },
  emptyBtnLabel: { color: Colors.textInverse, fontWeight: '800', fontSize: 14 },
});
