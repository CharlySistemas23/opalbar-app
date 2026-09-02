// ─────────────────────────────────────────────
//  PostCard — Facebook-style post on Noir Absolute
//
//  Layout (top → bottom):
//   · Header: avatar · name · time + privacy chip · "…" menu
//   · Status chip for own posts (En revisión / Rechazado)
//   · Content with @mentions (MentionText), "Ver más" past 6 lines
//   · Media carousel (mediaUrls, fallback imageUrl) with page dots.
//     Double-tap on media → ❤️ + burst.
//   · Reaction summary row: stacked emojis + count · N comentarios
//   · Action bar: Me gusta / Comentar / Compartir  (+ bookmark)
//     Long-press "Me gusta" → ReactionPicker (anchored)
//
//  Presentational only: all mutations bubble up through props so the feed
//  owns optimistic state + revert.
// ─────────────────────────────────────────────
import { memo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Badge, Body, Caption, Pressy } from '@/components/ui';
import { Heart } from '@/components/Heart';
import { MentionText, type ResolvedMention } from '@/components/MentionText';
import { MediaCarousel } from '@/components/community/MediaCarousel';
import {
  Colors,
  EditorialSpacing,
  Radius,
  Spacing,
  TypePresets,
} from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';

export interface Author {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  color?: string;
  isPrivate?: boolean;
}

export type PostStatus = 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN' | 'DELETED';

export interface CommunityPost {
  id: string;
  userId?: string;
  author: Author;
  timeAgo: string;
  text?: string;
  imageUrl?: string;
  mediaUrls: string[];
  likes: number;
  comments: number;
  hasLiked: boolean;
  emojiReactions: Array<{ emoji: string; count: number; mine: boolean }>;
  myEmoji: string | null;
  isSaved: boolean;
  status: PostStatus;
  rejectionReason?: string | null;
  mentions?: ResolvedMention[];
  isMine: boolean;
}

interface Props {
  post: CommunityPost;
  t: boolean;
  onPress: () => void;
  onAuthorPress: () => void;
  onQuickReact: () => void;
  onOpenPicker: (x: number, y: number) => void;
  onOpenReactors: () => void;
  onOptions: () => void;
  onShare: () => void;
  onToggleSave: () => void;
  onMediaPress?: (index: number) => void;
}

const LIKE = '❤️';

function PostCardInner({
  post,
  t,
  onPress,
  onAuthorPress,
  onQuickReact,
  onOpenPicker,
  onOpenReactors,
  onOptions,
  onShare,
  onToggleSave,
  onMediaPress,
}: Props) {
  const lastTap = useRef<number>(0);
  const pendingOpen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [burst, setBurst] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const likeBtnRef = useRef<View>(null);

  const media = post.mediaUrls.length > 0 ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
  const hasText = !!post.text && post.text.trim().length > 0;

  // Single tap → open (delayed 260ms to detect double tap); double → ❤️.
  const handleMediaPress = (index: number) => {
    const now = Date.now();
    if (now - lastTap.current < 260) {
      if (pendingOpen.current) {
        clearTimeout(pendingOpen.current);
        pendingOpen.current = null;
      }
      lastTap.current = 0;
      if (!post.myEmoji) {
        onQuickReact();
        setBurst(true);
        setTimeout(() => setBurst(false), 700);
      }
    } else {
      lastTap.current = now;
      pendingOpen.current = setTimeout(() => {
        pendingOpen.current = null;
        if (onMediaPress) onMediaPress(index);
        else onPress();
      }, 260);
    }
  };

  const handleLongPressLike = () => {
    if (likeBtnRef.current) {
      likeBtnRef.current.measureInWindow((x, y, width) => onOpenPicker(x + width / 2, y));
    } else {
      onOpenPicker(0, 0);
    }
  };

  const reactionTotal = post.emojiReactions.reduce((s, r) => s + r.count, 0);
  const topEmojis = [...post.emojiReactions].sort((a, b) => b.count - a.count).slice(0, 3);
  const showSummary = reactionTotal > 0 || post.comments > 0;

  const likeLabel = post.myEmoji
    ? post.myEmoji === LIKE
      ? t ? 'Me gusta' : 'Like'
      : emojiName(post.myEmoji, t)
    : t ? 'Me gusta' : 'Like';

  const statusChip =
    post.isMine && post.status === 'PENDING_REVIEW' ? (
      <Badge label={t ? 'En revisión' : 'In review'} variant="warning" size="sm" outline />
    ) : post.isMine && post.status === 'REJECTED' ? (
      <Badge label={t ? 'Rechazado' : 'Rejected'} variant="danger" size="sm" outline />
    ) : null;

  return (
    <View style={styles.card}>
      {/* ── Header ─────────────────────────── */}
      <View style={styles.hdr}>
        <Pressable
          accessibilityRole={Roles.button}
          accessibilityLabel={post.author.name}
          onPress={onAuthorPress}
          style={({ pressed }) => [styles.user, pressed && styles.pressed]}
        >
          {post.author.avatarUrl ? (
            <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: post.author.color ?? Colors.bgElevated }]}>
              <Text style={styles.avatarText} allowFontScaling={false}>
                {post.author.initials ?? 'U'}
              </Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <View style={styles.nameRow}>
              <Body size="sm" weight="semiBold" numberOfLines={1} style={{ flexShrink: 1 }}>
                {post.author.name}
              </Body>
              {statusChip}
            </View>
            <View style={styles.metaRow}>
              <Caption tone="muted">{post.timeAgo}</Caption>
              <Caption tone="muted"> · </Caption>
              <Feather
                name={post.author.isPrivate ? 'lock' : 'globe'}
                size={11}
                color={Colors.textMuted}
              />
            </View>
          </View>
        </Pressable>
        <Pressy
          onPress={onOptions}
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Más opciones' : 'More options'}
          hitSlop={HitSlop.expand}
          haptic="select"
          style={styles.moreBtn}
        >
          <Feather name="more-horizontal" size={20} color={Colors.textSecondary} />
        </Pressy>
      </View>

      {/* ── Rejection reason (own, rejected) ── */}
      {post.isMine && post.status === 'REJECTED' && post.rejectionReason ? (
        <View style={styles.rejectBox}>
          <Caption tone="danger">{post.rejectionReason}</Caption>
        </View>
      ) : null}

      {/* ── Content ────────────────────────── */}
      {hasText ? (
        <Pressable
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Ver publicación' : 'View post'}
          onPress={onPress}
          style={({ pressed }) => [styles.contentBox, pressed && styles.pressed]}
        >
          <MentionText
            content={post.text!}
            mentions={post.mentions}
            style={[
              media.length === 0 && post.text!.length <= 90 ? styles.bigText : styles.text,
              !expanded && { maxHeight: undefined },
            ]}
            numberOfLines={expanded ? undefined : 6}
          />
          {!expanded && post.text!.length > 280 ? (
            <Pressable onPress={() => setExpanded(true)} hitSlop={8}>
              <Caption tone="secondary" style={{ marginTop: 4 }}>
                {t ? 'Ver más' : 'See more'}
              </Caption>
            </Pressable>
          ) : null}
        </Pressable>
      ) : null}

      {/* ── Media ──────────────────────────── */}
      {media.length > 0 ? (
        <MediaCarousel
          urls={media}
          onPress={handleMediaPress}
          accessibilityLabel={t ? 'Fotos de la publicación' : 'Post photos'}
          overlay={
            burst ? (
              <View style={styles.burst}>
                <Heart filled size={96} color={Colors.textPrimary} />
              </View>
            ) : null
          }
          style={styles.media}
        />
      ) : null}

      {/* ── Summary row ────────────────────── */}
      {showSummary ? (
        <View style={styles.summaryRow}>
          {reactionTotal > 0 ? (
            <Pressable
              accessibilityRole={Roles.button}
              accessibilityLabel={
                t ? `Ver ${reactionTotal} reacciones` : `View ${reactionTotal} reactions`
              }
              onPress={onOpenReactors}
              style={({ pressed }) => [styles.summaryLeft, pressed && styles.pressed]}
            >
              <View style={[styles.stack, { width: 16 + (topEmojis.length - 1) * 12 }]}>
                {topEmojis.map((r, i) => (
                  <View key={r.emoji} style={[styles.bubble, { left: i * 12, zIndex: 3 - i }]}>
                    <Text style={styles.bubbleText} allowFontScaling={false}>
                      {r.emoji}
                    </Text>
                  </View>
                ))}
              </View>
              <Caption tone="secondary" style={{ marginLeft: 6 }}>
                {post.myEmoji && reactionTotal === 1
                  ? t ? 'Tú' : 'You'
                  : post.myEmoji && reactionTotal > 1
                    ? t
                      ? `Tú y ${reactionTotal - 1} más`
                      : `You and ${reactionTotal - 1} more`
                    : String(reactionTotal)}
              </Caption>
            </Pressable>
          ) : (
            <View />
          )}
          {post.comments > 0 ? (
            <Pressable
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Ver comentarios' : 'View comments'}
              onPress={onPress}
              hitSlop={6}
            >
              <Caption tone="secondary">
                {post.comments}{' '}
                {post.comments === 1
                  ? t ? 'comentario' : 'comment'
                  : t ? 'comentarios' : 'comments'}
              </Caption>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── Action bar ─────────────────────── */}
      <View style={styles.actions}>
        <View ref={likeBtnRef} collapsable={false} style={styles.actionSlot}>
          <Pressy
            onPress={onQuickReact}
            onLongPress={handleLongPressLike}
            delayLongPress={220}
            accessibilityRole={Roles.button}
            accessibilityLabel={
              post.myEmoji ? (t ? 'Quitar reacción' : 'Remove reaction') : t ? 'Me gusta' : 'Like'
            }
            accessibilityHint={t ? 'Mantén pulsado para elegir emoji' : 'Long-press to pick emoji'}
            hitSlop={HitSlop.expand}
            style={styles.actionBtn}
          >
            {post.myEmoji && post.myEmoji !== LIKE ? (
              <Text style={styles.actionEmoji} allowFontScaling={false}>
                {post.myEmoji}
              </Text>
            ) : (
              <Heart filled={!!post.myEmoji} size={20} color={post.myEmoji ? Colors.accentDanger : Colors.textSecondary} />
            )}
            <Text
              style={[styles.actionLbl, post.myEmoji && styles.actionLblActive]}
              numberOfLines={1}
            >
              {likeLabel}
            </Text>
          </Pressy>
        </View>
        <View style={styles.actionSlot}>
          <Pressy
            onPress={onPress}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Comentar' : 'Comment'}
            hitSlop={HitSlop.expand}
            haptic="select"
            style={styles.actionBtn}
          >
            <Feather name="message-circle" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionLbl}>{t ? 'Comentar' : 'Comment'}</Text>
          </Pressy>
        </View>
        <View style={styles.actionSlot}>
          <Pressy
            onPress={onShare}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Compartir' : 'Share'}
            hitSlop={HitSlop.expand}
            haptic="select"
            style={styles.actionBtn}
          >
            <Feather name="share-2" size={19} color={Colors.textSecondary} />
            <Text style={styles.actionLbl}>{t ? 'Compartir' : 'Share'}</Text>
          </Pressy>
        </View>
        <Pressy
          onPress={onToggleSave}
          accessibilityRole={Roles.button}
          accessibilityLabel={
            post.isSaved ? (t ? 'Quitar de guardados' : 'Unsave') : t ? 'Guardar' : 'Save'
          }
          hitSlop={HitSlop.expand}
          haptic="select"
          style={styles.saveBtn}
        >
          <Feather
            name="bookmark"
            size={19}
            color={post.isSaved ? Colors.accentPrimary : Colors.textSecondary}
          />
        </Pressy>
      </View>
    </View>
  );
}

export const PostCard = memo(PostCardInner);

// Short ES/EN names for the picker emojis when shown as the active label.
function emojiName(emoji: string, t: boolean): string {
  const map: Record<string, [string, string]> = {
    '❤️': ['Me encanta', 'Love'],
    '😂': ['Jaja', 'Haha'],
    '😮': ['Wow', 'Wow'],
    '😢': ['Triste', 'Sad'],
    '😡': ['Enojado', 'Angry'],
    '👍': ['Me gusta', 'Like'],
    '🔥': ['Fuego', 'Fire'],
    '🥂': ['Salud', 'Cheers'],
  };
  const hit = map[emoji];
  return hit ? (t ? hit[0] : hit[1]) : emoji;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[2],
  },
  pressed: { opacity: 0.7 },

  hdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginBottom: Spacing[3],
  },
  user: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontSize: 14, fontWeight: '700' },
  authorInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  moreBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  rejectBox: {
    marginHorizontal: EditorialSpacing.pageGutter,
    marginBottom: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(196,104,104,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accentDanger,
  },

  contentBox: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[3],
  },
  text: { ...TypePresets.body, color: Colors.textPrimary },
  bigText: { ...TypePresets.bodyLg, color: Colors.textPrimary, lineHeight: 26 },

  media: { alignSelf: 'stretch' },
  burst: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[3],
    paddingBottom: Spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    marginHorizontal: 0,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center' },
  stack: { height: 18, position: 'relative' },
  bubble: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bgCard,
  },
  bubbleText: { fontSize: 11, lineHeight: 13 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingTop: Spacing[1],
  },
  actionSlot: { flex: 1 },
  actionBtn: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.sm,
  },
  actionLbl: {
    ...TypePresets.bodySm,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  actionLblActive: { color: Colors.accentDanger },
  actionEmoji: { fontSize: 18, lineHeight: 22 },
  saveBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
});
