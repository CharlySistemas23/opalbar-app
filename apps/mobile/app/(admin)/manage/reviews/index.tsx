// ─────────────────────────────────────────────
//  Admin · Reseñas — moderación
//
//  ReviewStatus real: PENDING_REVIEW | PUBLISHED | REJECTED | HIDDEN.
//  El texto de la reseña vive en `title` + `body` (no `comment`).
// ─────────────────────────────────────────────
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useFeedback } from '@/hooks/useFeedback';
import { useSafeBack } from '@/hooks/useSafeBack';
import { toast } from '@/components/Toast';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Button, Caption, SegmentedControl, SkeletonList, Subhead } from '@/components/ui';
import type { SegmentOption } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { AdminHeader, ReasonSheet } from '@/components/admin';

type Filter = 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN';

interface AdminReview {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  status: Filter;
  rejectionReason?: string | null;
  createdAt: string;
  venue?: { name?: string } | null;
  user?: { profile?: { firstName?: string; lastName?: string } | null } | null;
}

const REJECT_PRESETS = ['Spam', 'Lenguaje ofensivo', 'Fuera de tema', 'Contenido falso o engañoso'];
const PAGE = 20;

const EMPTY: Record<Filter, { title: string; message: string }> = {
  PENDING_REVIEW: { title: 'Todo al día', message: 'No hay reseñas pendientes de revisión.' },
  PUBLISHED: { title: 'Sin publicadas', message: 'Ninguna reseña está publicada todavía.' },
  REJECTED: { title: 'Sin rechazadas', message: 'Ninguna reseña ha sido rechazada.' },
  HIDDEN: { title: 'Nada oculto', message: 'No has ocultado ninguna reseña.' },
};

export default function AdminReviewsList() {
  const goBack = useSafeBack('/(admin)/manage');
  const fb = useFeedback();
  const me = useAuthStore((s) => s.user);
  const canDelete = me?.role === 'SUPER_ADMIN' || me?.role === 'ADMIN';

  const [filter, setFilter] = useState<Filter>('PENDING_REVIEW');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [meta, setMeta] = useState<{ page: number; hasNextPage: boolean }>({ page: 1, hasNextPage: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<AdminReview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApi.reviews({ status: f, page: 1, limit: PAGE });
      const payload = r.data?.data;
      setReviews(payload?.data ?? []);
      setMeta({ page: payload?.meta?.page ?? 1, hasNextPage: !!payload?.meta?.hasNextPage });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(filter); }, [load, filter]));

  async function loadMore() {
    if (loadingMore || loading || !meta.hasNextPage) return;
    setLoadingMore(true);
    try {
      const r = await adminApi.reviews({ status: filter, page: meta.page + 1, limit: PAGE });
      const payload = r.data?.data;
      const next: AdminReview[] = payload?.data ?? [];
      setReviews((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...next.filter((x) => !seen.has(x.id))];
      });
      setMeta({ page: payload?.meta?.page ?? meta.page + 1, hasNextPage: !!payload?.meta?.hasNextPage });
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setLoadingMore(false);
    }
  }

  function removeLocally(id: string) {
    setReviews((p) => p.filter((r) => r.id !== id));
  }

  async function moderate(review: AdminReview, status: 'PUBLISHED' | 'REJECTED' | 'HIDDEN', reason?: string) {
    if (busyId) return;
    setBusyId(review.id);
    const snapshot = reviews;
    removeLocally(review.id);
    try {
      await adminApi.moderateReview(review.id, status, reason);
      fb.success();
      toast(
        status === 'PUBLISHED' ? 'Reseña aprobada y publicada' : status === 'HIDDEN' ? 'Reseña ocultada' : 'Reseña rechazada',
        'success',
      );
    } catch (err) {
      setReviews(snapshot);
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  async function performHardDelete() {
    const review = deleteTarget;
    if (!review) return;
    setDeleteTarget(null);
    setBusyId(review.id);
    const snapshot = reviews;
    removeLocally(review.id);
    try {
      await adminApi.hardDeleteReview(review.id);
      fb.success();
      toast('Reseña eliminada', 'success');
    } catch (err) {
      setReviews(snapshot);
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  const segments: SegmentOption<Filter>[] = [
    { value: 'PENDING_REVIEW', label: 'Pendientes' },
    { value: 'PUBLISHED', label: 'Publicadas' },
    { value: 'REJECTED', label: 'Rechazadas' },
    { value: 'HIDDEN', label: 'Ocultas' },
  ];

  const empty = EMPTY[filter];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader title="Reseñas" kicker="Moderación" onBack={goBack} />

      <View style={styles.tabsWrap}>
        <SegmentedControl<Filter> value={filter} onChange={(v) => { fb.select(); setFilter(v); }} options={segments} />
      </View>

      {loading ? (
        <View style={{ padding: Spacing[5] }}>
          <SkeletonList count={4} itemHeight={130} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(filter)} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120, gap: Spacing[3] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(filter); }}
              tintColor={Colors.accentPrimary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <EmptyState icon="star" title={empty.title} message={empty.message} />
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
              'Usuario';
            const busy = busyId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Body tone="inverse" weight="bold">
                      {name[0]?.toUpperCase() ?? '?'}
                    </Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Subhead numberOfLines={1}>{name}</Subhead>
                    <Caption tone="muted" style={{ marginTop: 2 }}>
                      {item.venue?.name ?? '—'} · hace {relTime(item.createdAt)}
                    </Caption>
                  </View>
                  <Stars rating={item.rating ?? 0} />
                </View>
                {item.title ? (
                  <Body weight="semiBold" numberOfLines={1}>{item.title}</Body>
                ) : null}
                {item.body ? (
                  <Body size="sm" numberOfLines={4}>
                    {item.body}
                  </Body>
                ) : null}
                {item.status === 'REJECTED' && item.rejectionReason ? (
                  <View style={styles.reasonBox}>
                    <Feather name="info" size={12} color={Colors.accentDanger} />
                    <Caption style={{ color: Colors.accentDanger, flex: 1 }} numberOfLines={2}>
                      {item.rejectionReason}
                    </Caption>
                  </View>
                ) : null}
                <View style={styles.actions}>
                  {filter === 'PENDING_REVIEW' && (
                    <>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Rechazar"
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onPress={() => setRejectTarget(item)}
                          leftIcon={<Feather name="x" size={13} color={Colors.accentDanger} />}
                        />
                      </View>
                      <View style={{ flex: 1.3 }}>
                        <Button
                          label="Aprobar"
                          variant="primary"
                          size="sm"
                          disabled={busy}
                          onPress={() => moderate(item, 'PUBLISHED')}
                          leftIcon={<Feather name="check" size={13} color={Colors.textInverse} />}
                        />
                      </View>
                    </>
                  )}
                  {filter === 'PUBLISHED' && (
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Ocultar"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onPress={() => moderate(item, 'HIDDEN')}
                        leftIcon={<Feather name="eye-off" size={13} color={Colors.textSecondary} />}
                      />
                    </View>
                  )}
                  {filter === 'HIDDEN' && (
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Publicar"
                        variant="primary"
                        size="sm"
                        disabled={busy}
                        onPress={() => moderate(item, 'PUBLISHED')}
                        leftIcon={<Feather name="check" size={13} color={Colors.textInverse} />}
                      />
                    </View>
                  )}
                  {canDelete ? (
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Borrar"
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onPress={() => setDeleteTarget(item)}
                        leftIcon={<Feather name="trash-2" size={13} color={Colors.accentDanger} />}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      <ReasonSheet
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Rechazar reseña"
        subtitle="Se le informará al autor con este motivo."
        presets={REJECT_PRESETS}
        minLength={3}
        maxLength={500}
        confirmLabel="Rechazar"
        variant="danger"
        onConfirm={(reason) => {
          const r = rejectTarget;
          setRejectTarget(null);
          if (r) moderate(r, 'REJECTED', reason);
        }}
      />

      <ConfirmSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar reseña"
        message="La reseña desaparecerá permanentemente. Úsalo solo para spam o abuso."
        icon="trash-2"
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={performHardDelete}
        loading={!!deleteTarget && busyId === deleteTarget.id}
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
  reasonBox: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(196,104,104,0.10)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[2],
    paddingVertical: 6,
  },

  actions: { flexDirection: 'row', gap: Spacing[2] },
});
