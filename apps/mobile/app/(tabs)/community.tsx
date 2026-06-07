// ─────────────────────────────────────────────
//  Community — Editorial Premium
//
//  IG-style feed (post cards + stories). The layout is rewritten to the
//  Editorial system; the business logic — realtime, optimistic reactions,
//  pagination, moderation flow — is preserved verbatim and lives in this
//  screen. The presentational pieces (StoryStripe, PostCard, CreateSheet)
//  live in src/components/community/ so this file stays focused on data
//  and state.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { communityApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { useCommunityRealtime } from '@/hooks/useCommunityRealtime';
import { useRealtime } from '@/hooks/useRealtime';
import { relativeTime } from '@/utils/time';

import {
  Colors,
  EditorialSpacing,
  Spacing,
} from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  Tabs,
} from '@/components/ui';
import { ReactionPicker } from '@/components/ui/ReactionPicker';
import { ReactorsModal } from '@/components/ui/ReactorsModal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

import { CreateSheet } from '@/components/community/CreateSheet';
import { MemberCard } from '@/components/community/MemberCard';
import { PostCard, type CommunityPost } from '@/components/community/PostCard';
import { StoryStripe, type StoryItem } from '@/components/community/StoryStripe';
import { friendshipsApi, usersApi } from '@/api/client';

// ── Avatar palette ───────────────────────────
const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// relativeTime importada desde @/utils/time — clampea diffs negativos a 0
// para evitar "-3594s" cuando el reloj del device está atrasado vs server.
function adaptPost(row: any, t: boolean): CommunityPost {
  const first = row?.user?.profile?.firstName ?? '';
  const last = row?.user?.profile?.lastName ?? '';
  const fullName = `${first} ${last}`.trim() || 'Usuario';
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
  const created = row?.createdAt ? new Date(row.createdAt) : null;
  return {
    id: row.id,
    userId: row.userId,
    author: {
      id: row.user?.id,
      name: fullName,
      avatarUrl: row?.user?.profile?.avatarUrl,
      initials,
      color: colorFor(row.userId || row.id || ''),
    },
    timeAgo: created ? relativeTime(created, t) : '',
    text: row?.content,
    imageUrl: row?.imageUrl ?? undefined,
    likes: row?.likesCount ?? row?._count?.reactions ?? 0,
    comments: row?.commentsCount ?? row?._count?.comments ?? 0,
    hasReacted: !!row?.hasReacted,
    emojiReactions: Array.isArray(row?.emojiReactions) ? row.emojiReactions : [],
    myEmoji: (row?.emojiReactions ?? []).find((r: any) => r?.mine)?.emoji ?? null,
  };
}

const POSTS_PAGE = 20;

export default function Community() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'foryou' | 'following'>('members');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqIdRef = useRef(0);
  const fb = useFeedback();

  // FB-style reactions state — picker anchored to button + reactors sheet
  const [picker, setPicker] = useState<{ postId: string; x: number; y: number } | null>(null);
  const [reactorsForPost, setReactorsForPost] = useState<string | null>(null);

  // Real stories fetched from backend — shape: { venue, personal }
  const [venueGroup, setVenueGroup] = useState<any | null>(null);
  const [personalGroups, setPersonalGroups] = useState<any[]>([]);
  const loadStories = useCallback(() => {
    const scope = activeTab === 'following' ? 'following' : undefined;
    communityApi
      .stories(scope)
      .then((r) => {
        const payload = r.data?.data ?? r.data ?? {};
        setVenueGroup(payload.venue ?? null);
        setPersonalGroups(payload.personal ?? []);
      })
      .catch(() => {
        setVenueGroup(null);
        setPersonalGroups([]);
      });
  }, [activeTab]);
  useFocusEffect(
    useCallback(() => {
      loadStories();
    }, [loadStories]),
  );

  const stories = useMemo<StoryItem[]>(() => {
    const personal: StoryItem[] = personalGroups.map((g: any) => {
      const first = g.user?.profile?.firstName ?? '';
      const last = g.user?.profile?.lastName ?? '';
      const name = `${first} ${last}`.trim() || 'Usuario';
      const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
      return {
        id: g.user.id,
        kind: 'personal',
        name,
        avatarUrl: g.user?.profile?.avatarUrl,
        initials,
        color: colorFor(g.user.id || ''),
        hasUnseen: !!g.hasUnseen,
      };
    });
    // Venue always first — it's the bar's own channel.
    if (venueGroup) {
      return [
        {
          id: '__venue__',
          kind: 'venue',
          name: 'OPAL BAR PV',
          avatarUrl: null,
          initials: 'OB',
          color: Colors.accentPrimary,
          hasUnseen: !!venueGroup.hasUnseen,
        },
        ...personal,
      ];
    }
    return personal;
  }, [venueGroup, personalGroups]);

  const load = useCallback(
    async (mode: 'fresh' | 'more' = 'fresh') => {
      const nextPage = mode === 'more' ? page + 1 : 1;
      if (mode === 'more' && (loadingMore || !hasMore)) return;
      if (mode === 'more') setLoadingMore(true);
      else setError(null);
      const id = ++reqIdRef.current;
      try {
        const scope = activeTab === 'following' ? 'following' : 'forYou';
        const r = await communityApi.posts({
          page: nextPage,
          limit: POSTS_PAGE,
          scope,
          surface: 'community',
        });
        if (reqIdRef.current !== id) return;
        const payload = r.data?.data;
        const rows = payload?.data ?? [];
        const meta = payload?.meta;
        const adapted = rows.map((x: any) => adaptPost(x, t));
        setPosts((prev) => (mode === 'more' ? [...prev, ...adapted] : adapted));
        setPage(nextPage);
        setHasMore(meta ? !!meta.hasNextPage : rows.length === POSTS_PAGE);
      } catch (err) {
        if (reqIdRef.current === id) {
          setError(
            apiError(
              err,
              t ? 'No se pudieron cargar las publicaciones.' : 'Could not load posts.',
            ),
          );
        }
      } finally {
        if (reqIdRef.current === id) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [activeTab, t, page, loadingMore, hasMore],
  );

  useFocusEffect(
    useCallback(() => {
      // Always refresh from page 1 when the tab regains focus.
      load('fresh');
    }, [activeTab, t]),
  );

  useCommunityRealtime(() => {
    load('fresh');
  });

  // Also listen on the unified /rt socket — covers post approvals/rejections
  // and gives us a redundant channel in case /community is flaky.
  useRealtime(['post', 'comment'], () => {
    load('fresh');
  });

  // Stories don't go through /community — refresh the carousel when the
  // unified /rt socket reports a new or deleted story.
  useRealtime(['story'], () => {
    loadStories();
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load('fresh');
  }, [load]);

  const onEndReached = useCallback(() => {
    load('more');
  }, [load]);

  async function reactWithEmoji(post: CommunityPost, emoji: string) {
    // FB-style: each user has at most one emoji per post.
    //  · Tap the SAME emoji you already have → remove it.
    //  · Tap a DIFFERENT one → swap (server clears prior, sets new).
    const previousEmoji = post.myEmoji ?? null;
    const willRemove = previousEmoji === emoji;
    const nextEmoji = willRemove ? null : emoji;
    fb.like();

    const buildNextReactions = (prev: CommunityPost['emojiReactions']) => {
      const arr = (prev ?? []).map((r) => ({ ...r }));
      // Remove previous mine entry
      if (previousEmoji) {
        const i = arr.findIndex((r) => r.emoji === previousEmoji);
        if (i >= 0) {
          arr[i].count = Math.max(0, arr[i].count - 1);
          arr[i].mine = false;
          if (arr[i].count <= 0) arr.splice(i, 1);
        }
      }
      // Add new mine entry
      if (nextEmoji) {
        const i = arr.findIndex((r) => r.emoji === nextEmoji);
        if (i >= 0) {
          arr[i].count += 1;
          arr[i].mine = true;
        } else {
          arr.push({ emoji: nextEmoji, count: 1, mine: true });
        }
      }
      return arr;
    };

    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              myEmoji: nextEmoji,
              emojiReactions: buildNextReactions(p.emojiReactions),
            }
          : p,
      ),
    );

    try {
      // If switching emoji, send new emoji (server clears prior + sets new).
      // If removing, send same emoji (server toggles off).
      await communityApi.emojiReact(post.id, emoji);
    } catch {
      fb.error();
      // Revert
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    }
  }

  // Quick toggle: if no current reaction → use ❤️. If has one → remove it.
  async function quickToggle(post: CommunityPost) {
    const emoji = post.myEmoji ?? '❤️';
    return reactWithEmoji(post, emoji);
  }

  function openPostOptions(post: CommunityPost) {
    // Politica de moderacion:
    //  · Usuarios comunes solo pueden Reportar (no borrar — preserva la
    //    cadena de evidencia para moderacion).
    //  · Staff (ADMIN/SUPER_ADMIN/MODERATOR) puede borrar cualquier post
    //    directamente.
    const isStaff =
      user?.role && ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(user.role);
    const buttons: any[] = [];

    if (isStaff) {
      buttons.push({
        text: t ? 'Borrar publicación' : 'Delete post',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert(
            t ? '¿Borrar?' : 'Delete?',
            t
              ? 'La publicación se ocultará del feed inmediatamente.'
              : 'The post will be hidden from the feed immediately.',
            [
              { text: t ? 'Cancelar' : 'Cancel', style: 'cancel' },
              {
                text: t ? 'Borrar' : 'Delete',
                style: 'destructive',
                onPress: async () => {
                  setPosts((prev) => prev.filter((p) => p.id !== post.id));
                  try {
                    await communityApi.deletePost(post.id);
                  } catch (err: any) {
                    Alert.alert(t ? 'Error' : 'Error', apiError(err));
                  }
                },
              },
            ],
          );
        },
      });
    }

    buttons.push({
      text: t ? 'Reportar' : 'Report',
      onPress: async () => {
        try {
          await communityApi.reportPost(post.id, { reason: 'OTHER' });
          Alert.alert(
            t ? 'Gracias' : 'Thanks',
            t ? 'Publicación reportada.' : 'Post reported.',
          );
        } catch {
          /* swallow */
        }
      },
    });
    buttons.push({ text: t ? 'Cancelar' : 'Cancel', style: 'cancel' as const });

    Alert.alert(t ? 'Opciones' : 'Options', post.author.name, buttons);
  }

  // ── Stories press handler ───────────────────
  const handleStoryPress = useCallback(
    (story: StoryItem) => {
      if (story.kind === 'venue') {
        router.push('/(app)/community/story-viewer?venue=1' as never);
      } else if (story.id) {
        router.push(
          `/(app)/community/story-viewer?userId=${story.id}&single=1` as never,
        );
      }
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Editorial masthead ──────────────── */}
      <View style={styles.header}>
        <Pressy
          onPress={() => setShowCreateSheet(true)}
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Crear publicación' : 'Create post'}
          hitSlop={HitSlop.expand}
          haptic="select"
          style={styles.iconBtn}
        >
          <Feather name="plus" size={22} color={Colors.textPrimary} />
        </Pressy>

        <View style={styles.titleBlock}>
          <Kicker tone="champagne">{t ? 'COMUNIDAD' : 'COMMUNITY'}</Kicker>
          <Heading size="sm" style={styles.title}>
            OPAL BAR
          </Heading>
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

      {/* ── Tabs ────────────────────────────── */}
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'members' | 'foryou' | 'following')}
        options={[
          { value: 'members', label: t ? 'Miembros' : 'Members' },
          { value: 'foryou', label: t ? 'Feed' : 'Feed' },
          { value: 'following', label: t ? 'Siguiendo' : 'Following' },
        ]}
      />

      {activeTab === 'members' ? (
        <MembersPanel t={t} router={router} />
      ) : loading && posts.length === 0 ? (
        <ActivityIndicator
          color={Colors.textMuted}
          style={{ marginTop: Spacing[10] }}
        />
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
        <FlatList
          data={posts}
          keyExtractor={(p, idx) => (p.id ? `post-${p.id}-${idx}` : `post-fallback-${idx}`)}
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <Hairline variant="subtle" />}
          ListHeaderComponent={
            <View>
              {/* Users cannot post stories from the community feed — they
                  must do it from their own profile. "Para ti" surfaces only
                  the venue; "Siguiendo" adds stories from accounts you
                  follow. */}
              <StoryStripe stories={stories} onPressStory={handleStoryPress} />
              {stories.length > 0 ? <Hairline variant="subtle" /> : null}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.textMuted}
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={onEndReached}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={Colors.textMuted}
                style={{ paddingVertical: Spacing[6] }}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              t={t}
              onPress={() =>
                router.push(`/(app)/community/posts/${item.id}` as never)
              }
              onAuthorPress={() =>
                item.author.id &&
                router.push(`/(app)/users/${item.author.id}` as never)
              }
              onQuickReact={() => quickToggle(item)}
              onOpenPicker={(x, y) => setPicker({ postId: item.id, x, y })}
              onOpenReactors={() => setReactorsForPost(item.id)}
              onOptions={() => openPostOptions(item)}
            />
          )}
          ListEmptyComponent={
            activeTab === 'following' ? (
              <EmptyState
                icon="users"
                title={t ? 'Aún no sigues a nadie.' : 'You follow no one yet.'}
                message={
                  t
                    ? 'Busca a otras personas para ver sus publicaciones e historias aquí.'
                    : 'Find people to see their posts and stories here.'
                }
                actionLabel={t ? 'Buscar personas' : 'Find people'}
                onAction={() => router.push('/(app)/search' as never)}
              />
            ) : (
              <EmptyState
                icon="message-square"
                title={t ? 'Aún no hay publicaciones.' : 'No posts yet.'}
                actionLabel={t ? 'Sé el primero' : 'Be the first'}
                onAction={() =>
                  router.push('/(app)/community/new-post' as never)
                }
              />
            )
          }
        />
      )}

      <CreateSheet
        visible={showCreateSheet}
        t={t}
        onClose={() => setShowCreateSheet(false)}
        onPhoto={() => {
          setShowCreateSheet(false);
          router.push('/(app)/community/new-post' as never);
        }}
        onPost={() => {
          setShowCreateSheet(false);
          router.push('/(app)/community/new-post' as never);
        }}
        onStory={() => {
          setShowCreateSheet(false);
          router.push('/(app)/community/new-story' as never);
        }}
      />

      {/* FB-style reaction picker (anchored to the button that triggered it) */}
      <ReactionPicker
        visible={!!picker}
        anchorY={picker?.y ?? 0}
        anchorX={picker?.x || undefined}
        onSelect={(emoji) => {
          const target = posts.find((p) => p.id === picker?.postId);
          if (target) reactWithEmoji(target, emoji);
        }}
        onClose={() => setPicker(null)}
      />

      {/* Reactors list ("who reacted") sheet */}
      <ReactorsModal
        visible={!!reactorsForPost}
        postId={reactorsForPost}
        onClose={() => setReactorsForPost(null)}
      />
    </SafeAreaView>
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
    paddingBottom: Spacing[4],
    gap: Spacing[3],
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    marginTop: Spacing[1],
  },
  hdrRight: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  feed: {
    paddingBottom: Spacing[12],
    flexGrow: 1,
  },
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

// ── MembersPanel — Soho House networking view ──
function MembersPanel({ t, router }: { t: boolean; router: any }) {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConnected = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await friendshipsApi.list(50);
      const list = r.data?.data?.data ?? r.data?.data ?? r.data ?? [];
      setMembers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

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
        setError(apiError(err));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, loadConnected]);

  // Extract member-lite shape from friendship row OR user search result
  const items = useMemo(
    () =>
      members.map((m: any) => {
        // friendship row has m.friend = { id, profile }
        const u = m.friend ?? m.user ?? m;
        return {
          id: u.id,
          firstName: u.profile?.firstName ?? u.firstName,
          lastName: u.profile?.lastName ?? u.lastName,
          avatarUrl: u.profile?.avatarUrl ?? u.avatarUrl,
          loyaltyLevel: u.profile?.loyaltyLevel ?? u.loyaltyLevel,
          profession: u.profile?.profession ?? u.profession,
          city: u.profile?.city ?? u.city,
          country: u.profile?.country ?? u.country,
          connectionState: (m.status === 'ACCEPTED' || m.friend) ? 'connected' : 'none',
        };
      }),
    [members],
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
        <ActivityIndicator color={Colors.textMuted} style={{ marginTop: Spacing[10] }} />
      ) : error ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={loadConnected}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="users"
          title={t ? 'Aún sin conexiones' : 'No connections yet'}
          message={
            query
              ? t
                ? 'Sin resultados para tu búsqueda.'
                : 'No results for your search.'
              : t
                ? 'Empieza a conectar con otros miembros del club.'
                : 'Start connecting with other club members.'
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.memberList}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing[3] }} />}
          renderItem={({ item }) => (
            <MemberCard
              member={item}
              connectionState={item.connectionState as 'none' | 'pending' | 'connected'}
              onPress={() => router.push(`/(app)/users/${item.id}` as never)}
              onMessage={() => router.push(`/(app)/messages/${item.id}` as never)}
              onConnect={async () => {
                try {
                  await usersApi.follow(item.id);
                } catch {
                  /* ignore */
                }
              }}
              t={t}
            />
          )}
        />
      )}
    </View>
  );
}
