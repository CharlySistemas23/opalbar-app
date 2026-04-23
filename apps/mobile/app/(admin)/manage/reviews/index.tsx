import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED';

export default function AdminReviewsList() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('PENDING');

  const load = useCallback(async () => {
    try {
      const r = await adminApi.reviews({ status: filter, limit: 100 });
      setReviews(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function moderate(id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    try {
      await adminApi.moderateReview(id, status, reason);
      setReviews((p) => p.filter((r) => r.id !== id));
    } catch (err) { Alert.alert('Error', apiError(err)); }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Reseñas</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <Tab active={filter === 'PENDING'} label="Pendientes" onPress={() => setFilter('PENDING')} />
        <Tab active={filter === 'APPROVED'} label="Aprobadas" onPress={() => setFilter('APPROVED')} />
        <Tab active={filter === 'REJECTED'} label="Rechazadas" onPress={() => setFilter('REJECTED')} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="star" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Sin reseñas en esta categoría.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const user = item.user;
            const name = `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || 'Usuario';
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{name[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.authorName}>{name}</Text>
                    <Text style={styles.meta}>
                      {item.venue?.name ?? '—'} · hace {relTime(item.createdAt)}
                    </Text>
                  </View>
                  <Stars rating={item.rating ?? 0} />
                </View>
                {item.comment ? (
                  <Text style={styles.body} numberOfLines={4}>{item.comment}</Text>
                ) : null}
                {filter === 'PENDING' && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => moderate(item.id, 'REJECTED', 'Inapropiado')}>
                      <Feather name="x" size={14} color={Colors.accentDanger} />
                      <Text style={styles.rejectLbl}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => moderate(item.id, 'APPROVED')}>
                      <Feather name="check" size={14} color={Colors.textInverse} />
                      <Text style={styles.approveLbl}>Aprobar</Text>
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
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Feather
          key={n}
          name="star"
          size={13}
          color={n <= rating ? Colors.accentPrimary : Colors.border}
        />
      ))}
    </View>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  tab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EC4899',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 13 },
  authorName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  meta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  body: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },

  actions: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 36, borderRadius: 10,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  rejectLbl: { color: Colors.accentDanger, fontSize: 12, fontWeight: '700' },
  approveBtn: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 36, borderRadius: 10,
    backgroundColor: Colors.accentSuccess,
  },
  approveLbl: { color: Colors.textInverse, fontSize: 12, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
