// ─────────────────────────────────────────────
//  Notifications — Editorial Premium inbox
//
//  Magazine layout:
//   · Kicker + Heading header + "Marcar todo" ghost action
//   · SectionList grouped by bucket (HOY / AYER / ESTA SEMANA / ANTERIORES)
//   · Typed row renderers: actor avatar OR icon, unread amber dot,
//     stacked avatars for aggregation.
//   · Loading: SkeletonList. Error: ErrorState. Empty: EmptyState.
//   · Live: useRealtime('notification') prepends new rows and mirrors
//     mark-read/delete done elsewhere (push tap, another session).
//   · Routing: shared routeForNotifData (same table as push taps / banner).
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { notificationsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { routeForNotifData } from '@/lib/notif-routing';
import { useRealtime } from '@/hooks/useRealtime';
import { clearOsBadge } from '@/hooks/usePushRegistration';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
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

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

type NotifActor = {
  id?: string;
  name?: string;
  avatarUrl?: string;
};

type Notif = {
  id: string;
  type?: string;
  title?: string;
  titleEn?: string;
  body?: string;
  bodyEn?: string;
  message?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt?: string;
  imageUrl?: string;
  targetId?: string;
  data?: {
    actorId?: string;
    actorAvatarUrl?: string;
    actorName?: string;
    actors?: NotifActor[];
    aggregatedCount?: number;
    postId?: string;
    eventId?: string;
    offerId?: string;
    targetId?: string;
    threadId?: string;
    venueId?: string;
    reservationId?: string;
    commentId?: string;
    deepLink?: string;
  };
};

function iconForType(type: string): { icon: FeatherIcon; color: string } {
  const t = type?.toUpperCase() ?? '';
  if (t.includes('FOLLOW')) return { icon: 'user-plus', color: Colors.accentSuccess };
  if (t.includes('LIKE') || t.includes('REACTION'))
    return { icon: 'heart', color: Colors.accentDanger };
  if (t.includes('COMMENT') || t.includes('MESSAGE') || t.includes('REPLY') || t.includes('MENTION'))
    return { icon: 'message-circle', color: Colors.accentInfo };
  if (t.includes('RESERVATION') || t.includes('BOOKING'))
    return { icon: 'calendar', color: Colors.accentPrimary };
  if (t.includes('EVENT')) return { icon: 'music', color: Colors.accentPrimary };
  if (t.includes('OFFER')) return { icon: 'tag', color: Colors.accentPrimary };
  if (t.includes('POINTS') || t.includes('LEVEL') || t.includes('WALLET'))
    return { icon: 'star', color: Colors.accentChampagne };
  if (t.includes('STORY') || t.includes('NEW_POST') || t.includes('POST_APPROVED'))
    return { icon: 'image', color: Colors.accentPrimary };
  if (t.includes('REJECTED') || t.includes('ALERT'))
    return { icon: 'alert-triangle', color: Colors.accentDanger };
  if (t.includes('SYSTEM')) return { icon: 'info', color: Colors.textSecondary };
  return { icon: 'bell', color: Colors.accentPrimary };
}

function relTime(d?: string, es = true) {
  if (!d) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return es ? 'ahora' : 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d`;
  if (diff < 30 * 86400) return `${Math.floor(diff / (7 * 86400))} sem`;
  return `${Math.floor(diff / (30 * 86400))} mes`;
}

type Bucket = 'today' | 'yesterday' | 'week' | 'older';

function bucketOf(d?: string): Bucket {
  if (!d) return 'older';
  const created = new Date(d);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400_000;
  const startOfWeek = startOfToday - 6 * 86400_000;
  const t = created.getTime();
  if (t >= startOfToday) return 'today';
  if (t >= startOfYesterday) return 'yesterday';
  if (t >= startOfWeek) return 'week';
  return 'older';
}

const BUCKET_LABEL: Record<Bucket, { es: string; en: string }> = {
  today: { es: 'HOY', en: 'TODAY' },
  yesterday: { es: 'AYER', en: 'YESTERDAY' },
  week: { es: 'ESTA SEMANA', en: 'THIS WEEK' },
  older: { es: 'ANTERIORES', en: 'EARLIER' },
};

export default function Notifications() {
  const router = useRouter();
  const { language } = useAppStore();
  const es = language === 'es';

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await notificationsApi.list({ page: 1, limit: PAGE_SIZE });
      const payload = r.data?.data ?? r.data ?? {};
      const rows: Notif[] = payload.data ?? payload.items ?? payload ?? [];
      setItems(rows);
      if (typeof payload.unreadCount === 'number') setUnreadCount(payload.unreadCount);
      setPage(1);
      setHasMore(rows.length >= PAGE_SIZE);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await notificationsApi.list({ page: next, limit: PAGE_SIZE });
      const payload = r.data?.data ?? r.data ?? {};
      const rows: Notif[] = payload.data ?? payload.items ?? payload ?? [];
      if (rows.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...rows.filter((r) => !seen.has(r.id))];
        });
        setPage(next);
        if (rows.length < PAGE_SIZE) setHasMore(false);
      }
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore]);

  useEffect(() => { load(); }, [load]);
  // The OS badge is a "you have unread pushes" signal — once the inbox is
  // open the in-app unread count is the source of truth, so clear it.
  useEffect(() => { clearOsBadge(); }, []);

  const isRead = (n: Notif) => !!(n.read ?? n.isRead);

  // Live: prepend brand-new notifications, mirror mark-read/delete done from
  // another device (push tap, another session) into this list. `items` here
  // is always the latest render's state (useRealtime re-subscribes with a
  // fresh callback every render), which lets us tell a self-echo of an
  // action we already applied optimistically from a genuine external change.
  useRealtime('notification', (env) => {
    if (env.action === 'created' && env.data?.id) {
      const created = env.data as Notif;
      if (items.some((x) => x.id === created.id)) return;
      setItems((prev) => [created, ...prev]);
      setUnreadCount((c) => c + 1);
      return;
    }
    if (env.action === 'read') {
      if (env.id) {
        const target = items.find((x) => x.id === env.id);
        if (!target || isRead(target)) return;
        setItems((prev) =>
          prev.map((x) => (x.id === env.id ? { ...x, read: true, isRead: true } : x)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } else {
        setItems((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
        setUnreadCount(0);
      }
      return;
    }
    if (env.action === 'deleted' && env.id) {
      setItems((prev) => prev.filter((x) => x.id !== env.id));
    }
  });

  function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
    setUnreadCount(0);
    // Fire-and-forget: the row state already reflects "read" locally.
    notificationsApi.markAllRead().catch(() => {});
  }

  function markReadLocal(id: string) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true, isRead: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    notificationsApi.markRead(id).catch(() => {});
  }

  function openNotif(n: Notif) {
    if (!isRead(n)) markReadLocal(n.id);
    const route = routeForNotifData({ type: n.type, ...(n.data ?? {}) });
    router.push(route as never);
  }

  function openActor(n: Notif) {
    const actorId = n.data?.actorId;
    if (!actorId) return;
    if (!isRead(n)) markReadLocal(n.id);
    router.push(`/(app)/users/${actorId}` as never);
  }

  const sections = useMemo(() => {
    const groups: Record<Bucket, Notif[]> = { today: [], yesterday: [], week: [], older: [] };
    for (const n of items) groups[bucketOf(n.createdAt)].push(n);
    return (['today', 'yesterday', 'week', 'older'] as Bucket[])
      .filter((b) => groups[b].length > 0)
      .map((b) => ({
        key: b,
        title: es ? BUCKET_LABEL[b].es : BUCKET_LABEL[b].en,
        data: groups[b],
      }));
  }, [items, es]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={es ? 'Atrás' : 'Back'}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
        <Pressy
          onPress={markAll}
          disabled={unreadCount === 0}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={es ? 'Marcar todo como leído' : 'Mark all as read'}
          hitSlop={HitSlop.expand}
          style={[styles.markAllBtn, unreadCount === 0 && { opacity: 0.4 }]}
        >
          <Body size="sm" tone="accent" weight="semiBold">
            {es ? 'Marcar todo' : 'Mark all'}
          </Body>
        </Pressy>
      </View>

      <View style={styles.titleBlock}>
        <Kicker tone="muted">
          {unreadCount > 0
            ? es
              ? `${unreadCount} SIN LEER`
              : `${unreadCount} UNREAD`
            : es
              ? 'BANDEJA'
              : 'INBOX'}
        </Kicker>
        <Heading size="md">{es ? 'Notificaciones' : 'Notifications'}</Heading>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, marginTop: Spacing[6] }}>
          <SkeletonList count={6} itemHeight={72} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={es ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          stickySectionHeadersEnabled={false}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Spacing[12], flexGrow: 1 }}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: Spacing[5] }}>
                <Caption tone="muted" align="center">
                  {es ? 'Cargando…' : 'Loading…'}
                </Caption>
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Kicker tone="muted">{section.title}</Kicker>
            </View>
          )}
          renderItem={({ item }) => (
            <NotifRow
              n={item}
              es={es}
              unread={!isRead(item)}
              onOpen={() => openNotif(item)}
              onActor={() => openActor(item)}
            />
          )}
          ListEmptyComponent={
            <View style={{ minHeight: 280 }}>
              <EmptyState
                icon="bell-off"
                title={es ? 'Todo en silencio' : 'All quiet here'}
                message={
                  es
                    ? 'Cuando alguien interactúe con tu actividad, lo verás aquí.'
                    : 'When someone engages with you, it will show up here.'
                }
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function NotifRow({
  n,
  es,
  unread,
  onOpen,
  onActor,
}: {
  n: Notif;
  es: boolean;
  unread: boolean;
  onOpen: () => void;
  onActor: () => void;
}) {
  const { icon, color } = iconForType(n.type || '');
  const actors = n.data?.actors ?? [];
  const isAggregated = actors.length > 1;
  const primaryActorId = n.data?.actorId;
  const primaryAvatar = n.data?.actorAvatarUrl;
  const title = (es ? n.title : n.titleEn || n.title) || n.type || (es ? 'Notificación' : 'Notification');
  const body = (es ? n.body : n.bodyEn || n.body) || n.message;

  return (
    <Pressy
      onPress={onOpen}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={title}
      style={styles.row}
    >
      {/* Avatar / icon */}
      {isAggregated ? (
        <StackedAvatars actors={actors.slice(0, 3)} accent={color} icon={icon} />
      ) : primaryActorId ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onActor();
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.actorWrap, pressed && { opacity: 0.8 }]}
          accessibilityRole={Roles.button}
          accessibilityLabel={n.data?.actorName ?? (es ? 'Usuario' : 'User')}
        >
          {primaryAvatar ? (
            <Image source={{ uri: primaryAvatar }} style={styles.actorAvatar} />
          ) : (
            <View style={[styles.actorAvatar, styles.actorAvatarFallback]}>
              <Feather name="user" size={16} color={color} />
            </View>
          )}
          <View style={[styles.actorBadge, { backgroundColor: color }]}>
            <Feather name={icon} size={9} color={Colors.textInverse} />
          </View>
        </Pressable>
      ) : (
        <View style={styles.iconBox}>
          <Feather name={icon} size={18} color={color} />
        </View>
      )}

      {/* Body */}
      <View style={{ flex: 1, gap: 2 }}>
        <Subhead tone={unread ? 'primary' : 'secondary'} numberOfLines={2}>
          {title}
        </Subhead>
        {body ? (
          <Body size="sm" tone="muted" numberOfLines={2}>
            {body}
          </Body>
        ) : null}
        <Caption tone="muted" style={{ marginTop: 2 }}>
          {relTime(n.createdAt, es)}
        </Caption>
      </View>

      {/* Trailing */}
      {unread ? <View style={styles.unreadDot} /> : null}
    </Pressy>
  );
}

function StackedAvatars({
  actors,
  accent,
  icon,
}: {
  actors: NotifActor[];
  accent: string;
  icon: FeatherIcon;
}) {
  return (
    <View style={[styles.actorWrap, { width: 56 }]}>
      {actors.map((a, i) => (
        <View
          key={a.id ?? i}
          style={[
            styles.stackedAvatar,
            { left: i * 14, zIndex: actors.length - i },
          ]}
        >
          {a.avatarUrl ? (
            <Image source={{ uri: a.avatarUrl }} style={styles.stackedImg} />
          ) : (
            <View style={[styles.stackedImg, styles.actorAvatarFallback]}>
              <Feather name="user" size={12} color={accent} />
            </View>
          )}
        </View>
      ))}
      <View style={[styles.actorBadge, { backgroundColor: accent, right: -4, bottom: -2 }]}>
        <Feather name={icon} size={9} color={Colors.textInverse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  markAllBtn: {
    paddingHorizontal: Spacing[2],
    minHeight: 40,
    justifyContent: 'center',
  },

  titleBlock: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },

  sectionHeader: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[5],
    paddingBottom: Spacing[3],
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  actorWrap: { width: 44, height: 44, position: 'relative' },
  actorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgElevated,
  },
  actorAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  actorBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  stackedAvatar: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
    overflow: 'hidden',
  },
  stackedImg: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: Colors.bgElevated,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentPrimary,
  },
});
