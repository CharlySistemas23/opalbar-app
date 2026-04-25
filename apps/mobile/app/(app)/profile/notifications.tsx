import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { notificationsApi, usersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/tokens';

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
  body?: string;
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
    actors?: NotifActor[];        // aggregation: list of actors stacked on the row
    aggregatedCount?: number;
    isFollowing?: boolean;        // server hint for FOLLOW notifs
    postId?: string;
    eventId?: string;
    offerId?: string;
    targetId?: string;
    threadId?: string;
    venueId?: string;
    reservationId?: string;
  };
};

function iconForType(type: string): { icon: FeatherIcon; color: string } {
  const t = type?.toUpperCase() ?? '';
  if (t.includes('FOLLOW')) return { icon: 'user-plus', color: Colors.accentSuccess };
  if (t.includes('LIKE') || t.includes('REACTION')) return { icon: 'heart', color: Colors.accentDanger };
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
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
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
  today: { es: 'Hoy', en: 'Today' },
  yesterday: { es: 'Ayer', en: 'Yesterday' },
  week: { es: 'Esta semana', en: 'This week' },
  older: { es: 'Anteriores', en: 'Earlier' },
};

export default function Notifications() {
  const router = useRouter();
  const { language } = useAppStore();
  const es = language === 'es';

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await notificationsApi.list();
      const rows = r.data?.data?.data ?? r.data?.data?.items ?? r.data?.data ?? [];
      setItems(rows);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isRead = (n: Notif) => !!(n.read ?? n.isRead);

  async function markAll() {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
    } catch {}
  }

  async function markReadLocal(id: string) {
    try { await notificationsApi.markRead(id); } catch {}
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true, isRead: true } : x)));
  }

  async function openNotif(n: Notif) {
    if (!isRead(n)) await markReadLocal(n.id);

    const type = (n.type || '').toUpperCase();
    const d = n.data || {};
    const postId = d.postId;
    const target = n.targetId || d.targetId || d.eventId || postId;

    if (type.includes('REACTION') || type.includes('REPLY') || type.includes('MENTION') || type.includes('COMMENT') || type.includes('POST')) {
      if (postId) return router.push(`/(app)/community/posts/${postId}` as never);
    }
    if (type.includes('EVENT') && target) return router.push(`/(app)/events/${target}` as never);
    if (type.includes('OFFER') && target) return router.push(`/(app)/offers/${target}` as never);
    if ((type.includes('FOLLOW') || type.includes('MESSAGE')) && target) {
      return router.push(`/(app)/users/${target}` as never);
    }
    if (type.includes('MESSAGE') && d.threadId) {
      return router.push(`/(app)/messages/${d.threadId}` as never);
    }
  }

  async function openActor(n: Notif) {
    const actorId = n.data?.actorId;
    if (!actorId) return;
    if (!isRead(n)) await markReadLocal(n.id);
    router.push(`/(app)/users/${actorId}` as never);
  }

  // Optimistic follow-back from a FOLLOW notif row
  async function toggleFollow(n: Notif) {
    const actorId = n.data?.actorId;
    if (!actorId) return;
    const wasFollowing = !!n.data?.isFollowing;
    setItems((prev) =>
      prev.map((x) =>
        x.id === n.id ? { ...x, data: { ...x.data, isFollowing: !wasFollowing } } : x,
      ),
    );
    try {
      if (wasFollowing) await usersApi.unfollow(actorId);
      else await usersApi.follow(actorId);
    } catch {
      // rollback
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, data: { ...x.data, isFollowing: wasFollowing } } : x,
        ),
      );
    }
  }

  const unreadCount = items.filter((n) => !isRead(n)).length;

  const sections = useMemo(() => {
    const groups: Record<Bucket, Notif[]> = { today: [], yesterday: [], week: [], older: [] };
    for (const n of items) groups[bucketOf(n.createdAt)].push(n);
    return (['today', 'yesterday', 'week', 'older'] as Bucket[])
      .filter((b) => groups[b].length > 0)
      .map((b) => ({ key: b, title: es ? BUCKET_LABEL[b].es : BUCKET_LABEL[b].en, data: groups[b] }));
  }, [items, es]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{es ? 'Notificaciones' : 'Notifications'}</Text>
          {unreadCount > 0 ? (
            <Text style={styles.subtitle}>
              {unreadCount} {es ? 'sin leer' : 'unread'}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={markAll}
          style={[styles.iconBtn, unreadCount === 0 && { opacity: 0.4 }]}
          hitSlop={10}
          disabled={unreadCount === 0}
        >
          <Feather name="check-circle" size={18} color={unreadCount > 0 ? Colors.accentPrimary : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonList />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          stickySectionHeadersEnabled={false}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Spacing[12], flexGrow: 1 }}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <NotifRow
              n={item}
              es={es}
              unread={!isRead(item)}
              onOpen={() => openNotif(item)}
              onActor={() => openActor(item)}
              onFollow={() => toggleFollow(item)}
            />
          )}
          ListEmptyComponent={<EmptyState es={es} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function NotifRow({
  n,
  es,
  unread,
  onOpen,
  onActor,
  onFollow,
}: {
  n: Notif;
  es: boolean;
  unread: boolean;
  onOpen: () => void;
  onActor: () => void;
  onFollow: () => void;
}) {
  const { icon, color } = iconForType(n.type || '');
  const actors = n.data?.actors ?? [];
  const isAggregated = actors.length > 1;
  const primaryActorId = n.data?.actorId;
  const primaryAvatar = n.data?.actorAvatarUrl;
  const showFollowBtn = (n.type || '').toUpperCase().includes('FOLLOW') && !!primaryActorId;
  const isFollowing = !!n.data?.isFollowing;

  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} activeOpacity={0.85}>
      {/* Unread accent rail */}
      {unread ? <View style={[styles.rail, { backgroundColor: color }]} /> : null}

      {/* Avatar / icon */}
      {isAggregated ? (
        <StackedAvatars actors={actors.slice(0, 3)} accent={color} icon={icon} />
      ) : primaryActorId ? (
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onActor(); }}
          hitSlop={6}
          style={({ pressed }) => [styles.actorWrap, pressed && { opacity: 0.8 }]}
        >
          {primaryAvatar ? (
            <Image source={{ uri: primaryAvatar }} style={styles.actorAvatar} />
          ) : (
            <View style={[styles.actorAvatar, styles.actorAvatarFallback, { borderColor: color + '44' }]}>
              <Feather name="user" size={16} color={color} />
            </View>
          )}
          <View style={[styles.actorBadge, { backgroundColor: color }]}>
            <Feather name={icon} size={10} color="#fff" />
          </View>
        </Pressable>
      ) : (
        <View style={[styles.iconBox, { backgroundColor: color + '22', borderColor: color + '33' }]}>
          <Feather name={icon} size={18} color={color} />
        </View>
      )}

      {/* Body */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, unread && { color: Colors.textPrimary }]} numberOfLines={2}>
          {n.title || n.type || 'Notificación'}
        </Text>
        {n.body || n.message ? (
          <Text style={styles.rowBody} numberOfLines={2}>{n.body || n.message}</Text>
        ) : null}
        <Text style={styles.rowTime}>{relTime(n.createdAt, es)}</Text>
      </View>

      {/* Trailing action */}
      {showFollowBtn ? (
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onFollow(); }}
          hitSlop={6}
          style={({ pressed }) => [
            styles.followBtn,
            isFollowing ? styles.followBtnActive : styles.followBtnIdle,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={[styles.followBtnText, isFollowing && { color: Colors.textSecondary }]}>
            {isFollowing ? (es ? 'Siguiendo' : 'Following') : (es ? 'Seguir' : 'Follow')}
          </Text>
        </Pressable>
      ) : unread ? (
        <View style={[styles.dot, { backgroundColor: color }]} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Stacked avatars (Instagram-style aggregation) ─────────────────────────────

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
            <View style={[styles.stackedImg, styles.actorAvatarFallback, { borderColor: accent + '44' }]}>
              <Feather name="user" size={12} color={accent} />
            </View>
          )}
        </View>
      ))}
      <View style={[styles.actorBadge, { backgroundColor: accent, right: -4, bottom: -2 }]}>
        <Feather name={icon} size={10} color="#fff" />
      </View>
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonList() {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={{ paddingTop: Spacing[2] }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.row, { borderBottomWidth: 0 }]}>
          <Animated.View style={[styles.skelCircle, { opacity }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <Animated.View style={[styles.skelLine, { width: '70%', opacity }]} />
            <Animated.View style={[styles.skelLine, { width: '40%', opacity }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Empty ─────────────────────────────────────────────────────────────────────

function EmptyState({ es }: { es: boolean }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconRing}>
        <Feather name="bell-off" size={32} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{es ? 'Todo en silencio' : 'All quiet here'}</Text>
      <Text style={styles.emptyBody}>
        {es
          ? 'Cuando alguien interactúe con tu actividad, lo verás aquí.'
          : 'When someone engages with you, it will show up here.'}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
    gap: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: Typography.fontSize.lg,
    letterSpacing: Typography.letterSpacing.tight,
  },
  subtitle: {
    color: Colors.accentPrimary,
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },

  sectionHeader: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: Typography.fontSize.sm,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[5],
    paddingBottom: Spacing[2],
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    position: 'relative',
  },
  rail: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    opacity: 0.9,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  actorWrap: { width: 44, height: 44, position: 'relative' },
  actorAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bgElevated,
  },
  actorAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actorBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgPrimary,
  },
  stackedAvatar: {
    position: 'absolute',
    top: 0,
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
    overflow: 'hidden',
  },
  stackedImg: {
    width: '100%', height: '100%', borderRadius: 14,
    backgroundColor: Colors.bgElevated,
  },

  rowTitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.snug,
  },
  rowBody: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.snug,
  },
  rowTime: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.sans,
    fontSize: 11,
    marginTop: 2,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },

  followBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
    minWidth: 84,
    alignItems: 'center',
  },
  followBtnIdle: {
    backgroundColor: Colors.accentPrimary,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  followBtnText: {
    color: Colors.textInverse,
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: Typography.fontSize.sm,
  },

  // Skeleton
  skelCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bgCard,
  },
  skelLine: {
    height: 10, borderRadius: 4,
    backgroundColor: Colors.bgCard,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: Spacing[8] * 1.5,
    paddingHorizontal: Spacing[6],
    gap: Spacing[3],
  },
  emptyIconRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: Typography.fontSize.lg,
    marginTop: Spacing[2],
  },
  emptyBody: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.5,
    maxWidth: 280,
  },
});
