// ─────────────────────────────────────────────
//  Mention Requests — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header
//   · FlatList of editorial request cards: avatar + name + tag intent
//     (post / story) + Approve / Reject buttons
//   · Optimistic approve/reject with toast feedback.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { mentionsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Button,
  Caption,
  FadeIn,
  Heading,
  Kicker,
  Pressy,
  SkeletonList,
  Subhead,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

const AVATAR_COLORS = ['#E89F4A', '#85ADCE', '#A8966F', '#7BB594', '#D96A6A', '#D7BE94'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type RequestRow = {
  id: string;
  targetType: 'POST' | 'STORY';
  targetId: string;
  createdAt: string;
  author: {
    id: string;
    profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
  };
  // Hydrated post/story so the row can show what you're actually tagged in.
  item?: {
    id: string;
    content?: string | null;
    imageUrl?: string | null;
    mediaUrl?: string | null;
    mediaUrls?: string[];
    userId?: string;
  };
};

export default function MentionRequests() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    mentionsApi
      .pending(50)
      .then((r) => setItems(r.data?.data ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function approve(row: RequestRow) {
    setBusy(row.id, true);
    const prev = items;
    setItems((p) => p.filter((r) => r.id !== row.id));
    try {
      await mentionsApi.approve(row.id);
      fb.success();
      toast(t ? 'Etiqueta aprobada.' : 'Tag approved.', 'success');
    } catch (err: any) {
      setItems(prev);
      fb.error();
      toast(apiError(err, t ? 'No se pudo aprobar.' : "Couldn't approve."), 'danger');
    } finally {
      setBusy(row.id, false);
    }
  }

  async function reject(row: RequestRow) {
    setBusy(row.id, true);
    const prev = items;
    setItems((p) => p.filter((r) => r.id !== row.id));
    try {
      await mentionsApi.reject(row.id);
      fb.tap();
      toast(t ? 'Etiqueta rechazada.' : 'Tag rejected.', 'info', 1800);
    } catch (err: any) {
      setItems(prev);
      fb.error();
      toast(apiError(err, t ? 'No se pudo rechazar.' : "Couldn't reject."), 'danger');
    } finally {
      setBusy(row.id, false);
    }
  }

  function openTarget(row: RequestRow) {
    if (row.targetType === 'POST') {
      router.push(`/(app)/community/posts/${row.targetId}` as never);
    } else {
      const ownerId = row.item?.userId ?? row.author.id;
      router.push(`/(app)/community/story-viewer?userId=${ownerId}&single=1` as never);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Atrás' : 'Back'}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <View style={styles.titleBlock}>
        <Kicker tone="muted">{t ? 'COMUNIDAD' : 'COMMUNITY'}</Kicker>
        <Heading size="md">{t ? 'Etiquetas pendientes' : 'Tag requests'}</Heading>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter }}>
          <SkeletonList count={4} itemHeight={112} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} retryLabel={t ? 'Reintentar' : 'Retry'} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{
            paddingHorizontal: EditorialSpacing.pageGutter,
            paddingBottom: Spacing[12],
            gap: Spacing[5],
          }}
          renderItem={({ item, index }) => (
            <FadeIn delay={50 * index}>
              <Row
                row={item}
                t={t}
                busy={busyIds.has(item.id)}
                onPress={() => openTarget(item)}
                onApprove={() => approve(item)}
                onReject={() => reject(item)}
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            <View style={{ minHeight: 320 }}>
              <EmptyState
                icon="user-check"
                title={t ? 'Sin etiquetas pendientes' : 'No pending tags'}
                message={
                  t
                    ? 'Cuando alguien intente etiquetarte, aparecerá aquí.'
                    : 'When someone tries to tag you, it will appear here.'
                }
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function Row({
  row,
  t,
  busy,
  onPress,
  onApprove,
  onReject,
}: {
  row: RequestRow;
  t: boolean;
  busy: boolean;
  onPress: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const a = row.author;
  const fn = a.profile?.firstName ?? '';
  const ln = a.profile?.lastName ?? '';
  const name = `${fn} ${ln}`.trim() || (t ? 'Usuario' : 'User');
  const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'U';
  const isStory = row.targetType === 'STORY';
  const thumbUrl = isStory ? row.item?.mediaUrl : (row.item?.imageUrl ?? row.item?.mediaUrls?.[0]);

  return (
    <View style={styles.requestRow}>
      <Pressy
        onPress={onPress}
        haptic="select"
        accessibilityRole={Roles.button}
        accessibilityLabel={name}
        style={styles.requestRowHead}
      >
        {a.profile?.avatarUrl ? (
          <Image source={{ uri: a.profile.avatarUrl }} style={styles.rowAvatar} />
        ) : (
          <View style={[styles.rowAvatar, { backgroundColor: colorFor(a.id) }]}>
            <Subhead tone="inverse">{initials}</Subhead>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Subhead numberOfLines={1}>{name}</Subhead>
          <Caption tone="muted" style={{ marginTop: 2 }}>
            {t
              ? isStory
                ? 'Quiere etiquetarte en una historia.'
                : 'Quiere etiquetarte en una publicación.'
              : isStory
                ? 'Wants to tag you in a story.'
                : 'Wants to tag you in a post.'}
          </Caption>
        </View>
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={styles.rowThumb}
            accessibilityLabel={
              isStory ? (t ? 'Vista previa de la historia' : 'Story preview') : (t ? 'Vista previa de la publicación' : 'Post preview')
            }
          />
        ) : !isStory && row.item?.content ? (
          <View style={styles.rowThumbText}>
            <Caption tone="secondary" numberOfLines={3}>
              {row.item.content}
            </Caption>
          </View>
        ) : null}
      </Pressy>

      <View style={styles.rowActions}>
        <View style={{ flex: 1 }}>
          <Button
            label={busy ? '' : t ? 'Aprobar' : 'Approve'}
            onPress={onApprove}
            variant="primary"
            size="sm"
            disabled={busy}
            loading={busy}
            fullWidth
            haptic="success"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t ? 'Rechazar' : 'Reject'}
            onPress={onReject}
            variant="secondary"
            size="sm"
            disabled={busy}
            fullWidth
            haptic="select"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  requestRow: {
    gap: Spacing[4],
    padding: Spacing[5],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  requestRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
  },
  rowAvatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowThumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
  },
  rowThumbText: {
    width: 64,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
    padding: Spacing[2],
    justifyContent: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
});
