// ─────────────────────────────────────────────
//  Admin · Comunidad — feed de moderación estilo Facebook
//
//  Los posts se publican al instante; aquí el equipo los verifica
//  después. Tabs por estado + "Reportados" (≥1 reporte pendiente).
//  Acciones por tarjeta: Verificar / Ocultar / Rechazar / Fijar /
//  Eliminar / Ver reportes. Long-press = selección múltiple.
// ─────────────────────────────────────────────
import { View, StyleSheet, FlatList, RefreshControl, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useFeedback } from '@/hooks/useFeedback';
import { useRealtime } from '@/hooks/useRealtime';
import { useSafeBack } from '@/hooks/useSafeBack';
import { toast } from '@/components/Toast';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Button, Caption, Input, SegmentedControl, SkeletonList } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import {
  AdminHeader,
  PostModerationCard,
  ReasonSheet,
  postAuthorName,
  type AdminPost,
} from '@/components/admin';

type Tab = 'PUBLISHED' | 'PENDING_REVIEW' | 'HIDDEN' | 'REJECTED' | 'REPORTED';

const TABS: { value: Tab; label: string }[] = [
  { value: 'PUBLISHED', label: 'Publicados' },
  { value: 'PENDING_REVIEW', label: 'Pendientes' },
  { value: 'HIDDEN', label: 'Ocultos' },
  { value: 'REJECTED', label: 'Rechazados' },
  { value: 'REPORTED', label: 'Reportados' },
];

const REJECT_PRESETS = ['Spam', 'Lenguaje ofensivo', 'Fuera de tema', 'Contenido inapropiado'];
const PAGE = 20;

const EMPTY: Record<Tab, { title: string; message: string }> = {
  PUBLISHED: { title: 'Sin publicaciones', message: 'Cuando la comunidad publique, aparecerá aquí.' },
  PENDING_REVIEW: { title: 'Todo al día', message: 'No hay posts pendientes de revisión.' },
  HIDDEN: { title: 'Nada oculto', message: 'No has ocultado ningún post.' },
  REJECTED: { title: 'Sin rechazados', message: 'Ningún post ha sido rechazado.' },
  REPORTED: { title: 'Sin reportes', message: 'Ningún post tiene reportes pendientes.' },
};

export default function CommunityModeration() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const fb = useFeedback();

  const [tab, setTab] = useState<Tab>('PUBLISHED');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [meta, setMeta] = useState<{ page: number; hasNextPage: boolean; total: number }>({ page: 1, hasNextPage: false, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<AdminPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPost | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkVerifyOpen, setBulkVerifyOpen] = useState(false);

  const reqId = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const params = useCallback(
    (page: number) => ({
      page,
      limit: PAGE,
      ...(tab === 'REPORTED' ? { reported: 1 as const } : { status: tab }),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [tab, search],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const id = ++reqId.current;
      if (!opts?.silent) { setLoading(true); setError(null); }
      try {
        const r = await adminApi.posts(params(1));
        if (id !== reqId.current) return;
        const payload = r.data?.data;
        setPosts(payload?.data ?? []);
        setMeta({
          page: payload?.meta?.page ?? 1,
          hasNextPage: !!payload?.meta?.hasNextPage,
          total: payload?.meta?.total ?? payload?.data?.length ?? 0,
        });
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(apiError(err));
      } finally {
        if (id === reqId.current) { setLoading(false); setRefreshing(false); }
      }
    },
    [params],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !meta.hasNextPage) return;
    setLoadingMore(true);
    try {
      const r = await adminApi.posts(params(meta.page + 1));
      const payload = r.data?.data;
      const next: AdminPost[] = payload?.data ?? [];
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
      setMeta({
        page: payload?.meta?.page ?? meta.page + 1,
        hasNextPage: !!payload?.meta?.hasNextPage,
        total: payload?.meta?.total ?? meta.total,
      });
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, meta, params]);

  // Tab change → immediate reload. Search → debounced.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { load(); }, search ? 350 : 0);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [load, search]);

  useRealtime(['post', 'report'], () => { load({ silent: true }); });

  function exitSelectMode() { setSelectMode(false); setSelected(new Set()); }
  function toggleSelect(id: string) {
    fb.tap();
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // ── Single actions (optimistic + revert) ──
  function removeLocally(id: string) {
    setPosts((p) => p.filter((x) => x.id !== id));
    setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
  }
  function patchLocally(id: string, patch: Partial<AdminPost>) {
    setPosts((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function setStatus(post: AdminPost, status: 'PUBLISHED' | 'HIDDEN' | 'REJECTED', reason?: string) {
    if (busyId) return;
    setBusyId(post.id);
    const snapshot = posts;
    const staysInTab = tab === 'REPORTED';
    if (staysInTab) patchLocally(post.id, { status, rejectionReason: reason ?? post.rejectionReason });
    else removeLocally(post.id);
    try {
      await adminApi.updatePostStatus(post.id, status, reason);
      fb.success();
      toast(
        status === 'PUBLISHED' ? 'Post verificado y publicado' : status === 'HIDDEN' ? 'Post oculto del feed' : 'Post rechazado',
        'success',
      );
    } catch (err) {
      setPosts(snapshot);
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  async function togglePin(post: AdminPost) {
    if (busyId) return;
    setBusyId(post.id);
    const next = !post.isPinned;
    patchLocally(post.id, { isPinned: next });
    try {
      await adminApi.pinPost(post.id, next);
      fb.success();
      toast(next ? 'Post fijado en el feed' : 'Post desfijado', 'success');
    } catch (err) {
      patchLocally(post.id, { isPinned: !next });
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  async function doDelete() {
    const post = deleteTarget;
    if (!post) return;
    setDeleteTarget(null);
    setBusyId(post.id);
    const snapshot = posts;
    removeLocally(post.id);
    try {
      await adminApi.deletePost(post.id);
      fb.success();
      toast('Post eliminado', 'success');
    } catch (err) {
      setPosts(snapshot);
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  // ── Bulk ──
  async function bulk(kind: 'verify' | 'reject', reason?: string) {
    setBulkRejectOpen(false);
    setBulkVerifyOpen(false);
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const snapshot = posts;
    setPosts((p) => p.filter((x) => !selected.has(x.id)));
    try {
      const r = kind === 'verify' ? await adminApi.bulkApprovePosts(ids) : await adminApi.bulkRejectPosts(ids, reason);
      const data = r.data?.data ?? {};
      exitSelectMode();
      fb.success();
      toast(
        `${data.processed ?? ids.length} ${kind === 'verify' ? 'verificados' : 'rechazados'}${data.skipped ? ` · ${data.skipped} omitidos` : ''}`,
        'success',
      );
      load({ silent: true });
    } catch (err) {
      setPosts(snapshot);
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBulkBusy(false);
    }
  }

  const openDetail = (post: AdminPost) => router.push(`/(admin)/manage/community/${post.id}` as never);
  const empty = EMPTY[tab];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {selectMode ? (
        <AdminHeader
          title={`${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`}
          kicker="Moderación"
          onBack={exitSelectMode}
          right={
            <Pressable
              onPress={() => { fb.tap(); setSelected(new Set(posts.map((p) => p.id))); }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Seleccionar todo"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Feather name="check-square" size={16} color={Colors.textPrimary} />
            </Pressable>
          }
        />
      ) : (
        <AdminHeader
          title="Comunidad"
          kicker="Moderación"
          onBack={goBack}
          right={
            <View style={styles.counter}>
              <Caption tone="accent" style={{ fontWeight: '700' }}>
                {meta.total}
              </Caption>
            </View>
          }
        />
      )}

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ marginHorizontal: -Spacing[5] }} contentContainerStyle={{ paddingHorizontal: Spacing[5] }}>
          <SegmentedControl<Tab> value={tab} onChange={(v) => { fb.select(); setTab(v); exitSelectMode(); }} options={TABS} fullWidth={false} />
        </ScrollView>
        <Input
          placeholder="Buscar por texto, nombre o correo"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon={<Feather name="search" size={14} color={Colors.textMuted} />}
          rightIcon={search ? <Feather name="x" size={14} color={Colors.textMuted} /> : undefined}
          onRightIconPress={search ? () => setSearch('') : undefined}
          rightIconLabel="Limpiar búsqueda"
        />
      </View>

      {loading ? (
        <View style={{ padding: Spacing[5] }}>
          <SkeletonList count={4} itemHeight={150} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: Spacing[5], paddingTop: Spacing[2], paddingBottom: selectMode ? 120 : 40, gap: Spacing[3] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load({ silent: true }); }} tintColor={Colors.accentPrimary} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'REPORTED' ? 'flag' : tab === 'PENDING_REVIEW' ? 'check-circle' : 'inbox'}
              title={search ? 'Sin resultados' : empty.title}
              message={search ? `Nada coincide con “${search.trim()}”.` : empty.message}
              tint={tab === 'PENDING_REVIEW' ? Colors.accentSuccess : undefined}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: Spacing[4] }}>
                <ActivityIndicator color={Colors.accentPrimary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PostModerationCard
              post={item}
              selectable={selectMode}
              selected={selected.has(item.id)}
              hideActions={selectMode}
              busy={busyId === item.id || bulkBusy}
              onPress={(p) => (selectMode ? toggleSelect(p.id) : openDetail(p))}
              onLongPress={(p) => {
                if (!selectMode) { fb.select(); setSelectMode(true); setSelected(new Set([p.id])); }
              }}
              onVerify={(p) => setStatus(p, 'PUBLISHED')}
              onHide={(p) => setStatus(p, 'HIDDEN')}
              onReject={(p) => setRejectTarget(p)}
              onTogglePin={togglePin}
              onDelete={(p) => setDeleteTarget(p)}
              onViewReports={openDetail}
            />
          )}
        />
      )}

      {selectMode ? (
        <View style={styles.bulkBar}>
          <View style={{ flex: 1 }}>
            <Button
              label={`Rechazar (${selected.size})`}
              variant="danger"
              onPress={() => setBulkRejectOpen(true)}
              disabled={selected.size === 0 || bulkBusy}
              loading={bulkBusy}
              leftIcon={<Feather name="x" size={14} color={Colors.accentDanger} />}
            />
          </View>
          <View style={{ flex: 1.3 }}>
            <Button
              label={`Verificar (${selected.size})`}
              variant="primary"
              onPress={() => setBulkVerifyOpen(true)}
              disabled={selected.size === 0 || bulkBusy}
              loading={bulkBusy}
              leftIcon={<Feather name="check" size={14} color={Colors.textInverse} />}
            />
          </View>
        </View>
      ) : null}

      <ReasonSheet
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Rechazar post"
        subtitle={rejectTarget ? `Se notificará a ${postAuthorName(rejectTarget)} con el motivo.` : undefined}
        presets={REJECT_PRESETS}
        minLength={3}
        maxLength={500}
        confirmLabel="Rechazar"
        variant="danger"
        onConfirm={(reason) => {
          const p = rejectTarget;
          setRejectTarget(null);
          if (p) setStatus(p, 'REJECTED', reason);
        }}
      />

      <ReasonSheet
        open={bulkRejectOpen}
        onClose={() => setBulkRejectOpen(false)}
        title={`Rechazar ${selected.size} post${selected.size === 1 ? '' : 's'}`}
        presets={REJECT_PRESETS}
        minLength={3}
        maxLength={500}
        confirmLabel="Rechazar todos"
        variant="danger"
        onConfirm={(reason) => bulk('reject', reason)}
      />

      <ConfirmSheet
        visible={bulkVerifyOpen}
        onClose={() => setBulkVerifyOpen(false)}
        title={`Verificar ${selected.size} post${selected.size === 1 ? '' : 's'}`}
        message="Se marcarán como publicados y verificados por el equipo."
        icon="check-circle"
        variant="success"
        confirmLabel="Verificar"
        onConfirm={() => bulk('verify')}
        loading={bulkBusy}
      />

      <ConfirmSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar post"
        message={deleteTarget ? `El post de ${postAuthorName(deleteTarget)} desaparecerá del feed y de su perfil. Esta acción no se puede deshacer.` : ''}
        icon="trash-2"
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={doDelete}
        loading={!!deleteTarget && busyId === deleteTarget.id}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    minWidth: 40,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(201,169,97,0.14)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[2], gap: Spacing[3] },
  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing[2],
    padding: Spacing[4],
    paddingBottom: Spacing[6],
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
