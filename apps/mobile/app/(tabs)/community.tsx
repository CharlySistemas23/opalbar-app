import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { communityApi, usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Heart } from '@/components/Heart';
import { useFeedback } from '@/hooks/useFeedback';
import { useCommunityRealtime } from '@/hooks/useCommunityRealtime';
import { useRealtime } from '@/hooks/useRealtime';
import { sharePost } from '@/utils/share';

// ─────────────────────────────────────────────
//  Community Feed — Instagram-style
//  · Hamburger in header opens "create" sheet (Foto / Publicación / Historia)
//  · IG-style stories bar with gradient-like ring
//  · IG-style post cards, full-bleed images
//  · Double-tap to like (IG), actions row + stats (FB)
// ─────────────────────────────────────────────

interface Author {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  color?: string;
}

interface CommunityPost {
  id: string;
  userId?: string;
  author: Author;
  timeAgo: string;
  reference?: string;
  text?: string;
  imageUrl?: string;
  likes?: number;
  comments?: number;
  hasReacted?: boolean;
}

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function relativeTime(date: Date, t: boolean): string {
  const d = Math.floor((Date.now() - date.getTime()) / 1000);
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

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
  };
}

export default function Community() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const fb = useFeedback();

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
  const stories = useMemo(() => {
    const personal = personalGroups.map((g: any) => {
      const first = g.user?.profile?.firstName ?? '';
      const last = g.user?.profile?.lastName ?? '';
      const name = `${first} ${last}`.trim() || 'Usuario';
      const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
      return {
        id: g.user.id,
        kind: 'personal' as const,
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
          kind: 'venue' as const,
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

  const load = useCallback(async () => {
    setError(null);
    try {
      const scope = activeTab === 'following' ? 'following' : 'forYou';
      const r = await communityApi.posts({ limit: 50, scope, surface: 'community' });
      const rows = r.data?.data?.data ?? [];
      setPosts(rows.map((x: any) => adaptPost(x, t)));
    } catch (err) {
      setError(apiError(err, t ? 'No se pudieron cargar las publicaciones.' : 'Could not load posts.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useCommunityRealtime(() => {
    load();
  });

  // Also listen on the unified /rt socket — covers post approvals/rejections
  // and gives us a redundant channel in case /community is flaky.
  useRealtime(['post', 'comment'], () => {
    load();
  });

  // Stories don't go through /community — refresh the carousel when the
  // unified /rt socket reports a new or deleted story.
  useRealtime(['story'], () => {
    loadStories();
  });

  async function toggleLike(post: CommunityPost) {
    const newHas = !post.hasReacted;
    if (newHas) fb.like();
    else fb.tap();
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, hasReacted: newHas, likes: (p.likes || 0) + (newHas ? 1 : -1) }
          : p,
      ),
    );
    try {
      if (newHas) await communityApi.react(post.id, 'LIKE');
      else await communityApi.removeReaction(post.id);
    } catch {
      fb.error();
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, hasReacted: !newHas, likes: (p.likes || 0) + (newHas ? -1 : 1) }
            : p,
        ),
      );
    }
  }

  async function deletePost(post: CommunityPost) {
    Alert.alert(
      t ? 'Borrar publicación' : 'Delete post',
      t ? '¿Seguro que quieres borrarla?' : 'Are you sure?',
      [
        { text: t ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: t ? 'Borrar' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityApi.deletePost(post.id);
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
            } catch (err: any) {
              Alert.alert(t ? 'Error' : 'Error', apiError(err));
            }
          },
        },
      ],
    );
  }

  function openPostOptions(post: CommunityPost) {
    const isMine = post.userId === user?.id;
    if (isMine) {
      Alert.alert(t ? 'Opciones' : 'Options', post.author.name, [
        { text: t ? 'Borrar' : 'Delete', style: 'destructive', onPress: () => deletePost(post) },
        { text: t ? 'Cancelar' : 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert(t ? 'Opciones' : 'Options', post.author.name, [
        {
          text: t ? 'Reportar' : 'Report',
          onPress: async () => {
            try {
              await communityApi.reportPost(post.id, { reason: 'OTHER' });
              Alert.alert(t ? 'Gracias' : 'Thanks', t ? 'Publicación reportada.' : 'Post reported.');
            } catch {}
          },
        },
        { text: t ? 'Cancelar' : 'Cancel', style: 'cancel' },
      ]);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowCreateSheet(true)}
          hitSlop={6}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>OPAL BAR</Text>
        </View>

        <View style={styles.hdrRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            hitSlop={6}
            onPress={() => router.push('/(app)/search' as never)}
            activeOpacity={0.7}
          >
            <Feather name="search" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/(app)/messages' as never)}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <Feather name="send" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Feed Tabs ────────────────────────── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={styles.feedTab}
          onPress={() => setActiveTab('foryou')}
          activeOpacity={0.8}
        >
          <Text style={[styles.feedTabLabel, activeTab === 'foryou' && styles.feedTabLabelActive]}>
            {t ? 'Para ti' : 'For you'}
          </Text>
          {activeTab === 'foryou' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.feedTab}
          onPress={() => setActiveTab('following')}
          activeOpacity={0.8}
        >
          <Text style={[styles.feedTabLabel, activeTab === 'following' && styles.feedTabLabelActive]}>
            {t ? 'Siguiendo' : 'Following'}
          </Text>
          {activeTab === 'following' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {loading && posts.length === 0 ? (
        <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 40 }} />
      ) : error && posts.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p, idx) => (p.id ? `post-${p.id}-${idx}` : `post-fallback-${idx}`)}
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* ── Stories (IG) ──────────────── */}
              {/* Users cannot post stories from the community feed — they
                  must do it from their own profile. "Para ti" surfaces only
                  the venue; "Siguiendo" adds stories from accounts you
                  follow. */}
              {stories.length > 0 ? (
                <FlatList
                  horizontal
                  data={stories}
                  keyExtractor={(a: any, idx) => `story-${a.id || idx}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.storiesRow}
                  renderItem={({ item }: any) => (
                    <Pressable
                      style={({ pressed }) => [styles.storyItem, pressed && styles.pressed]}
                      onPress={() => {
                        if (item.kind === 'venue') {
                          router.push('/(app)/community/story-viewer?venue=1' as never);
                        } else if (item.id) {
                          router.push(
                            `/(app)/community/story-viewer?userId=${item.id}&single=1` as never,
                          );
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.storyRing,
                          !item.hasUnseen && styles.storyRingSeen,
                        ]}
                      >
                        <View style={styles.storyGap}>
                          {item.avatarUrl ? (
                            <Image source={{ uri: item.avatarUrl }} style={styles.storyInnerAvatar} />
                          ) : (
                            <View
                              style={[
                                styles.storyInnerAvatar,
                                { backgroundColor: item.color || Colors.bgElevated },
                              ]}
                            >
                              <Text style={styles.storyAvatarText}>{item.initials || 'U'}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.storyName} numberOfLines={1}>
                        {item.name.split(' ')[0]}
                      </Text>
                    </Pressable>
                  )}
                />
              ) : null}

              <View style={styles.divider} />
            </>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Colors.accentPrimary}
            />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              t={t}
              onPress={() => router.push(`/(app)/community/posts/${item.id}` as never)}
              onAuthorPress={() => item.author.id && router.push(`/(app)/users/${item.author.id}` as never)}
              onLike={() => toggleLike(item)}
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
                onAction={() => router.push('/(app)/community/new-post' as never)}
              />
            )
          }
        />
      )}

      {/* ── Create sheet (hamburguesa) ─────── */}
      <Modal
        visible={showCreateSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateSheet(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowCreateSheet(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t ? 'Crear' : 'Create'}</Text>

            <TouchableOpacity
              style={styles.sheetRow}
              activeOpacity={0.75}
              onPress={() => {
                setShowCreateSheet(false);
                router.push('/(app)/community/new-post' as never);
              }}
            >
              <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
                <Feather name="image" size={20} color="#60A5FA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowLabel}>{t ? 'Foto' : 'Photo'}</Text>
                <Text style={styles.sheetRowSub}>{t ? 'Toma una foto o sube de tu galería' : 'Take a photo or upload from gallery'}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              activeOpacity={0.75}
              onPress={() => {
                setShowCreateSheet(false);
                router.push('/(app)/community/new-post' as never);
              }}
            >
              <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(244,163,64,0.15)' }]}>
                <Feather name="edit-3" size={20} color={Colors.accentPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowLabel}>{t ? 'Publicación' : 'Post'}</Text>
                <Text style={styles.sheetRowSub}>{t ? 'Comparte un texto con la comunidad' : 'Share a text with the community'}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetRow, styles.sheetRowLast]}
              activeOpacity={0.75}
              onPress={() => {
                setShowCreateSheet(false);
                router.push('/(app)/community/new-story' as never);
              }}
            >
              <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                <Feather name="plus-circle" size={20} color="#A855F7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowLabel}>{t ? 'Historia' : 'Story'}</Text>
                <Text style={styles.sheetRowSub}>{t ? 'Publica en tu historia (24h)' : 'Post to your story (24h)'}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Post Card — IG layout, FB stats hybrid
//  · Double-tap image to like
//  · Heart fills red on like
//  · "X me gustan" + "Ver N comentarios"
// ─────────────────────────────────────────────
function PostCard({
  post,
  t,
  onPress,
  onAuthorPress,
  onLike,
  onOptions,
}: {
  post: CommunityPost;
  t: boolean;
  onPress: () => void;
  onAuthorPress: () => void;
  onLike: () => void;
  onOptions: () => void;
}) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const lastTap = useRef<number>(0);
  const pendingOpen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Single tap → open preview (delayed 280ms to see if second tap comes).
  // Double tap → like + burst (cancels the pending open).
  const handleImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      // Second tap within window = double-tap like
      if (pendingOpen.current) {
        clearTimeout(pendingOpen.current);
        pendingOpen.current = null;
      }
      if (!post.hasReacted) {
        onLike();
        setShowLikeBurst(true);
        setTimeout(() => setShowLikeBurst(false), 700);
      }
      lastTap.current = 0;
    } else {
      // First tap: schedule preview, but second tap can still cancel
      lastTap.current = now;
      pendingOpen.current = setTimeout(() => {
        pendingOpen.current = null;
        setPreviewVisible(true);
      }, 280);
    }
  };

  async function handleShare() {
    await sharePost({
      id: post.id,
      content: post.text,
      authorName: post.author.name,
      imageUrl: post.imageUrl,
      likes: post.likes,
      comments: post.comments,
      t,
    });
  }

  async function handleBookmark() {
    // Optimistic toggle; backend call is idempotent
    setIsSaved((v) => !v);
    try {
      await usersApi.toggleSave('POST', post.id);
    } catch {
      setIsSaved((v) => !v);
    }
  }

  return (
    <View>
      <View style={styles.post}>
        {/* Header: avatar + name + time + ••• */}
        <View style={styles.postHdr}>
          <Pressable
            style={({ pressed }) => [styles.postUser, pressed && styles.pressed]}
            onPress={onAuthorPress}
          >
            {post.author.avatarUrl ? (
              <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: post.author.color }]}>
                <Text style={styles.avatarText}>{post.author.initials}</Text>
              </View>
            )}
            <View style={styles.authorInfo}>
              <Text style={styles.authorName} numberOfLines={1}>
                {post.author.name}
              </Text>
              <Text style={styles.timeAgo}>
                {post.timeAgo} · <Text style={styles.publicDot}>{t ? 'Público' : 'Public'}</Text>
              </Text>
            </View>
          </Pressable>
          <TouchableOpacity style={styles.moreBtn} hitSlop={10} onPress={onOptions}>
            <Feather name="more-horizontal" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Caption (if any) BEFORE image — FB style */}
        {post.text && !post.imageUrl ? (
          <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.textOnlyBox}>
            <Text style={styles.textOnly}>{post.text}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Full-bleed image (IG) */}
        {post.imageUrl ? (
          <Pressable onPress={handleImagePress} style={styles.postImgWrapper}>
            <Image source={{ uri: post.imageUrl }} style={styles.postImg} resizeMode="cover" />
            {showLikeBurst && (
              <View pointerEvents="none" style={styles.likeBurst}>
                <Heart filled size={96} color="#fff" />
              </View>
            )}
          </Pressable>
        ) : null}

        {/* Actions: heart / comment / share — bookmark on right */}
        <View style={styles.actionsBar}>
          <View style={styles.actionsLeft}>
            <TouchableOpacity style={styles.actionBtn} onPress={onLike} hitSlop={8} activeOpacity={0.6}>
              <Heart
                size={24}
                filled={!!post.hasReacted}
                color={post.hasReacted ? Colors.accentDanger : Colors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onPress} hitSlop={8} activeOpacity={0.6}>
              <Feather name="message-circle" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} hitSlop={8} activeOpacity={0.6}>
              <Feather name="share-2" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark} hitSlop={8} activeOpacity={0.6}>
            <Feather
              name="bookmark"
              size={22}
              color={isSaved ? Colors.accentPrimary : Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Stats line (IG) */}
        {(post.likes ?? 0) > 0 ? (
          <Text style={styles.statsLine}>
            <Text style={styles.statsBold}>{post.likes}</Text>{' '}
            {post.likes === 1 ? (t ? 'me gusta' : 'like') : t ? 'me gustan' : 'likes'}
          </Text>
        ) : null}

        {/* Caption (IG style — bold name inline) */}
        {post.text && post.imageUrl ? (
          <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.captionBox}>
            <Text style={styles.caption} numberOfLines={2}>
              <Text style={styles.authorNameInline}>{post.author.name}</Text>{' '}
              <Text>{post.text}</Text>
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* View all comments (IG) */}
        {(post.comments ?? 0) > 0 ? (
          <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.viewComments}>
              {t ? `Ver los ${post.comments} comentarios` : `View all ${post.comments} comments`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Image preview modal */}
      {post.imageUrl && (
        <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <View style={styles.previewBackdrop}>
            <TouchableOpacity
              style={styles.previewClose}
              onPress={() => setPreviewVisible(false)}
              hitSlop={10}
              activeOpacity={0.7}
            >
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: post.imageUrl }} style={styles.previewImage} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  pressed: { opacity: 0.7 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    bottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.accentPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  hdrRight: { flexDirection: 'row', gap: 14 },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Feed tabs (IG "Para ti / Siguiendo")
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  feedTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  feedTabLabel: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  feedTabLabelActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: '30%',
    right: '30%',
    height: 2,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 1,
  },

  feed: { paddingBottom: 40, flexGrow: 1 },

  // ── Create sheet (hamburguesa) ────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sheetRowLast: {
    borderBottomWidth: 0,
  },
  sheetIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowLabel: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  sheetRowSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  // ── Stories (IG) ──────────────────────────
  storiesRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  storyItem: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentPrimary, // fake gradient ring (active)
  },
  storyRingSeen: {
    backgroundColor: Colors.border, // muted ring for seen stories
  },
  storyGap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
  },
  storyInnerAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarText: {
    color: Colors.textInverse,
    fontWeight: '700',
    fontSize: 16,
  },
  storyAddWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
    padding: 2,
  },
  storyAddBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  storyName: {
    color: Colors.textSecondary,
    fontSize: 11,
    maxWidth: 70,
    textAlign: 'center',
    fontWeight: '500',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // ── Post Card ─────────────────────────────
  post: {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  postHdr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  postUser: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
  authorInfo: { flex: 1 },
  authorName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  timeAgo: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  publicDot: { color: Colors.textMuted },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // text-only post (no image) — bigger text, more prominent
  textOnlyBox: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
  },
  textOnly: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },

  postImgWrapper: {
    width: '100%',
    backgroundColor: Colors.bgElevated,
    position: 'relative',
  },
  postImg: {
    width: '100%',
    aspectRatio: 1,
  },
  likeBurst: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Actions bar (IG — heart/comment/share left, bookmark right)
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  actionsLeft: {
    flexDirection: 'row',
    gap: 2,
  },
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsLine: {
    color: Colors.textPrimary,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  statsBold: { fontWeight: '700' },

  captionBox: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
  },
  caption: {
    color: Colors.textPrimary,
    fontSize: 13.5,
    lineHeight: 19,
  },
  authorNameInline: {
    fontWeight: '700',
  },
  viewComments: {
    color: Colors.textMuted,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },

  // Preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewImage: { width: '100%', height: '80%' },
});
