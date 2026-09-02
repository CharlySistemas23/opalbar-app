// ─────────────────────────────────────────────
//  Friends — Editorial Premium
//
//  Magazine roster (same shell as Followers/Following).
//   · Any user's accepted friends via GET /users/:id/friends (paginated).
//     Private accounts → backend 403 → ErrorState ("Cuenta privada").
//   · Segments: Todos · En común (mutual=1) when viewing someone else.
//   · Inline filter by name; tap → profile; "…" → remove friend (owner only,
//     ConfirmSheet, optimistic with revert).
//   · Realtime: friendship events involving me refresh the list.
// ─────────────────────────────────────────────
import { FlatList, Image, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { friendshipsApi, usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Badge,
  Body,
  Caption,
  Hairline,
  Heading,
  Input,
  Kicker,
  Pressy,
  SegmentedControl,
  SkeletonList,
} from '@/components/ui';
import type { SegmentOption } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { toast } from '@/components/Toast';
import { useFeedback } from '@/hooks/useFeedback';
import { useRealtime } from '@/hooks/useRealtime';

interface UserRecord {
  id: string;
  isPrivate?: boolean;
  friendshipId?: string;
  since?: string;
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string | null };
}

interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

type Segment = 'all' | 'mutual';
const PAGE_SIZE = 30;

export default function Friends() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const isMe = me?.id === id;

  const [segment, setSegment] = useState<Segment>(tab === 'mutual' && !isMe ? 'mutual' : 'all');
  const [items, setItems] = useState<UserRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pendingRemove, setPendingRemove] = useState<UserRecord | null>(null);
  const [removing, setRemoving] = useState(false);

  // Stale-response guard: only the latest request may write state.
  const reqRef = useRef(0);

  const fetchPage = useCallback(
    async (page: number, seg: Segment) => {
      const reqId = ++reqRef.current;
      const r = await usersApi.friends(id, {
        page,
        limit: PAGE_SIZE,
        ...(seg === 'mutual' ? { mutual: 1 as const } : {}),
      });
      if (reqId !== reqRef.current) return null;
      const payload = r.data?.data ?? {};
      const rows: UserRecord[] = Array.isArray(payload.data) ? payload.data : [];
      const m: PageMeta | null = payload.meta ?? null;
      return { rows, meta: m };
    },
    [id],
  );

  const load = useCallback(
    async (seg: Segment, silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetchPage(1, seg);
        if (!res) return;
        setItems(res.rows);
        setMeta(res.meta);
        setError(null);
      } catch (err) {
        if (!silent) setError(apiError(err));
        else toast(apiError(err), 'danger');
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !meta?.hasNextPage) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(meta.page + 1, segment);
      if (!res) return;
      setItems((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...res.rows.filter((u) => !seen.has(u.id))];
      });
      setMeta(res.meta);
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loading, loadingMore, meta, segment]);

  useEffect(() => {
    void load(segment);
  }, [id, segment, load]);

  // Friendship changes involving me (accept/remove/block) → silent refresh.
  useRealtime('user', (env) => {
    const d: any = env?.data ?? {};
    if (!d?.friendship) return;
    const touchesList =
      isMe || env?.id === id || d?.by === id || (Array.isArray(d?.userIds) && d.userIds.includes(id));
    if (touchesList) void load(segment, true);
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => {
      const name = `${u?.profile?.firstName ?? ''} ${u?.profile?.lastName ?? ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [items, query]);

  async function confirmRemove() {
    const target = pendingRemove;
    if (!target || removing) return;
    setRemoving(true);
    const snapshotItems = items;
    const snapshotMeta = meta;
    // Optimistic: drop the row and decrement the count.
    setItems((prev) => prev.filter((u) => u.id !== target.id));
    setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
    try {
      await friendshipsApi.remove(target.id);
      setPendingRemove(null);
      fb.tap();
      toast(t ? 'Amistad eliminada.' : 'Friend removed.', 'info');
    } catch (err) {
      setItems(snapshotItems);
      setMeta(snapshotMeta);
      fb.error();
      toast(apiError(err), 'danger');
    } finally {
      setRemoving(false);
    }
  }

  const total = meta?.total ?? items.length;
  const segmentOptions: SegmentOption<Segment>[] = [
    { value: 'all', label: t ? 'Todos' : 'All' },
    { value: 'mutual', label: t ? 'En común' : 'Mutual' },
  ];
  const isPrivateError = !!error && /privad|private/i.test(error);
  const pendingName = pendingRemove
    ? `${pendingRemove.profile?.firstName ?? ''} ${pendingRemove.profile?.lastName ?? ''}`.trim()
    : '';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          hitSlop={HitSlop.expand}
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Volver' : 'Back'}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressy>
        <View style={styles.headerTitleBlock}>
          {total > 0 ? <Kicker tone="muted">{`${total}`}</Kicker> : null}
          <Heading size="md" style={{ marginTop: total > 0 ? Spacing[1] : 0 }}>
            {segment === 'mutual' ? (t ? 'Amigos en común' : 'Mutual friends') : t ? 'Amigos' : 'Friends'}
          </Heading>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!isMe ? (
        <View style={styles.segmentWrap}>
          <SegmentedControl value={segment} onChange={setSegment} options={segmentOptions} fullWidth />
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[4] }}>
          <SkeletonList count={6} itemHeight={64} />
        </View>
      ) : error && items.length === 0 ? (
        isPrivateError ? (
          <EmptyState
            icon="lock"
            title={t ? 'Cuenta privada' : 'Private account'}
            message={
              t
                ? 'Sigue a esta persona o agrégala como amigo para ver su lista de amigos.'
                : 'Follow this person or add them as a friend to see their friends list.'
            }
            actionLabel={t ? 'Ver perfil' : 'View profile'}
            onAction={() => router.back()}
          />
        ) : (
          <ErrorState
            message={error}
            retryLabel={t ? 'Reintentar' : 'Retry'}
            onRetry={() => load(segment)}
          />
        )
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.body, filtered.length === 0 && { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          ListHeaderComponent={
            items.length > 0 ? (
              <View style={styles.searchWrap}>
                <Input
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t ? 'Buscar entre amigos' : 'Search friends'}
                  leftIcon={<Feather name="search" size={16} color={Colors.textMuted} />}
                  rightIcon={
                    query ? <Feather name="x" size={16} color={Colors.textMuted} /> : undefined
                  }
                  onRightIconPress={query ? () => setQuery('') : undefined}
                  rightIconLabel={t ? 'Limpiar' : 'Clear'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            items.length > 0 ? (
              <EmptyState
                icon="search"
                title={t ? 'Sin resultados' : 'No results'}
                message={
                  t
                    ? 'Ningún amigo coincide con tu búsqueda.'
                    : 'No friend matches your search.'
                }
              />
            ) : segment === 'mutual' ? (
              <EmptyState
                icon="users"
                title={t ? 'Sin amigos en común' : 'No mutual friends'}
                message={
                  t
                    ? 'Aún no comparten amigos.'
                    : "You don't share any friends yet."
                }
              />
            ) : (
              <EmptyState
                icon="users"
                title={isMe ? (t ? 'Sin amigos aún' : 'No friends yet') : t ? 'Sin amigos' : 'No friends'}
                message={
                  isMe
                    ? t
                      ? 'Busca personas y envía solicitudes para empezar tu círculo.'
                      : 'Find people and send requests to start your circle.'
                    : t
                      ? 'Esta persona aún no tiene amigos.'
                      : 'This person has no friends yet.'
                }
                actionLabel={isMe ? (t ? 'Buscar personas' : 'Find people') : undefined}
                onAction={isMe ? () => router.push('/(app)/search' as never) : undefined}
              />
            )
          }
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.rowShell,
                index === 0 && styles.rowShellFirst,
                index === filtered.length - 1 && styles.rowShellLast,
              ]}
            >
              <UserRow
                u={item}
                t={t}
                onPress={() => router.push(`/(app)/users/${item.id}` as never)}
                onMore={isMe ? () => setPendingRemove(item) : undefined}
              />
              {index < filtered.length - 1 ? (
                <Hairline variant="subtle" marginHorizontal={Spacing[5]} />
              ) : null}
            </View>
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={Colors.accentPrimary} />
              </View>
            ) : null
          }
        />
      )}

      <ConfirmSheet
        visible={!!pendingRemove}
        onClose={() => (removing ? undefined : setPendingRemove(null))}
        icon="user-minus"
        variant="danger"
        title={t ? 'Eliminar amistad' : 'Remove friend'}
        message={
          t
            ? `¿Seguro que quieres dejar de ser amigo de ${pendingName || 'esta persona'}?`
            : `Are you sure you want to remove ${pendingName || 'this person'} as a friend?`
        }
        confirmLabel={t ? 'Eliminar' : 'Remove'}
        onConfirm={confirmRemove}
        loading={removing}
      />
    </SafeAreaView>
  );
}

function UserRow({
  u,
  t,
  onPress,
  onMore,
}: {
  u: UserRecord;
  t: boolean;
  onPress: () => void;
  onMore?: () => void;
}) {
  const first = u?.profile?.firstName ?? '';
  const last = u?.profile?.lastName ?? '';
  const fullName = `${first} ${last}`.trim() || (t ? 'Usuario' : 'User');
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';

  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={fullName}
      style={styles.row}
    >
      {u?.profile?.avatarUrl ? (
        <Image source={{ uri: u.profile.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Body weight="semiBold" numberOfLines={1}>
          {fullName}
        </Body>
        {u.since ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {t ? 'Amigos desde' : 'Friends since'} {formatSince(u.since, t)}
          </Caption>
        ) : null}
      </View>
      {u.isPrivate ? <Badge label={t ? 'Privado' : 'Private'} size="sm" outline /> : null}
      {onMore ? (
        <Pressy
          onPress={onMore}
          haptic="select"
          hitSlop={HitSlop.expand}
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Más opciones' : 'More options'}
          style={styles.moreBtn}
        >
          <Feather name="more-horizontal" size={18} color={Colors.textMuted} />
        </Pressy>
      ) : (
        <Feather name="chevron-right" size={18} color={Colors.textMuted} />
      )}
    </Pressy>
  );
}

function formatSince(iso: string, es: boolean) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(es ? 'es-MX' : 'en-US', { month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
    gap: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  headerTitleBlock: { flex: 1 },

  segmentWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[3],
  },

  body: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[10],
  },
  searchWrap: {
    marginBottom: Spacing[4],
  },

  rowShell: {
    backgroundColor: Colors.bgCard,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  rowShellFirst: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.highlightTop,
  },
  rowShellLast: {
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[5],
    minHeight: 64,
  },
  rowText: { flex: 1 },
  moreBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    ...TypePresets.label,
    color: Colors.textPrimary,
    fontSize: 12,
  },
  footer: {
    paddingVertical: Spacing[5],
    alignItems: 'center',
  },
});
