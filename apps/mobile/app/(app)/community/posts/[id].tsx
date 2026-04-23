import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
} from 'react-native';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { communityApi, usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { ReportSheet } from '@/components/ReportSheet';
import { toast } from '@/components/Toast';
import { Colors } from '@/constants/tokens';
import { useCommunityRealtime } from '@/hooks/useCommunityRealtime';
import { useFeedback } from '@/hooks/useFeedback';

// ─────────────────────────────────────────────
//  Post Detail — Instagram × Facebook hybrid
//  · Edge-to-edge image (IG)
//  · Actions row + bold stats (IG)
//  · Comment bubbles with tree threads (FB)
//  · Quick-reaction emoji row above compose (IG)
// ─────────────────────────────────────────────

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];
const QUICK_EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😮', '😂'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

type ReplyTarget = { id: string; name: string } | null;
type CommentSort = 'recent' | 'interacted' | 'likes';

function commentScore(c: any, mode: CommentSort): number {
  const likes = c?.likesCount ?? 0;
  const replies = c?._count?.replies ?? c?.replies?.length ?? 0;
  const date = c?.createdAt ? new Date(c.createdAt).getTime() : 0;
  if (mode === 'interacted') return likes + replies * 2;
  if (mode === 'likes') return likes;
  return date;
}

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user: me } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>('recent');
  const [hideThreads, setHideThreads] = useState(false);
  const [collapsedThreads, setCollapsedThreads] = useState<Record<string, boolean>>({});
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const lastTap = useRef<number>(0);
  const pendingOpen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const sortedComments = useMemo(() => {
    const list = [...comments];
    return list.sort((a, b) => {
      const aScore = commentScore(a, commentSort);
      const bScore = commentScore(b, commentSort);
      if (bScore !== aScore) return bScore - aScore;
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  }, [comments, commentSort]);

  const commentSortLabel = useMemo(() => {
    if (commentSort === 'interacted') return t ? 'Más interactuados' : 'Most interacted';
    if (commentSort === 'likes') return t ? 'Más likes' : 'Most liked';
    return t ? 'Más recientes' : 'Most recent';
  }, [commentSort, t]);

  const load = useCallback(async () => {
    try {
      const [postRes, commentsRes] = await Promise.all([
        communityApi.post(id),
        communityApi.comments(id),
      ]);
      const p = postRes.data?.data;
      setPost(p);
      setLikeCount(p?.likesCount ?? p?._count?.reactions ?? 0);
      setLiked(!!p?.hasReacted);
      const c = commentsRes.data?.data;
      setComments(Array.isArray(c) ? c : c?.data ?? []);
    } catch {}
    finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useCommunityRealtime(
    () => {
      load();
    },
    { postId: id },
  );

  async function toggleLike() {
    if (!isAuthenticated) return router.push('/(auth)/login' as never);
    try {
      if (liked) {
        fb.tap();
        await communityApi.removeReaction(id);
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        fb.like();
        await communityApi.react(id, 'LIKE');
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch {}
  }

  function handleImagePress() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      // Double tap → like + cancel any pending preview open
      if (pendingOpen.current) {
        clearTimeout(pendingOpen.current);
        pendingOpen.current = null;
      }
      if (!liked) {
        toggleLike();
        setShowLikeBurst(true);
        setTimeout(() => setShowLikeBurst(false), 700);
      }
      lastTap.current = 0;
    } else {
      // Single tap → open preview (cancellable by second tap)
      lastTap.current = now;
      pendingOpen.current = setTimeout(() => {
        pendingOpen.current = null;
        fb.tap();
        setPreviewVisible(true);
      }, 280);
    }
  }

  async function handleShare() {
    fb.tap();
    try {
      const aName =
        `${post?.user?.profile?.firstName ?? ''} ${post?.user?.profile?.lastName ?? ''}`.trim() ||
        'Usuario';
      const msg = post?.content
        ? `"${post.content}" — ${aName} en OPAL BAR`
        : `${aName} publicó en OPAL BAR`;
      const url =
        post?.imageUrl && !post.imageUrl.startsWith('data:')
          ? post.imageUrl
          : undefined;
      await Share.share({ message: msg, url });
    } catch {}
  }

  async function handleBookmark() {
    fb.select();
    setIsSaved((v) => !v);
    try {
      await usersApi.toggleSave('POST', id);
    } catch {
      setIsSaved((v) => !v);
    }
  }

  async function send(overrideText?: string) {
    const body = (overrideText ?? comment).trim();
    if (!body) return;
    if (!isAuthenticated) return router.push('/(auth)/login' as never);
    const parentId = replyTo?.id;
    if (!overrideText) setComment('');
    const savedReply = replyTo;
    setReplyTo(null);
    setSending(true);
    try {
      await communityApi.addComment(id, parentId ? { content: body, parentId } : { content: body });
      fb.send();
      await load();
    } catch (err: any) {
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
      if (!overrideText) setComment(body);
      setReplyTo(savedReply);
    } finally {
      setSending(false);
    }
  }

  async function onToggleCommentLike(commentId: string) {
    if (!isAuthenticated) return router.push('/(auth)/login' as never);
    let willLike = false;
    const toggleLikeInTree = (nodes: any[]): any[] =>
      nodes.map((n) => {
        if (n.id === commentId) {
          willLike = !n.hasLiked;
          return {
            ...n,
            hasLiked: !n.hasLiked,
            likesCount: (n.likesCount ?? 0) + (n.hasLiked ? -1 : 1),
          };
        }
        return { ...n, replies: toggleLikeInTree(n.replies || []) };
      });

    setComments((prev) => toggleLikeInTree(prev));
    if (willLike) fb.like(); else fb.tap();
    try {
      await communityApi.likeComment(commentId);
    } catch {
      load();
    }
  }

  function onCommentOptions(c: any) {
    const mine = c.user?.id === me?.id;
    const buttons: any[] = [];
    if (mine) {
      buttons.push({
        text: t ? 'Borrar' : 'Delete',
        style: 'destructive' as const,
        onPress: async () => {
          try {
            await communityApi.deleteComment(c.id);
            load();
          } catch (err) {
            Alert.alert('Error', apiError(err));
          }
        },
      });
    } else {
      buttons.push({
        text: t ? 'Reportar' : 'Report',
        onPress: async () => {
          try {
            await communityApi.reportComment(c.id, { reason: 'INAPPROPRIATE' });
            Alert.alert(t ? 'Gracias' : 'Thanks', t ? 'Comentario reportado.' : 'Comment reported.');
          } catch (err) {
            Alert.alert('Error', apiError(err));
          }
        },
      });
    }
    buttons.push({ text: t ? 'Cancelar' : 'Cancel', style: 'cancel' as const });
    Alert.alert(t ? 'Opciones' : 'Options', '', buttons);
  }

  function startReply(c: any) {
    const name =
      `${c.user?.profile?.firstName ?? ''} ${c.user?.profile?.lastName ?? ''}`.trim() || 'Usuario';
    const firstName = (c.user?.profile?.firstName ?? '').trim();
    const mention = firstName ? `@${firstName} ` : '';
    setReplyTo({ id: c.id, name });
    setComment((prev) => (prev.trim().length > 0 ? prev : mention));
  }

  function toggleThread(commentId: string) {
    setCollapsedThreads((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  }
  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t ? 'Post no encontrado' : 'Post not found'}</Text>
      </View>
    );
  }

  const author = post.user;
  const authorName =
    `${author?.profile?.firstName ?? ''} ${author?.profile?.lastName ?? ''}`.trim() || 'Usuario';
  const authorInitials =
    ((author?.profile?.firstName?.[0] || '') + (author?.profile?.lastName?.[0] || '')).toUpperCase() ||
    'U';

  return (
    <>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* ── Header ──────────────────────────── */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.topBtn, pressed && styles.pressed]}
              hitSlop={10}
            >
              <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.title}>{t ? 'Publicación' : 'Post'}</Text>
            <Pressable
              onPress={() => author?.id && author.id !== me?.id && setShowReport(true)}
              style={({ pressed }) => [styles.topBtn, pressed && styles.pressed]}
              hitSlop={10}
            >
              {author?.id && author.id !== me?.id ? (
                <Feather name="more-horizontal" size={22} color={Colors.textPrimary} />
              ) : (
                <View style={{ width: 22 }} />
              )}
            </Pressable>
          </View>

          <FlatList
            data={sortedComments}
            keyExtractor={(c) => c.id}
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {/* ── Post Header ───────────────── */}
                <View style={styles.postHdr}>
                  <Pressable
                    style={({ pressed }) => [styles.postUser, pressed && styles.pressed]}
                    onPress={() =>
                      author?.id && router.push(`/(app)/users/${author.id}` as never)
                    }
                  >
                    {author?.profile?.avatarUrl ? (
                      <Image source={{ uri: author.profile.avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View
                        style={[styles.avatar, { backgroundColor: colorFor(author?.id || '') }]}
                      >
                        <Text style={styles.avatarText}>{authorInitials}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.authorNameRow}>
                        <Text style={styles.authorName} numberOfLines={1}>
                          {authorName}
                        </Text>
                        {author?.id === me?.id && (
                          <View style={styles.authorTag}>
                            <Text style={styles.authorTagText}>{t ? 'Tú' : 'You'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.timeRow}>
                        <Text style={styles.timeAgo}>{relTime(post.createdAt)}</Text>
                        <Text style={styles.timeDot}>·</Text>
                        <Feather name="globe" size={11} color={Colors.textMuted} />
                        <Text style={styles.timeAgo}>{t ? 'Público' : 'Public'}</Text>
                      </View>
                    </View>
                  </Pressable>
                </View>

                {/* ── Text-only content (FB status bubble) ─────────── */}
                {post.content && !post.imageUrl ? (
                  <View style={styles.statusCard}>
                    <Text
                      style={[
                        styles.statusText,
                        post.content.length <= 80 && styles.statusTextLarge,
                      ]}
                    >
                      {post.content}
                    </Text>
                  </View>
                ) : null}

                {/* ── Image (IG full-bleed) ─────── */}
                {post.imageUrl ? (
                  <Pressable onPress={handleImagePress} style={styles.imgWrapper}>
                    <Image source={{ uri: post.imageUrl }} style={styles.img} resizeMode="cover" />
                    {showLikeBurst && (
                      <View pointerEvents="none" style={styles.likeBurst}>
                        <Feather name="heart" size={110} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                ) : null}

                {/* ── Stats strip (FB) ───────────── */}
                {(likeCount > 0 || comments.length > 0) && (
                  <View style={styles.statsStrip}>
                    {likeCount > 0 ? (
                      <View style={styles.statsStripLeft}>
                        <View style={styles.likeBubble}>
                          <Feather name="heart" size={10} color="#fff" />
                        </View>
                        <Text style={styles.statsStripText}>
                          {likeCount}{' '}
                          {likeCount === 1
                            ? t
                              ? 'me gusta'
                              : 'like'
                            : t
                              ? 'me gustan'
                              : 'likes'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.statsStripLeft} />
                    )}
                    {comments.length > 0 && (
                      <Text style={styles.statsStripText}>
                        {comments.length}{' '}
                        {comments.length === 1
                          ? t
                            ? 'comentario'
                            : 'comment'
                          : t
                            ? 'comentarios'
                            : 'comments'}
                      </Text>
                    )}
                  </View>
                )}

                {/* ── Actions Bar (FB 3-column with counters) ──────── */}
                <View style={styles.actionsBar}>
                  <Pressable
                    style={({ pressed }) => [styles.actionCol, pressed && styles.pressed]}
                    onPress={toggleLike}
                    hitSlop={4}
                  >
                    <Feather
                      name="heart"
                      size={20}
                      color={liked ? Colors.accentDanger : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.actionColLabel,
                        liked && { color: Colors.accentDanger, fontWeight: '800' },
                      ]}
                    >
                      {t ? 'Me gusta' : 'Like'}
                    </Text>
                  </Pressable>
                  <View style={styles.actionCol}>
                    <Feather name="message-circle" size={20} color={Colors.textSecondary} />
                    <Text style={styles.actionColLabel}>{t ? 'Comentar' : 'Comment'}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.actionCol, pressed && styles.pressed]}
                    onPress={handleShare}
                    hitSlop={4}
                  >
                    <Feather name="share-2" size={19} color={Colors.textSecondary} />
                    <Text style={styles.actionColLabel}>{t ? 'Compartir' : 'Share'}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.actionColIcon, pressed && styles.pressed]}
                    onPress={handleBookmark}
                    hitSlop={4}
                  >
                    <Feather
                      name="bookmark"
                      size={20}
                      color={isSaved ? Colors.accentPrimary : Colors.textSecondary}
                    />
                  </Pressable>
                </View>

                {/* ── Empty likes hint (IG) ─────── */}
                {likeCount === 0 && (
                  <Pressable onPress={toggleLike} hitSlop={6}>
                    <Text style={styles.emptyLikesHint}>
                      {t ? 'Sé el primero en dar me gusta' : 'Be the first to like'}
                    </Text>
                  </Pressable>
                )}

                {/* ── Caption for image posts (IG) ── */}
                {post.content && post.imageUrl ? (
                  <View style={styles.captionBox}>
                    <Text style={styles.caption}>
                      <Text style={styles.authorNameInline}>{authorName}</Text>{' '}
                      <Text>{post.content}</Text>
                    </Text>
                  </View>
                ) : null}

                {/* ── Comments header ─────────── */}
                <View style={styles.commentsHdrRow}>
                  <Text style={styles.commentsHdrTitle}>
                    {t ? `Comentarios (${comments.length})` : `Comments (${comments.length})`}
                  </Text>
                  {comments.length > 0 && (
                    <Pressable
                      onPress={() => setHideThreads((v) => !v)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.toggleThreadsBtn, pressed && styles.pressed]}
                    >
                      <Feather
                        name={hideThreads ? 'eye' : 'eye-off'}
                        size={13}
                        color={Colors.textSecondary}
                      />
                      <Text style={styles.toggleThreadsText}>
                        {hideThreads ? (t ? 'Mostrar hilos' : 'Show threads') : (t ? 'Ocultar hilos' : 'Hide threads')}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* ── Filter pills (inline, always visible) ─ */}
                {comments.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterPillsRow}
                  >
                    {(
                      [
                        { key: 'recent', label: t ? 'Más recientes' : 'Most recent', icon: 'clock' },
                        { key: 'likes', label: t ? 'Más likes' : 'Most liked', icon: 'heart' },
                        { key: 'interacted', label: t ? 'Más interacción' : 'Most interacted', icon: 'message-circle' },
                      ] as const
                    ).map((opt) => {
                      const active = commentSort === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          style={({ pressed }) => [
                            styles.filterPill,
                            active && styles.filterPillActive,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => setCommentSort(opt.key)}
                        >
                          <Feather
                            name={opt.icon as any}
                            size={12}
                            color={active ? Colors.textInverse : Colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.filterPillText,
                              active && styles.filterPillTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                t={t}
                meId={me?.id}
                postAuthorId={author?.id}
                commentSort={commentSort}
                hideThreads={hideThreads}
                isThreadCollapsed={!!collapsedThreads[item.id]}
                onLike={onToggleCommentLike}
                onOptions={onCommentOptions}
                onReply={startReply}
                onToggleThread={toggleThread}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Feather name="message-circle" size={30} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {t ? 'Sé el primero en comentar' : 'Be the first to comment'}
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 12 }}
          />

          {/* ── Reply banner ────────────────────── */}
          {replyTo && (
            <View style={styles.replyBanner}>
              <View style={styles.replyDotLine} />
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {t ? 'Respondiendo a ' : 'Replying to '}
                <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{replyTo.name}</Text>
              </Text>
              <Pressable
                onPress={() => setReplyTo(null)}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Feather name="x" size={16} color={Colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {/* ── Quick emoji reactions (IG) ──────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiRow}
          >
            {QUICK_EMOJI.map((e) => (
              <Pressable
                key={e}
                style={({ pressed }) => [styles.emojiChip, pressed && styles.pressed]}
                onPress={() => {
                  fb.tap();
                  setComment((prev) => prev + e);
                }}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ── Compose bar (IG) ────────────────── */}
          <View style={styles.compose}>
            {me?.profile?.avatarUrl ? (
              <Image source={{ uri: me.profile.avatarUrl }} style={styles.composeAvatar} />
            ) : (
              <View style={[styles.composeAvatar, { backgroundColor: colorFor(me?.id || 'u') }]}>
                <Text style={styles.composeAvatarText}>
                  {((me?.profile?.firstName?.[0] || '') + (me?.profile?.lastName?.[0] || '')).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <TextInput
              style={styles.composeInput}
              placeholder={
                replyTo
                  ? t
                    ? `Responder a ${replyTo.name}…`
                    : `Reply to ${replyTo.name}…`
                  : t
                    ? 'Añade un comentario…'
                    : 'Add a comment…'
              }
              placeholderTextColor={Colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                (!comment.trim() || sending) && { opacity: 0.4 },
                pressed && styles.pressed,
              ]}
              onPress={() => send()}
              disabled={!comment.trim() || sending}
              hitSlop={8}
            >
              {sending ? (
                <ActivityIndicator color={Colors.accentPrimary} size="small" />
              ) : (
                <Text style={styles.sendBtnText}>{t ? 'Publicar' : 'Post'}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
        <ReportSheet
          visible={showReport}
          onClose={() => setShowReport(false)}
          title={t ? 'Reportar post' : 'Report post'}
          onSubmit={async (reason, details) => {
            try {
              await communityApi.reportPost(id!, { reason, details });
              toast(t ? 'Gracias. Revisaremos el reporte.' : 'Thanks. We will review.', 'success');
            } catch (err) {
              toast(apiError(err, t ? 'No se pudo enviar el reporte.' : 'Report failed.'), 'danger');
            }
          }}
        />
      </SafeAreaView>

      {post?.imageUrl && (
        <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <Pressable style={styles.previewBackdrop} onPress={() => setPreviewVisible(false)}>
            <TouchableOpacity
              style={styles.previewClose}
              onPress={() => setPreviewVisible(false)}
              hitSlop={10}
              activeOpacity={0.7}
            >
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.previewContent}>
              <Pressable style={styles.previewImageHitbox} onPress={(e) => e.stopPropagation()}>
                <Image
                  source={{ uri: post.imageUrl }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

    </>
  );
}

// ─────────────────────────────────────────────
//  Comment Item — IG × FB hybrid
//  · FB bubble around name + content (author tinted)
//  · IG action row below bubble (time · like · reply)
//  · Double-tap bubble → like (with red pulse)
//  · Long-press bubble → options
//  · Replies with curved connector line (FB style)
// ─────────────────────────────────────────────
function CommentBubble({
  user,
  content,
  name,
  isAuthor,
  liked,
  likes,
  createdAt,
  onLike,
  onReply,
  onOptions,
  small,
  t,
}: {
  user: any;
  content: string;
  name: string;
  isAuthor: boolean;
  liked: boolean;
  likes: number;
  createdAt?: string;
  onLike: () => void;
  onReply: () => void;
  onOptions: () => void;
  small?: boolean;
  t: boolean;
}) {
  const [pulse, setPulse] = useState(false);
  const lastTap = useRef(0);

  function handleBubbleTap() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!liked) {
        onLike();
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  const initials =
    ((user?.profile?.firstName?.[0] || '') + (user?.profile?.lastName?.[0] || '')).toUpperCase() ||
    'U';
  const avatarSize = small ? styles.avatarSmall : styles.avatarMed;
  const avatarTextStyle = small ? styles.avatarSmallText : styles.avatarMedText;

  return (
    <View style={styles.bubbleRow}>
      {user?.profile?.avatarUrl ? (
        <Image source={{ uri: user.profile.avatarUrl }} style={avatarSize} />
      ) : (
        <View style={[avatarSize, { backgroundColor: colorFor(user?.id || '') }]}>
          <Text style={avatarTextStyle}>{initials}</Text>
        </View>
      )}

      <View style={styles.bubbleCol}>
        <Pressable
          onPress={handleBubbleTap}
          onLongPress={onOptions}
          delayLongPress={320}
          style={({ pressed }) => [
            styles.bubble,
            isAuthor && styles.bubbleAuthor,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={styles.bubbleHeader}>
            <Text style={[styles.bubbleName, isAuthor && styles.bubbleNameAuthor]} numberOfLines={1}>
              {name}
            </Text>
            {isAuthor && (
              <View style={styles.authorTag}>
                <Text style={styles.authorTagText}>{t ? 'Autor' : 'Author'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.bubbleText}>{content}</Text>

          {likes > 0 && (
            <View style={styles.bubbleLikeChip}>
              <Feather name="heart" size={9} color="#fff" />
              <Text style={styles.bubbleLikeChipText}>{likes}</Text>
            </View>
          )}

          {pulse && (
            <View pointerEvents="none" style={styles.bubblePulse}>
              <Feather name="heart" size={44} color={Colors.accentDanger} />
            </View>
          )}
        </Pressable>

        <View style={styles.commentActions}>
          <Text style={styles.commentTime}>{relTime(createdAt)}</Text>
          <Pressable
            onPress={onLike}
            hitSlop={6}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text
              style={[
                styles.commentActionLabel,
                styles.commentActionBold,
                liked && { color: Colors.accentDanger },
              ]}
            >
              {t ? 'Me gusta' : 'Like'}
            </Text>
          </Pressable>
          <Pressable onPress={onReply} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={[styles.commentActionLabel, styles.commentActionBold]}>
              {t ? 'Responder' : 'Reply'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CommentItem({
  comment,
  t,
  meId,
  postAuthorId,
  commentSort,
  hideThreads,
  isThreadCollapsed,
  onLike,
  onOptions,
  onReply,
  onToggleThread,
}: {
  comment: any;
  t: boolean;
  meId?: string;
  postAuthorId?: string;
  commentSort: CommentSort;
  hideThreads: boolean;
  isThreadCollapsed: boolean;
  onLike: (id: string) => void;
  onOptions: (c: any) => void;
  onReply: (c: any) => void;
  onToggleThread: (commentId: string) => void;
}) {
  const user = comment.user;
  const name =
    `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || 'Usuario';
  const likes = comment.likesCount ?? 0;
  const liked = !!comment.hasLiked;
  const hasReplies = (comment.replies || []).length > 0;

  function sortByDateAsc(nodes: any[]) {
    return [...(nodes || [])].sort((a, b) => {
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aDate - bDate;
    });
  }

  function renderReplyTree(nodes: any[], depth: number) {
    const ordered = sortByDateAsc(nodes);
    return ordered.map((r: any) => {
      const rUser = r.user;
      const rName =
        `${rUser?.profile?.firstName ?? ''} ${rUser?.profile?.lastName ?? ''}`.trim() || 'Usuario';
      const rLikes = r.likesCount ?? 0;
      const rLiked = !!r.hasLiked;
      const childReplies = sortByDateAsc(r.replies || []);
      const indent = Math.min((depth - 1) * 16, 32);

      return (
        <View key={r.id} style={[styles.replyWrap, { marginLeft: indent }]}>
          <View style={styles.replyConnector} />
          <View style={styles.replyBubbleContainer}>
            <CommentBubble
              user={rUser}
              content={r.content}
              name={rName}
              isAuthor={!!postAuthorId && rUser?.id === postAuthorId}
              liked={rLiked}
              likes={rLikes}
              createdAt={r.createdAt}
              onLike={() => onLike(r.id)}
              onReply={() => onReply(r)}
              onOptions={() => onOptions(r)}
              small
              t={t}
            />
          </View>
          {childReplies.length > 0 ? renderReplyTree(childReplies, depth + 1) : null}
        </View>
      );
    });
  }

  return (
    <View style={styles.commentBlock}>
      <CommentBubble
        user={user}
        content={comment.content}
        name={name}
        isAuthor={!!postAuthorId && user?.id === postAuthorId}
        liked={liked}
        likes={likes}
        createdAt={comment.createdAt}
        onLike={() => onLike(comment.id)}
        onReply={() => onReply(comment)}
        onOptions={() => onOptions(comment)}
        t={t}
      />

      {!hideThreads && hasReplies ? (
        <>
          <Pressable
            onPress={() => onToggleThread(comment.id)}
            style={({ pressed }) => [styles.threadToggle, pressed && styles.pressed]}
          >
            <View style={styles.threadLine} />
            <Text style={styles.threadToggleText}>
              {isThreadCollapsed
                ? t
                  ? `Ver respuestas (${comment.replies.length})`
                  : `Show replies (${comment.replies.length})`
                : t
                  ? 'Ocultar respuestas'
                  : 'Hide replies'}
            </Text>
          </Pressable>
          {!isThreadCollapsed ? renderReplyTree(comment.replies || [], 1) : null}
        </>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },
  notFound: { color: Colors.textSecondary },

  pressed: { opacity: 0.7 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },

  // Post header
  postHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  postUser: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '700', fontSize: 14 },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeAgo: { color: Colors.textMuted, fontSize: 11 },
  timeDot: { color: Colors.textMuted, fontSize: 11 },

  // Text-only post (FB status bubble)
  statusCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: Colors.bgElevated,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusText: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  statusTextLarge: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Image
  imgWrapper: {
    width: '100%',
    backgroundColor: Colors.bgElevated,
    position: 'relative',
  },
  img: {
    width: '100%',
    aspectRatio: 1,
  },
  likeBurst: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats strip (FB)
  statsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  statsStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 18,
  },
  likeBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsStripText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Actions bar (FB columns)
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  actionCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  actionColLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionColIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty likes hint
  emptyLikesHint: {
    color: Colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },

  // Caption
  captionBox: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  caption: {
    color: Colors.textPrimary,
    fontSize: 14.5,
    lineHeight: 21,
  },
  authorNameInline: {
    fontWeight: '700',
  },

  // Comments header
  commentsHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  commentsHdrTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleThreadsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleThreadsText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  filterPillsRow: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 6,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  filterPillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: Colors.textInverse,
    fontWeight: '700',
  },

  // Comment items (FB bubble + IG actions)
  commentBlock: { paddingVertical: 4, paddingHorizontal: 14 },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  bubbleCol: { flex: 1, minWidth: 0 },

  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderRadius: 18,
    position: 'relative',
  },
  bubbleAuthor: {
    backgroundColor: 'rgba(244,163,64,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,163,64,0.28)',
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  bubbleName: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  bubbleNameAuthor: { color: Colors.accentPrimary },
  authorTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: Colors.accentPrimary,
  },
  authorTagText: {
    color: Colors.textInverse,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bubbleText: {
    color: Colors.textPrimary,
    fontSize: 13.5,
    lineHeight: 19,
  },
  bubbleLikeChip: {
    position: 'absolute',
    right: -4,
    bottom: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: Colors.accentDanger,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  bubbleLikeChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  bubblePulse: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarMed: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMedText: { color: Colors.textInverse, fontWeight: '700', fontSize: 12 },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: { color: Colors.textInverse, fontWeight: '700', fontSize: 10 },

  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
    paddingLeft: 4,
  },
  commentTime: { color: Colors.textMuted, fontSize: 11 },
  commentActionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  commentActionBold: { fontWeight: '700', color: Colors.textSecondary },

  // Reply thread (FB connector line)
  replyWrap: {
    position: 'relative',
    paddingLeft: 22,
  },
  replyConnector: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 24,
    width: 2,
    backgroundColor: Colors.border,
    borderBottomLeftRadius: 10,
  },
  replyBubbleContainer: {
    paddingLeft: 0,
  },
  threadToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 44,
    paddingVertical: 8,
  },
  threadLine: {
    width: 22,
    height: 1.5,
    backgroundColor: Colors.border,
  },
  threadToggleText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: { color: Colors.textMuted, fontSize: 13 },

  // Reply banner
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  replyDotLine: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.accentPrimary,
  },
  replyBannerText: { color: Colors.textSecondary, fontSize: 12, flex: 1 },

  // Emoji quick reactions
  emojiRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  emojiChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },

  // Compose bar
  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  composeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeAvatarText: { color: Colors.textInverse, fontWeight: '700', fontSize: 12 },
  composeInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 110,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  sendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendBtnText: {
    color: Colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
  },

  // Preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  previewImageHitbox: { width: '100%', height: '82%' },
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
  previewImage: { width: '100%', height: '100%' },

  // Filters dropdown
  filterModalBackdrop: { flex: 1 },
  filtersModalCard: {
    position: 'absolute',
    width: 220,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 50,
  },
  filtersDropdown: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  filterOptionLast: { borderBottomWidth: 0 },
  filterOptionText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterOptionTextActive: { color: Colors.accentPrimary, fontWeight: '700' },
});
