import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Button,
  Caption,
  ConfirmDialog,
  SegmentedControl,
  Subhead,
} from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import type { SegmentOption } from '@/components/ui';

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED';

export default function AdminReviewsList() {
  const goBack = useSafeBack('/(admin)/manage');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.reviews({ status: filter, limit: 100 });
      setReviews(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function moderate(id: string, status: 'PUBLISHED' | 'REJECTED', reason?: string) {
    try {
      await adminApi.moderateReview(id, status, reason);
      setReviews((p) => p.filter((r) => r.id !== id));
    } catch (err) {
      Alert.alert('Error', apiError(err));
    }
  }

  async function performHardDelete() {
    if (!confirmDel) return;
    const id = confirmDel;
    setConfirmDel(null);
    try {
      await adminApi.hardDeleteReview(id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo');
    }
  }

  const segments: SegmentOption<Filter>[] = [
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'APPROVED', label: 'Aprobadas' },
    { value: 'REJECTED', label: 'Rechazadas' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader title="Resenas" kicker="Moderacion" onBack={goBack} />

      <View style={styles.tabsWrap}>
        <SegmentedControl<Filter> value={filter} onChange={setFilter} options={segments} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
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
              <Feather name="star" size={32} color={Colors.textMuted} />
              <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
                Sin resenas en esta categoria.
              </Caption>
            </View>
          }
          renderItem={({ item }) => {
            const user = item.user;
            const name =
              `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() ||
              'Usuario';
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Body tone="inverse" weight="bold">
                      {name[0]?.toUpperCase() ?? '?'}
                    </Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Subhead>{name}</Subhead>
                    <Caption tone="muted" style={{ marginTop: 2 }}>
                      {item.venue?.name ?? '—'} · hace {relTime(item.createdAt)}
                    </Caption>
                  </View>
                  <Stars rating={item.rating ?? 0} />
                </View>
                {item.comment ? (
                  <Body size="sm" numberOfLines={4}>
                    {item.comment}
                  </Body>
                ) : null}
                <View style={styles.actions}>
                  {filter === 'PENDING' && (
                    <>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Rechazar"
                          variant="danger"
                          size="sm"
                          onPress={() => moderate(item.id, 'REJECTED', 'Inapropiado')}
                          leftIcon={<Feather name="x" size={13} color={Colors.accentDanger} />}
                        />
                      </View>
                      <View style={{ flex: 1.3 }}>
                        <Button
                          label="Aprobar"
                          variant="primary"
                          size="sm"
                          onPress={() => moderate(item.id, 'PUBLISHED')}
                          leftIcon={<Feather name="check" size={13} color={Colors.textInverse} />}
                        />
                      </View>
                    </>
                  )}
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Borrar"
                      variant="danger"
                      size="sm"
                      onPress={() => setConfirmDel(item.id)}
                      leftIcon={<Feather name="trash-2" size={13} color={Colors.accentDanger} />}
                    />
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={performHardDelete}
        title="Eliminar permanente?"
        description="La resena desaparecera. Solo para spam o abuso."
        confirmLabel="Eliminar"
        confirmVariant="danger"
      />
    </SafeAreaView>
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
    backgroundColor: Colors.accentChampagne,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actions: { flexDirection: 'row', gap: Spacing[2] },

  empty: { alignItems: 'center', paddingTop: 60 },
});
