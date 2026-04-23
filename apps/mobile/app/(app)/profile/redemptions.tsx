import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { offersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, Radius } from '@/constants/tokens';

type Tab = 'ACTIVE' | 'USED' | 'EXPIRED';

interface Redemption {
  id: string;
  code: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  pointsSpent?: number;
  expiresAt?: string;
  usedAt?: string;
  createdAt: string;
  offer: {
    id: string;
    title: string;
    imageUrl?: string;
    pointsCost?: number;
    venue?: { name?: string };
  };
}

export default function Redemptions() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tab, setTab] = useState<Tab>('ACTIVE');
  const [items, setItems] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await offersApi.myRedemptions();
      setItems(r.data?.data?.data ?? r.data?.data ?? []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => items.filter((x) => x.status === tab), [items, tab]);

  const counts = useMemo(() => ({
    ACTIVE: items.filter((x) => x.status === 'ACTIVE').length,
    USED: items.filter((x) => x.status === 'USED').length,
    EXPIRED: items.filter((x) => x.status === 'EXPIRED' || x.status === 'CANCELLED').length,
  }), [items]);

  const TABS: { key: Tab; es: string; en: string; color: string }[] = [
    { key: 'ACTIVE', es: 'Activos', en: 'Active', color: Colors.accentSuccess },
    { key: 'USED', es: 'Canjeados', en: 'Used', color: Colors.accentPrimary },
    { key: 'EXPIRED', es: 'Expirados', en: 'Expired', color: Colors.textMuted },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Historial de canjes' : 'Redemption history'}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((x) => {
          const active = tab === x.key;
          return (
            <TouchableOpacity
              key={x.key}
              style={[styles.tab, active && { borderBottomColor: x.color }]}
              onPress={() => setTab(x.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabLbl, active && { color: Colors.textPrimary }]}>
                {t ? x.es : x.en} · {counts[x.key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="gift"
          title={tab === 'ACTIVE'
            ? t ? 'No tienes canjes activos' : 'No active redemptions'
            : tab === 'USED'
              ? t ? 'Aún no has canjeado nada' : 'Nothing redeemed yet'
              : t ? 'Sin canjes expirados' : 'No expired redemptions'}
          actionLabel={tab === 'ACTIVE' ? (t ? 'Ver ofertas' : 'See offers') : undefined}
          onAction={tab === 'ACTIVE' ? () => router.push('/(app)/offers' as never) : undefined}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/(app)/offers/${item.offer.id}` as never)}
            >
              {item.offer.imageUrl ? (
                <Image source={{ uri: item.offer.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Feather name="tag" size={22} color={Colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.offer.title}</Text>
                {item.offer.venue?.name ? (
                  <Text style={styles.cardSub} numberOfLines={1}>{item.offer.venue.name}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Feather
                    name={item.status === 'ACTIVE' ? 'clock' : item.status === 'USED' ? 'check-circle' : 'x-circle'}
                    size={11}
                    color={statusColor(item.status)}
                  />
                  <Text style={[styles.metaText, { color: statusColor(item.status) }]}>
                    {statusLabel(item.status, t)}
                  </Text>
                  {item.pointsSpent ? (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Feather name="star" size={11} color={Colors.accentPrimary} />
                      <Text style={styles.metaText}>{item.pointsSpent}</Text>
                    </>
                  ) : null}
                </View>
                <Text style={styles.code}>{t ? 'Código' : 'Code'}: <Text style={styles.codeVal}>{item.code}</Text></Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function statusColor(s: Redemption['status']) {
  return s === 'ACTIVE' ? Colors.accentSuccess : s === 'USED' ? Colors.accentPrimary : Colors.textMuted;
}
function statusLabel(s: Redemption['status'], t: boolean) {
  if (s === 'ACTIVE') return t ? 'Listo para canjear' : 'Ready to redeem';
  if (s === 'USED') return t ? 'Canjeado' : 'Used';
  if (s === 'EXPIRED') return t ? 'Expirado' : 'Expired';
  return t ? 'Cancelado' : 'Cancelled';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLbl: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.accentPrimary, marginTop: 4 },
  retryLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  ctaBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.accentPrimary, marginTop: 8 },
  ctaLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },

  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    padding: 12, backgroundColor: Colors.bgCard,
    borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.border,
  },
  thumb: { width: 68, height: 68, borderRadius: 10, backgroundColor: Colors.bgElevated },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  cardSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  metaDot: { color: Colors.textMuted, fontSize: 11, marginHorizontal: 2 },
  code: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  codeVal: { color: Colors.textPrimary, fontWeight: '700', letterSpacing: 1 },
});
