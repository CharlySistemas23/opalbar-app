// ─────────────────────────────────────────────
//  Admin · Post — detalle de moderación
//
//  Usa el endpoint admin (cualquier estado, correo del autor, reportes
//  y bitácora). Mismas acciones que el feed.
// ─────────────────────────────────────────────
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useFeedback } from '@/hooks/useFeedback';
import { useRealtime } from '@/hooks/useRealtime';
import { useSafeBack } from '@/hooks/useSafeBack';
import { toast } from '@/components/Toast';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Caption, Kicker, Skeleton, Subhead } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import {
  AdminHeader,
  PostModerationCard,
  ReasonSheet,
  StatusPill,
  postAuthorName,
  relTime,
  type AdminPost,
} from '@/components/admin';

const REJECT_PRESETS = ['Spam', 'Lenguaje ofensivo', 'Fuera de tema', 'Contenido inapropiado'];

const REASON_LABEL: Record<string, string> = {
  SPAM: 'Spam',
  HATE_SPEECH: 'Discurso de odio',
  VIOLENCE: 'Violencia',
  MISINFORMATION: 'Desinformación',
  INAPPROPRIATE: 'Inapropiado',
  COPYRIGHT: 'Derechos de autor',
  OTHER: 'Otro',
};
const REPORT_STATUS: Record<string, { label: string; tone: 'warning' | 'info' | 'success' | 'neutral' }> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  REVIEWED: { label: 'Revisado', tone: 'info' },
  RESOLVED: { label: 'Resuelto', tone: 'success' },
  DISMISSED: { label: 'Descartado', tone: 'neutral' },
};
const LOG_ACTION: Record<string, string> = {
  APPROVED: 'Verificado',
  REJECTED: 'Rechazado',
  HIDDEN: 'Oculto',
  WARNED: 'Advertencia',
  BANNED_USER: 'Usuario suspendido',
  ESCALATED: 'Escalado',
};

type Detail = AdminPost & {
  reports?: any[];
  moderationLog?: any[];
  user?: AdminPost['user'] & { status?: string; _count?: { posts?: number; reportedItems?: number } };
};

export default function PostModerationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage/community');
  const fb = useFeedback();

  const [post, setPost] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    if (!id) return;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const r = await adminApi.post(id);
      setPost(r.data?.data ?? null);
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useRealtime(['post', 'report'], (env) => { if (!env.id || env.id === id) load(true); });

  async function setStatus(status: 'PUBLISHED' | 'HIDDEN' | 'REJECTED', reason?: string) {
    if (!post || busy) return;
    setBusy(true);
    const prev = post;
    setPost({ ...post, status, rejectionReason: reason ?? post.rejectionReason });
    try {
      const r = await adminApi.updatePostStatus(post.id, status, reason);
      if (r.data?.data) setPost(r.data.data);
      fb.success();
      toast(
        status === 'PUBLISHED' ? 'Post verificado y publicado' : status === 'HIDDEN' ? 'Post oculto del feed' : 'Post rechazado',
        'success',
      );
    } catch (err) {
      setPost(prev);
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    if (!post || busy) return;
    setBusy(true);
    const next = !post.isPinned;
    setPost({ ...post, isPinned: next });
    try {
      await adminApi.pinPost(post.id, next);
      fb.success();
      toast(next ? 'Post fijado en el feed' : 'Post desfijado', 'success');
    } catch (err) {
      setPost({ ...post, isPinned: !next });
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!post) return;
    setDeleteOpen(false);
    setBusy(true);
    try {
      await adminApi.deletePost(post.id);
      fb.success();
      toast('Post eliminado', 'success');
      goBack();
    } catch (err) {
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setBusy(false);
    }
  }

  const reports = post?.reports ?? [];
  const log = post?.moderationLog ?? [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Revisar post"
        kicker="Moderación"
        onBack={goBack}
        right={
          post && post.status === 'PUBLISHED' ? (
            <Pressable
              onPress={() => router.push(`/(app)/community/posts/${post.id}` as never)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Ver en el feed"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Feather name="eye" size={16} color={Colors.textPrimary} />
            </Pressable>
          ) : undefined
        }
      />

      {loading ? (
        <View style={{ padding: Spacing[5], gap: Spacing[3] }}>
          <Skeleton height={220} radius={Radius['2xl']} />
          <Skeleton height={120} radius={Radius['2xl']} />
        </View>
      ) : error || !post ? (
        <ErrorState message={error ?? 'Post no encontrado'} onRetry={() => load()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing[5], paddingBottom: 60, gap: Spacing[3] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.accentPrimary} />
          }
        >
          <PostModerationCard
            post={post}
            expanded
            busy={busy}
            onVerify={() => setStatus('PUBLISHED')}
            onHide={() => setStatus('HIDDEN')}
            onReject={() => setRejectOpen(true)}
            onTogglePin={togglePin}
            onDelete={() => setDeleteOpen(true)}
          />

          {/* Author */}
          <Pressable
            onPress={() => post.user?.id && router.push(`/(admin)/users/${post.user.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir perfil de ${postAuthorName(post)}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Kicker tone="muted">Autor</Kicker>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Subhead>{postAuthorName(post)}</Subhead>
                <Caption tone="muted">{post.user?.email ?? '—'}</Caption>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.textMuted} />
            </View>
            <View style={styles.metaRow}>
              {post.user?.role ? <StatusPill label={post.user.role} tone={post.user.role === 'USER' ? 'neutral' : 'accent'} /> : null}
              {post.user?.status ? (
                <StatusPill label={post.user.status === 'ACTIVE' ? 'Activo' : post.user.status} tone={post.user.status === 'ACTIVE' ? 'success' : 'danger'} />
              ) : null}
              <Caption tone="muted">{post.user?._count?.posts ?? 0} posts</Caption>
              <Caption tone="muted">· {post.user?._count?.reportedItems ?? 0} reportes recibidos</Caption>
            </View>
          </Pressable>

          {/* Reports */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Kicker tone="muted">Reportes</Kicker>
              <Caption tone={reports.length ? 'danger' : 'muted'}>{reports.length}</Caption>
            </View>
            {reports.length === 0 ? (
              <EmptyState icon="flag" title="Sin reportes" message="Nadie ha reportado este post." bareIcon />
            ) : (
              reports.map((rep) => {
                const st = REPORT_STATUS[rep.status] ?? REPORT_STATUS.PENDING;
                const who = `${rep.reporter?.profile?.firstName ?? ''} ${rep.reporter?.profile?.lastName ?? ''}`.trim() || rep.reporter?.email || 'Usuario';
                return (
                  <Pressable
                    key={rep.id}
                    onPress={() => router.push(`/(admin)/reports/${rep.id}` as never)}
                    accessibilityRole="button"
                    accessibilityLabel={`Reporte de ${who}`}
                    style={({ pressed }) => [styles.reportRow, pressed && styles.pressed]}
                  >
                    <View style={styles.reportIcon}>
                      <Feather name="flag" size={14} color={Colors.accentDanger} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.row}>
                        <Body size="sm" weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                          {REASON_LABEL[rep.reason] ?? rep.reason}
                        </Body>
                        <StatusPill label={st.label} tone={st.tone} />
                      </View>
                      {rep.description ? (
                        <Caption tone="secondary" numberOfLines={2}>{rep.description}</Caption>
                      ) : null}
                      <Caption tone="muted" size="sm">{who} · {relTime(rep.createdAt)}</Caption>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* Moderation log */}
          {log.length > 0 ? (
            <View style={styles.card}>
              <Kicker tone="muted">Bitácora</Kicker>
              {log.map((entry) => {
                const mod = `${entry.moderator?.profile?.firstName ?? ''} ${entry.moderator?.profile?.lastName ?? ''}`.trim() || entry.moderator?.email || 'Sistema';
                return (
                  <View key={entry.id} style={styles.logRow}>
                    <View style={styles.logDot} />
                    <View style={{ flex: 1 }}>
                      <Body size="sm">
                        <Body size="sm" weight="semiBold">{LOG_ACTION[entry.action] ?? entry.action}</Body>
                        {' · '}{mod}
                      </Body>
                      {entry.reason ? <Caption tone="secondary">{entry.reason}</Caption> : null}
                      <Caption tone="muted" size="sm">{relTime(entry.createdAt)}</Caption>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      )}

      <ReasonSheet
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Rechazar post"
        subtitle={post ? `Se notificará a ${postAuthorName(post)} con el motivo.` : undefined}
        presets={REJECT_PRESETS}
        minLength={3}
        maxLength={500}
        confirmLabel="Rechazar"
        variant="danger"
        onConfirm={(reason) => { setRejectOpen(false); setStatus('REJECTED', reason); }}
      />

      <ConfirmSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar post"
        message="El post desaparecerá del feed y del perfil del autor. Esta acción no se puede deshacer."
        icon="trash-2"
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={doDelete}
        loading={busy}
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
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    gap: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  reportRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    paddingVertical: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  reportIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(196,104,104,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logRow: { flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start' },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentPrimary, marginTop: 6 },
});
