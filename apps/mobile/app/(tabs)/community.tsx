// ─────────────────────────────────────────────
//  Community — Facebook-style feed on Noir Absolute
//
//  Tabs: Para ti (default) · Siguiendo · Miembros.
//  Feed header: stories strip ("Tu historia +" first, then venue + people)
//  and a composer card ("¿Qué estás pensando, {name}?" · Foto · Historia).
//  PostCard renders each post; this screen owns data, optimistic state,
//  realtime patching and the "…" menus (Sheet, never Alert).
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { communityApi, friendshipsApi, messagesApi, usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { useCommunityRealtime } from '@/hooks/useCommunityRealtime';
import { useRealtime } from '@/hooks/useRealtime';
import { relativeTime } from '@/utils/time';
import { sharePost } from '@/utils/share';
import { toast } from '@/components/Toast';

import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  Hairline,
  Heading,
  Kicker,
  ListItem,
  Pressy,
  Sheet,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { ReactionPicker } from '@/components/ui/ReactionPicker';
import { ReactorsModal } from '@/components/ui/ReactorsModal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { ReportSheet } from '@/components/ReportSheet';

import { MemberCard } from '@/components/community/MemberCard';
import { PostCard, type CommunityPost, type PostStatus } from '@/components/community/PostCard';
import { StoryStripe, type StoryItem } from '@/components/community/StoryStripe';

// ── Avatar palette ───────────────────────────
const AVATAR_COLORS = ['#C9A961', '#7FA0BC', '#9F8DBE', '#6FA88A', '#C46868', '#C48A8A'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

const LIKE = '❤️';
const POSTS_PAGE = 20;
type FeedTab = 'foryou' | 'following' | 'members';

function adaptPost(row: any, t: boolean, meId?: string): CommunityPost {
  const a = row?.author ?? {};
  const first = a.firstName ?? row?.user?.profile?.firstName ?? '';
  const last = a.lastName ?? row?.user?.profile?.lastName ?? '';
  const fullName = `${first} ${last}`.trim() || (t ? 'Usuario' : 'User');
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
  const created = row?.createdAt ? new Date(row.createdAt) : null;
  const emojiReactions: CommunityPost['emojiReactions'] = Array.isArray(row?.emojiReactions)
    ? row.emojiReactions
    : [];
  const mediaUrls: string[] = Array.isArray(row?.mediaUrls) ? row.mediaUrls : [];
  return {
    id: row.id,
    userId: row.userId,
    author: {
      id: a.id ?? row?.user?.id ?? row?.userId,
      name: fullName,
      avatarUrl: a.avatarUrl ?? row?.user?.profile?.avatarUrl ?? null,
      initials,
      color: colorFor(row.userId || row.id || ''),
      isPrivate: !!(a.isPrivate ?? row?.user?.isPrivate),
    },
    timeAgo: created ? relativeTime(created, t) : '',
    text: row?.content || undefined,
    imageUrl: row?.imageUrl ?? undefined,
    mediaUrls,
    likes: row?.likesCount ?? emojiReactions.reduce((s: number, r: any) => s + (r.count ?? 0), 0),
    comments: row?.commentsCount ?? 0,
    hasLiked: !!row?.hasLiked,
    emojiReactions,
    myEmoji: row?.myEmoji ?? emojiReactions.find((r: any) => r?.mine)?.emoji ?? null,
    isSaved: !!row?.isSaved,
    status: (row?.status ?? 'PUBLISHED') as PostStatus,
    rejectionReason: row?.rejectionReason ?? null,
    mentions: Array.isArray(row?.mentions) ? row.mentions : [],
    isMine: !!meId && row?.userId === meId,
  };
}

// Apply an emoji toggle to a post's local reaction state (FB rules: one
// emoji per user; same emoji → remove, different → swap).
function applyReaction(p: CommunityPost, emoji: string): CommunityPost {
  const prev = p.myEmoji;
  const willRemove = prev === emoji;
  const next = willRemove ? null : emoji;
  const arr = p.emojiReactions.map((r) => ({ ...r }));
  if (prev) {
    const i = arr.findIndex((r) => r.emoji === prev);
    if (i >= 0) {
      arr[i].count = Math.max(0, arr[i].count - 1);
      arr[i].mine = false;
      if (arr[i].count <= 0) arr.splice(i, 1);
    }
  }
  if (next) {
    const i = arr.findIndex((r) => r.emoji === next);
    if (i >= 0) {
      arr[i].count += 1;
      arr[i].mine = true;
    } else arr.push({ emoji: next, count: 1, mine: true });
  }
  return {
    ...p,
    myEmoji: next,
    hasLiked: next === LIKE,
    emojiReactions: arr,
    likes: arr.reduce((s, r) => s + r.count, 0),
  };
}

export default function Community() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();
  const meId = user?.id;
  const isStaff = !!user?.role && ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(user.role);
  const firstName = user?.profile?.firstName?.trim() || '';

  const [tab, setTab] = useState<FeedTab>('foryou');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const reqIdRef = useRef(0);
  const listRef = useRef<FlatList<CommunityPost>>(null);
  const hiddenRef = useRef<Set<string>>(new Set());

  // Overlays
  const [picker, setPicker] = useState<{ postId: string; x: number; y: number } | null>(null);
  const [reactorsForPost, setReactorsForPost] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<CommunityPost | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'delete' | 'block'; post: CommunityPost }>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reportPost, setReportPost] = useState<CommunityPost | null>(null);

  // ── Stories ───────────────────────────────
  const [venueGroup, setVenueGroup] = useState<any | null>(null);
  const [personalGroups, setPersonalGroups] = useState<any[]>([]);
  const [ownStories, setOwnStories] = useState<number>(0);
  const loadStories = useCallback(async () => {
    const scope = tab === 'following' ? 'following' : undefined;
    try {
      const [r, mine] = await Promise.all([
        communityApi.stories(scope),
        meId ? communityApi.userStories(meId) : Promise.resolve(null),
      ]);
      const payload = r.data?.data ?? {};
      setVenueGroup(payload.venue ?? null);
      setPersonalGroups(Array.isArray(payload.personal) ? payload.personal : []);
      const own = mine?.data?.data?.stories;
      setOwnStories(Array.isArray(own) ? own.length : 0);
    } catch {
      // Stories are decorative on this screen — a failure must not blank the
      // feed. Keep whatever we had; pull-to-refresh retries.
    }
  }, [tab, meId]);

  const stories = useMemo<StoryItem[]>(() => {
    const out: StoryItem[] = [];
    if (meId) {
      out.push({
        id: meId,
        kind: 'self',
        name: firstName || (t ? 'Tú' : 'You'),
        avatarUrl: user?.profile?.avatarUrl ?? null,
        initials: ((firstName[0] || '') + (user?.profile?.lastName?.[0] || '')).toUpperCase() || 'U',
        color: colorFor(meId),
        hasOwn: ownStories > 0,
      });
    }
    if (venueGroup) {
      out.push({
        id: '__venue__',
        kind: 'venue',
        name: 'OPAL BAR PV',
        avatarUrl: null,
        initials: 'OB',
        color: Colors.accentPrimary,
        hasUnseen: !!venueGroup.hasUnseen,
      });
    }
    for (const g of personalGroups) {
      if (!g?.user?.id || g.user.id === meId) continue;
      const first = g.user?.profile?.firstName ?? '';
      const last = g.user?.profile?.lastName ?? '';
      out.push({
        id: g.user.id,
        kind: 'personal',
        name: `${first} ${last}`.trim() || (t ? 'Usuario' : 'User'),
        avatarUrl: g.user?.profile?.avatarUrl,
        initials: ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U',
        color: colorFor(g.user.id),
        hasUnseen: !!g.hasUnseen,
      });
    }
    return out;
  }, [venueGroup, personalGroups, meId, firstName, user?.profile?.avatarUrl, user?.profile?.lastName, ownStories, t]);

  // ── Feed loading ──────────────────────────
  const load = useCallback(
    async (mode: 'fresh' | 'more' = 'fresh') => {
      if (tab === 'members') return;
      const nextPage = mode === 'more' ? page + 1 : 1;
      if (mode === 'more' && (loadingMore || !hasMore)) return;
      if (mode === 'more') setLoadingMore(true);
      else setError(null);
      const id = ++reqIdRef.current;
      try {
        const r = await communityApi.posts({
          page: nextPage,
          limit: POSTS_PAGE,
          scope: tab === 'following' ? 'following' : 'forYou',
          surface: 'community',
        });
        if (reqIdRef.current !== id) return;
        const payload = r.data?.data;
        const rows: any[] = payload?.data ?? [];
        const meta = payload?.meta;
        const adapted = rows
          .map((x) => adaptPost(x, t, meId))
          .filter((p) => !hiddenRef.current.has(p.id));
        setPosts((prev) => {
          if (mode !== 'more') return adapted;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...adapted.filter((p) => !seen.has(p.id))];
        });
        setPage(nextPage);
        setHasMore(meta ? !!meta.hasNextPage : rows.length === POSTS_PAGE);
        if (mode === 'fresh') setHasNew(false);
      } catch (err) {
        if (reqIdRef.current === id) {
          setError(apiError(err, t ? 'No se pudieron cargar las publicaciones.' : 'Could not load posts.'));
        }
      } finally {
        if (reqIdRef.current === id) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [tab, t, meId, page, loadingMore, hasMore],
  );

  useFocusEffect(
    useCallback(() => {
      load('fresh');
      loadStories();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, t, meId]),
  );

  // Legacy /community socket: moderation approvals/rejections → refresh.
  useCommunityRealtime((p) => {
    if (p.type === 'post_created') setHasNew(true);
    else if (p.type === 'post_reacted') return; // handled by /rt in-place patch
    else load('fresh');
  });

  // Unified /rt socket: patch in place where we can, refresh otherwise.
  useRealtime(['post', 'comment', 'story'], (env) => {
    if (env.resource === 'story') {
      loadStories();
      return;
    }
    if (env.resource === 'comment') {
      const postId = env.data?.postId;
      if (!postId) return;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments:
                  env.action === 'created'
                    ? p.comments + 1
                    : env.action === 'deleted'
                      ? Math.max(0, p.comments - 1)
                      : p.comments,
              }
            : p,
        ),
      );
      return;
    }
    // resource === 'post'
    if (env.action === 'created') {
      if (env.data?.userId && env.data.userId === meId) load('fresh');
      else setHasNew(true);
      return;
    }
    if (env.action === 'reacted' && env.id) {
      const { userId, emoji, reacted, likesCount } = env.data ?? {};
      if (userId === meId) return; // already applied optimistically
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== env.id) return p;
          const arr = p.emojiReactions.map((r) => ({ ...r }));
          const i = arr.findIndex((r) => r.emoji === emoji);
          if (reacted) {
            if (i >= 0) arr[i].count += 1;
            else if (emoji) arr.push({ emoji, count: 1, mine: false });
          } else if (i >= 0) {
            arr[i].count = Math.max(0, arr[i].count - 1);
            if (arr[i].count === 0) arr.splice(i, 1);
          }
          return {
            ...p,
            emojiReactions: arr,
            likes: typeof likesCount === 'number' ? likesCount : arr.reduce((s, r) => s + r.count, 0),
          };
        }),
      );
      return;
    }
    if (env.action === 'deleted' && env.id) {
      setPosts((prev) => prev.filter((p) => p.id !== env.id));
      return;
    }
    // updated / approved / rejected → refresh
    load('fresh');
  });

  const onRefresh = useCallback(() => {
    fb.refresh();
    setRefreshing(true);
    load('fresh');
    loadStories();
  }, [load, loadStories, fb]);

  const showNewPosts = useCallback(() => {
    setHasNew(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    load('fresh');
  }, [load]);

  // ── Mutations ─────────────────────────────
  const reactWithEmoji = useCallback(
    async (post: CommunityPost, emoji: string) => {
      fb.like();
      setPosts((prev) => prev.map((p) => (p.id === post.id ? applyReaction(p, emoji) : p)));
      try {
        await communityApi.emojiReact(post.id, emoji);
      } catch (err) {
        fb.error();
        setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
        toast(apiError(err, t ? 'No se pudo reaccionar.' : 'Could not react.'), 'danger');
      }
    },
    [fb, t],
  );

  const quickToggle = useCallback(
    (post: CommunityPost) => reactWithEmoji(post, post.myEmoji ?? LIKE),
    [reactWithEmoji],
  );

  const toggleSave = useCallback(
    async (post: CommunityPost) => {
      fb.select();
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, isSaved: !p.isSaved } : p)));
      try {
        const r = await usersApi.toggleSave('POST', post.id);
        const saved = !!r.data?.data?.saved;
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, isSaved: saved } : p)));
        toast(
          saved
            ? t ? 'Guardado en tu colección.' : 'Saved to your collection.'
            : t ? 'Quitado de guardados.' : 'Removed from saved.',
          'success',
          1800,
        );
      } catch (err) {
        fb.error();
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, isSaved: post.isSaved } : p)));
        toast(apiError(err, t ? 'No se pudo guardar.' : 'Could not save.'), 'danger');
      }
    },
    [fb, t],
  );

  const share = useCallback(
    (post: CommunityPost) =>
      sharePost({
        id: post.id,
        content: post.text,
        authorName: post.author.name,
        imageUrl: post.mediaUrls[0] ?? post.imageUrl,
        likes: post.likes,
        comments: post.comments,
        t,
      }),
    [t],
  );

  const hidePost = useCallback(
    (post: CommunityPost) => {
      hiddenRef.current.add(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast(t ? 'Publicación oculta.' : 'Post hidden.', 'info', 1800);
    },
    [t],
  );

  const runConfirm = useCallback(async () => {
    if (!confirm) return;
    const { kind, post } = confirm;
    setConfirmBusy(true);
    const snapshot = posts;
    try {
      if (kind === 'delete') {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        await communityApi.deletePost(post.id);
        fb.destructive();
        toast(t ? 'Publicación eliminada.' : 'Post deleted.', 'success');
      } else {
        const authorId = post.author.id;
        if (!authorId) return;
        setPosts((prev) => prev.filter((p) => p.author.id !== authorId));
        await friendshipsApi.block(authorId);
        toast(t ? 'Usuario bloqueado.' : 'User blocked.', 'success');
      }
      setConfirm(null);
    } catch (err) {
      fb.error();
      setPosts(snapshot);
      toast(apiError(err, t ? 'No se pudo completar.' : 'Could not complete.'), 'danger');
    } finally {
      setConfirmBusy(false);
    }
  }, [confirm, posts, fb, t]);

  const submitReport = useCallback(
    async (reason: string, details: string) => {
      if (!reportPost) return;
      try {
        await communityApi.reportPost(reportPost.id, { reason, description: details || undefined });
        toast(t ? 'Gracias. Revisaremos el reporte.' : 'Thanks. We will review it.', 'success');
      } catch (err) {
        fb.error();
        toast(apiError(err, t ? 'No se pudo enviar el reporte.' : 'Report failed.'), 'danger');
        throw err;
      }
    },
    [reportPost, fb, t],
  );

  // ── Navigation ────────────────────────────
  const handleStoryPress = useCallback(
    (story: StoryItem) => {
      if (story.kind === 'self') {
        router.push(
          (story.hasOwn
            ? `/(app)/community/story-viewer?userId=${story.id}&single=1`
            : '/(app)/community/new-story') as never,
        );
      } else if (story.kind === 'venue') {
        router.push('/(app)/community/story-viewer?venue=1' as never);
      } else {
        router.push(`/(app)/community/story-viewer?userId=${story.id}&single=1` as never);
      }
    },
    [router],
  );

  const openMenu = useCallback((post: CommunityPost) => setMenuPost(post), []);

  // ── Header (stories + composer) ───────────
  const header = (
    <View>
      <StoryStripe stories={stories} onPressStory={handleStoryPress} t={t} />
      {stories.length > 0 ? <Hairline variant="subtle" /> : null}
      <View style={styles.composer}>
        <View style={styles.composerTop}>
          {user?.profile?.avatarUrl ? (
            <Image source={{ uri: user.profile.avatarUrl }} style={styles.composerAvatar} />
          ) : (
            <View style={[styles.composerAvatar, { backgroundColor: meId ? colorFor(meId) : Colors.bgElevated }]}>
              <Text style={styles.composerInitials} allowFontScaling={false}>
                {(firstName[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}
          <Pressy
            onPress={() => router.push('/(app)/community/new-post' as never)}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Crear publicación' : 'Create post'}
            haptic="select"
            style={styles.composerInput}
          >
            <Text style={styles.composerPlaceholder} numberOfLines={1}>
              {firstName
                ? t ? `¿Qué estás pensando, ${firstName}?` : `What's on your mind, ${firstName}?`
                : t ? '¿Qué estás pensando?' : "What's on your mind?"}
            </Text>
          </Pressy>
        </View>
        <Hairline variant="subtle" />
        <View style={styles.composerRow}>
          <Pressy
            onPress={() => router.push('/(app)/community/new-post?openPicker=1' as never)}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Publicar foto' : 'Post photo'}
            haptic="select"
            style={styles.composerBtn}
          >
            <Feather name="image" size={18} color={Colors.accentSuccess} />
            <Text style={styles.composerBtnLbl}>{t ? 'Foto' : 'Photo'}</Text>
          </Pressy>
          <View style={styles.composerDivider} />
          <Pressy
            onPress={() => router.push('/(app)/community/new-story' as never)}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Crear historia' : 'Create story'}
            haptic="select"
            style={styles.composerBtn}
          >
            <Feather name="plus-circle" size={18} color={Colors.accentPrimary} />
            <Text style={styles.composerBtnLbl}>{t ? 'Historia' : 'Story'}</Text>
          </Pressy>
        </View>
      </View>
      <View style={styles.gap} />
    </View>
  );

  const menuIsMine = !!menuPost && menuPost.isMine;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Masthead ──────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Kicker tone="champagne">{t ? 'COMUNIDAD' : 'COMMUNITY'}</Kicker>
          <Heading size="sm" style={styles.title}>OPAL BAR</Heading>
        </View>
        <View style={styles.hdrRight}>
          <Pressy
            onPress={() => router.push('/(app)/search' as never)}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Buscar' : 'Search'}
            hitSlop={HitSlop.expand}
            haptic="select"
            style={styles.iconBtn}
          >
            <Feather name="search" size={20} color={Colors.textPrimary} />
          </Pressy>
          <Pressy
            onPress={() => router.push('/(app)/messages' as never)}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Mensajes' : 'Messages'}
            hitSlop={HitSlop.expand}
            haptic="select"
            style={styles.iconBtn}
          >
            <Feather name="send" size={20} color={Colors.textPrimary} />
          </Pressy>
        </View>
      </View>

      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v as FeedTab);
          setLoading(true);
          setPosts([]);
        }}
        options={[
          { value: 'foryou', label: t ? 'Para ti' : 'For you' },
          { value: 'following', label: t ? 'Siguiendo' : 'Following' },
          { value: 'members', label: t ? 'Miembros' : 'Members' },
        ]}
      />

      {tab === 'members' ? (
        <MembersPanel t={t} router={router} />
      ) : loading && posts.length === 0 ? (
        <View>
          {header}
          <FeedSkeleton />
        </View>
      ) : error && posts.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load('fresh');
          }}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={posts}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.feed}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
            ListHeaderComponent={header}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentPrimary} />
            }
            onEndReachedThreshold={0.5}
            onEndReached={() => load('more')}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator color={Colors.textMuted} style={{ paddingVertical: Spacing[6] }} />
              ) : null
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                t={t}
                onPress={() => router.push(`/(app)/community/posts/${item.id}` as never)}
                onAuthorPress={() =>
                  item.author.id && router.push(`/(app)/users/${item.author.id}` as never)
                }
                onQuickReact={() => quickToggle(item)}
                onOpenPicker={(x, y) => setPicker({ postId: item.id, x, y })}
                onOpenReactors={() => setReactorsForPost(item.id)}
                onOptions={() => openMenu(item)}
                onShare={() => share(item)}
                onToggleSave={() => toggleSave(item)}
              />
            )}
            ListEmptyComponent={
              tab === 'following' ? (
                <EmptyState
                  icon="users"
                  title={t ? 'Tu feed está tranquilo.' : 'Your feed is quiet.'}
                  message={
                    t
                      ? 'Sigue a otros miembros para ver sus publicaciones e historias aquí.'
                      : 'Follow other members to see their posts and stories here.'
                  }
                  actionLabel={t ? 'Ver miembros' : 'See members'}
                  onAction={() => setTab('members')}
                />
              ) : (
                <EmptyState
                  icon="edit-3"
                  title={t ? 'Aún no hay publicaciones.' : 'No posts yet.'}
                  message={t ? 'Sé quien abra la conversación.' : 'Be the one to start the conversation.'}
                  actionLabel={t ? 'Escribir algo' : 'Write something'}
                  onAction={() => router.push('/(app)/community/new-post' as never)}
                />
              )
            }
          />

          {hasNew ? (
            <View pointerEvents="box-none" style={styles.newPillWrap}>
              <Pressy
                onPress={showNewPosts}
                accessibilityRole={Roles.button}
                accessibilityLabel={t ? 'Ver nuevas publicaciones' : 'See new posts'}
                haptic="select"
                style={styles.newPill}
              >
                <Feather name="arrow-up" size={14} color={Colors.textInverse} />
                <Text style={styles.newPillLbl}>{t ? 'Nuevas publicaciones' : 'New posts'}</Text>
              </Pressy>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Reaction picker ───────────────── */}
      <ReactionPicker
        visible={!!picker}
        anchorY={picker?.y ?? 0}
        anchorX={picker?.x || undefined}
        activeEmoji={posts.find((p) => p.id === picker?.postId)?.myEmoji ?? undefined}
        onSelect={(emoji) => {
          const target = posts.find((p) => p.id === picker?.postId);
          if (target) reactWithEmoji(target, emoji);
        }}
        onClose={() => setPicker(null)}
      />

      <ReactorsModal
        visible={!!reactorsForPost}
        postId={reactorsForPost}
        onClose={() => setReactorsForPost(null)}
        t={t}
      />

      {/* ── "…" menu ──────────────────────── */}
      <Sheet open={!!menuPost} onClose={() => setMenuPost(null)} title={menuPost?.author.name}>
        {menuPost ? (
          <View style={styles.menu}>
            {menuIsMine || isStaff ? (
              <>
                {menuIsMine ? (
                  <ListItem
                    title={t ? 'Editar publicación' : 'Edit post'}
                    leftIcon={<Feather name="edit-2" size={18} color={Colors.textPrimary} />}
                    showChevron={false}
                    onPress={() => {
                      const id = menuPost.id;
                      setMenuPost(null);
                      router.push(`/(app)/community/new-post?editId=${id}` as never);
                    }}
                  />
                ) : null}
                <ListItem
                  title={t ? 'Eliminar publicación' : 'Delete post'}
                  destructive
                  leftIcon={<Feather name="trash-2" size={18} color={Colors.accentDanger} />}
                  showChevron={false}
                  onPress={() => {
                    const p = menuPost;
                    setMenuPost(null);
                    setConfirm({ kind: 'delete', post: p });
                  }}
                />
              </>
            ) : null}
            {!menuIsMine ? (
              <>
                <ListItem
                  title={
                    menuPost.isSaved
                      ? t ? 'Quitar de guardados' : 'Unsave'
                      : t ? 'Guardar publicación' : 'Save post'
                  }
                  leftIcon={<Feather name="bookmark" size={18} color={Colors.textPrimary} />}
                  showChevron={false}
                  onPress={() => {
                    const p = menuPost;
                    setMenuPost(null);
                    toggleSave(p);
                  }}
                />
                <ListItem
                  title={t ? 'Ocultar publicación' : 'Hide post'}
                  subtitle={t ? 'Deja de verla en tu feed' : 'Stop seeing it in your feed'}
                  leftIcon={<Feather name="eye-off" size={18} color={Colors.textPrimary} />}
                  showChevron={false}
                  onPress={() => {
                    const p = menuPost;
                    setMenuPost(null);
                    hidePost(p);
                  }}
                />
                <ListItem
                  title={t ? 'Reportar' : 'Report'}
                  leftIcon={<Feather name="flag" size={18} color={Colors.textPrimary} />}
                  showChevron={false}
                  onPress={() => {
                    const p = menuPost;
                    setMenuPost(null);
                    setReportPost(p);
                  }}
                />
                <ListItem
                  title={t ? 'Bloquear usuario' : 'Block user'}
                  destructive
                  leftIcon={<Feather name="slash" size={18} color={Colors.accentDanger} />}
                  showChevron={false}
                  onPress={() => {
                    const p = menuPost;
                    setMenuPost(null);
                    setConfirm({ kind: 'block', post: p });
                  }}
                />
              </>
            ) : null}
          </View>
        ) : (
          <View />
        )}
      </Sheet>

      <ConfirmSheet
        visible={!!confirm}
        onClose={() => (confirmBusy ? undefined : setConfirm(null))}
        title={
          confirm?.kind === 'block'
            ? t ? '¿Bloquear usuario?' : 'Block user?'
            : t ? '¿Eliminar publicación?' : 'Delete post?'
        }
        message={
          confirm?.kind === 'block'
            ? t
              ? 'No verás sus publicaciones ni podrá contactarte.'
              : "You won't see their posts and they can't contact you."
            : t
              ? 'Se quitará del feed de inmediato. Esta acción no se puede deshacer.'
              : 'It will be removed from the feed immediately. This cannot be undone.'
        }
        icon={confirm?.kind === 'block' ? 'slash' : 'trash-2'}
        variant="danger"
        confirmLabel={
          confirm?.kind === 'block' ? (t ? 'Bloquear' : 'Block') : t ? 'Eliminar' : 'Delete'
        }
        onConfirm={runConfirm}
        loading={confirmBusy}
      />

      <ReportSheet
        visible={!!reportPost}
        onClose={() => setReportPost(null)}
        onSubmit={submitReport}
        title={t ? 'Reportar publicación' : 'Report post'}
        t={t}
      />
    </SafeAreaView>
  );
}

// ── Feed skeleton ─────────────────────────────
function FeedSkeleton() {
  return (
    <View style={{ gap: Spacing[2] }}>
      {[0, 1].map((i) => (
        <View key={i} style={styles.skelCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
            <Skeleton width={42} height={42} radius={Radius.full} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="45%" height={12} />
              <Skeleton width="25%" height={10} />
            </View>
          </View>
          <View style={{ gap: 6, marginTop: Spacing[3] }}>
            <Skeleton width="95%" height={12} />
            <Skeleton width="70%" height={12} />
          </View>
          <Skeleton height={260} radius={Radius.xs} style={{ marginTop: Spacing[3] }} />
          <View style={{ flexDirection: 'row', gap: Spacing[4], marginTop: Spacing[3] }}>
            <Skeleton width="28%" height={16} />
            <Skeleton width="28%" height={16} />
            <Skeleton width="28%" height={16} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── MembersPanel — networking directory ──────
function MembersPanel({ t, router }: { t: boolean; router: ReturnType<typeof useRouter> }) {
  const fb = useFeedback();
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [busyThread, setBusyThread] = useState<string | null>(null);

  const loadConnected = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await friendshipsApi.list(50);
      const list = r.data?.data?.data ?? r.data?.data ?? [];
      setMembers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(apiError(err, t ? 'No se pudieron cargar los miembros.' : 'Could not load members.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (query.trim().length === 0) {
      loadConnected();
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await usersApi.search(query.trim(), 30);
        const list = r.data?.data?.data ?? r.data?.data ?? [];
        setMembers(Array.isArray(list) ? list : []);
        setError(null);
      } catch (err) {
        setError(apiError(err, t ? 'La búsqueda falló.' : 'Search failed.'));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, loadConnected, t]);

  const items = useMemo(
    () =>
      members.map((m: any) => {
        const u = m.friend ?? m.user ?? m;
        const connected = m.status === 'ACCEPTED' || !!m.friend || !!u.isFollowing || !!u.isFriend;
        return {
          id: u.id,
          firstName: u.profile?.firstName ?? u.firstName,
          lastName: u.profile?.lastName ?? u.lastName,
          avatarUrl: u.profile?.avatarUrl ?? u.avatarUrl,
          loyaltyLevel: u.profile?.loyaltyLevel ?? u.loyaltyLevel,
          profession: u.profile?.profession ?? u.profession,
          city: u.profile?.city ?? u.city,
          country: u.profile?.country ?? u.country,
          connectionState: (connected ? 'connected' : pending.has(u.id) ? 'pending' : 'none') as
            | 'none'
            | 'pending'
            | 'connected',
        };
      }),
    [members, pending],
  );

  const connect = useCallback(
    async (id: string) => {
      fb.select();
      setPending((s) => new Set(s).add(id));
      try {
        await usersApi.follow(id);
        toast(t ? 'Ahora sigues a este miembro.' : 'You now follow this member.', 'success', 1800);
      } catch (err) {
        fb.error();
        setPending((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        toast(apiError(err, t ? 'No se pudo conectar.' : 'Could not connect.'), 'danger');
      }
    },
    [fb, t],
  );

  const message = useCallback(
    async (id: string) => {
      if (busyThread) return;
      setBusyThread(id);
      try {
        const r = await messagesApi.createThread(id);
        const threadId = r.data?.data?.id;
        if (!threadId) throw new Error('missing thread id');
        router.push(`/(app)/messages/${threadId}` as never);
      } catch (err) {
        fb.error();
        toast(apiError(err, t ? 'No se pudo abrir el chat.' : 'Could not open chat.'), 'danger');
      } finally {
        setBusyThread(null);
      }
    },
    [busyThread, router, fb, t],
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t ? 'Buscar miembros…' : 'Search members…'}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t ? 'Buscar miembros' : 'Search members'}
          style={styles.searchInput}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.memberList}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={96} radius={Radius.card} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} retryLabel={t ? 'Reintentar' : 'Retry'} onRetry={loadConnected} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="users"
          title={query ? (t ? 'Sin resultados' : 'No results') : t ? 'Aún sin conexiones' : 'No connections yet'}
          message={
            query
              ? t ? 'Prueba con otro nombre.' : 'Try another name.'
              : t
                ? 'Busca a otros miembros del club y empieza a conectar.'
                : 'Search for other club members and start connecting.'
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.memberList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: Spacing[3] }} />}
          renderItem={({ item }) => (
            <MemberCard
              member={item}
              connectionState={item.connectionState}
              onPress={() => router.push(`/(app)/users/${item.id}` as never)}
              onMessage={() => message(item.id)}
              onConnect={() => connect(item.id)}
              t={t}
            />
          )}
        />
      )}
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
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    gap: Spacing[3],
  },
  titleBlock: { flex: 1 },
  title: { marginTop: 2 },
  hdrRight: { flexDirection: 'row', gap: Spacing[1] },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  feed: { paddingBottom: Spacing[12], flexGrow: 1 },
  gap: { height: Spacing[2], backgroundColor: Colors.bgPrimary },

  // Composer card
  composer: { backgroundColor: Colors.bgCard, paddingTop: Spacing[3] },
  composerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[3],
  },
  composerAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInitials: { color: Colors.textInverse, fontSize: 14, fontWeight: '700' },
  composerInput: {
    flex: 1,
    height: 42,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.bgSubtle,
    paddingHorizontal: Spacing[4],
    justifyContent: 'center',
  },
  composerPlaceholder: { ...TypePresets.body, color: Colors.textMuted },
  composerRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  composerBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  composerBtnLbl: { ...TypePresets.bodySm, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  composerDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: Colors.borderStrong },

  // "Nuevas publicaciones" pill
  newPillWrap: { position: 'absolute', top: Spacing[3], left: 0, right: 0, alignItems: 'center' },
  newPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing[4],
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentPrimary,
  },
  newPillLbl: { ...TypePresets.bodySm, fontFamily: 'Inter_600SemiBold', color: Colors.textInverse },

  // Sheet menu
  menu: { paddingBottom: Spacing[4] },

  // Skeleton
  skelCard: { backgroundColor: Colors.bgCard, padding: EditorialSpacing.pageGutter },

  // Members
  searchWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[3],
    paddingBottom: Spacing[2],
  },
  searchInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  memberList: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[12],
    gap: Spacing[3],
  },
});
