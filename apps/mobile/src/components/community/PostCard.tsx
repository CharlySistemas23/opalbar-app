// ─────────────────────────────────────────────
//  PostCard — Editorial Premium community post
//
//  IG/FB hybrid keeps its information density (double-tap to like, FB-style
//  reactions, share, bookmark) but the chrome is now editorial:
//   · Avatar + serif-flavoured author + kicker timestamp
//   · Full-bleed image with sharp Radius.md corners (no shadow)
//   · Action row uses outlined glyphs, no filled pills
//   · Stats line and caption sit in pageGutter with editorial type
//   · Hairline (subtle) separates posts instead of a heavy gray divider
// ─────────────────────────────────────────────
import { useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usersApi } from '@/api/client';
import {
  Body,
  Caption,
  Kicker,
  Pressy,
} from '@/components/ui';
import { Heart } from '@/components/Heart';
import { sharePost } from '@/utils/share';
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
}

export interface CommunityPost {
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
  emojiReactions?: Array<{ emoji: string; count: number; mine: boolean }>;
  myEmoji?: string | null;
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
}

export function PostCard({
  post,
  t,
  onPress,
  onAuthorPress,
  onQuickReact,
  onOpenPicker,
  onOpenReactors,
  onOptions,
}: Props) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const lastTap = useRef<number>(0);
  const pendingOpen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const reactBtnRef = useRef<View>(null);

  // Single tap → open preview (delayed 280ms to see if second tap comes).
  // Double tap → like + burst (cancels the pending open).
  const handleImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (pendingOpen.current) {
        clearTimeout(pendingOpen.current);
        pendingOpen.current = null;
      }
      if (!post.myEmoji) {
        onQuickReact();
        setShowLikeBurst(true);
        setTimeout(() => setShowLikeBurst(false), 700);
      }
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      pendingOpen.current = setTimeout(() => {
        pendingOpen.current = null;
        setPreviewVisible(true);
      }, 280);
    }
  };

  const handleLongPressReact = () => {
    if (reactBtnRef.current) {
      reactBtnRef.current.measureInWindow((x, y, width) => {
        onOpenPicker(x + width / 2, y);
      });
    } else {
      onOpenPicker(0, 0);
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
    setIsSaved((v) => !v);
    try {
      await usersApi.toggleSave('POST', post.id);
    } catch {
      setIsSaved((v) => !v);
    }
  }

  const reactionTotal =
    post.emojiReactions?.reduce((sum, r) => sum + r.count, 0) ?? 0;

  return (
    <View style={styles.post}>
      {/* Header: avatar + name + time + ••• */}
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
            <View style={[styles.avatar, { backgroundColor: post.author.color }]}>
              <Text style={styles.avatarText} allowFontScaling={false}>
                {post.author.initials}
              </Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Body size="sm" weight="semiBold" numberOfLines={1}>
              {post.author.name}
            </Body>
            <Kicker tone="muted" style={styles.timeKicker}>
              {post.timeAgo} · {t ? 'PÚBLICO' : 'PUBLIC'}
            </Kicker>
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
          <Feather name="more-horizontal" size={18} color={Colors.textSecondary} />
        </Pressy>
      </View>

      {/* Text-only post: caption sits in pageGutter, body size */}
      {post.text && !post.imageUrl ? (
        <Pressable
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Ver publicación' : 'View post'}
          onPress={onPress}
          style={({ pressed }) => [styles.textOnlyBox, pressed && styles.pressed]}
        >
          <Body size="md" tone="primary">
            {post.text}
          </Body>
        </Pressable>
      ) : null}

      {/* Image with editorial framing */}
      {post.imageUrl ? (
        <Pressable
          accessibilityRole={Roles.imagebutton}
          accessibilityLabel={t ? 'Foto de la publicación' : 'Post photo'}
          onPress={handleImagePress}
          style={styles.imgWrapper}
        >
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.img}
            resizeMode="cover"
          />
          {showLikeBurst && (
            <View pointerEvents="none" style={styles.likeBurst}>
              <Heart filled size={96} color={Colors.textPrimary} />
            </View>
          )}
        </Pressable>
      ) : null}

      {/* Actions row */}
      <View style={styles.actionsBar}>
        <View style={styles.actionsLeft}>
          <View ref={reactBtnRef} collapsable={false}>
            <Pressy
              onPress={onQuickReact}
              onLongPress={handleLongPressReact}
              delayLongPress={220}
              accessibilityRole={Roles.button}
              accessibilityLabel={
                post.myEmoji
                  ? t
                    ? 'Quitar reacción'
                    : 'Remove reaction'
                  : t
                    ? 'Reaccionar'
                    : 'React'
              }
              accessibilityHint={
                t ? 'Mantén pulsado para elegir emoji' : 'Long-press to pick emoji'
              }
              hitSlop={HitSlop.expand}
              style={styles.actionBtn}
            >
              {post.myEmoji ? (
                <Text style={styles.reactEmoji} allowFontScaling={false}>
                  {post.myEmoji}
                </Text>
              ) : (
                <Ionicons
                  name="heart-outline"
                  size={24}
                  color={Colors.textPrimary}
                />
              )}
            </Pressy>
          </View>
          <Pressy
            onPress={onPress}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Ver comentarios' : 'View comments'}
            hitSlop={HitSlop.expand}
            haptic="select"
            style={styles.actionBtn}
          >
            <Feather
              name="message-circle"
              size={22}
              color={Colors.textPrimary}
            />
          </Pressy>
          <Pressy
            onPress={handleShare}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Compartir' : 'Share'}
            hitSlop={HitSlop.expand}
            haptic="select"
            style={styles.actionBtn}
          >
            <Feather name="share-2" size={20} color={Colors.textPrimary} />
          </Pressy>
        </View>
        <Pressy
          onPress={handleBookmark}
          accessibilityRole={Roles.button}
          accessibilityLabel={
            isSaved ? (t ? 'Quitar guardado' : 'Unsave') : t ? 'Guardar' : 'Save'
          }
          hitSlop={HitSlop.expand}
          haptic="select"
          style={styles.actionBtn}
        >
          <Feather
            name="bookmark"
            size={20}
            color={isSaved ? Colors.accentPrimary : Colors.textPrimary}
          />
        </Pressy>
      </View>

      {/* Reactions summary (FB-style stacked emoji) */}
      {(post.emojiReactions?.length ?? 0) > 0 ? (
        <Pressable
          accessibilityRole={Roles.button}
          accessibilityLabel={
            t ? `Ver ${reactionTotal} reacciones` : `View ${reactionTotal} reactions`
          }
          onPress={onOpenReactors}
          style={({ pressed }) => [styles.reactionsRow, pressed && styles.pressed]}
        >
          <View style={styles.reactionStack}>
            {post.emojiReactions!.slice(0, 3).map((r, i) => (
              <View
                key={r.emoji}
                style={[
                  styles.reactionBubble,
                  { left: i * 14, zIndex: 3 - i },
                ]}
              >
                <Text style={styles.reactionBubbleText} allowFontScaling={false}>
                  {r.emoji}
                </Text>
              </View>
            ))}
          </View>
          <Caption tone="secondary" style={styles.reactionCount}>
            {reactionTotal}
          </Caption>
        </Pressable>
      ) : (post.likes ?? 0) > 0 ? (
        <View style={styles.reactionsRow}>
          <Body size="sm" tone="primary">
            <Body size="sm" weight="semiBold" tone="primary">
              {post.likes}
            </Body>{' '}
            {post.likes === 1
              ? t
                ? 'me gusta'
                : 'like'
              : t
                ? 'me gustan'
                : 'likes'}
          </Body>
        </View>
      ) : null}

      {/* Caption (image + text) — name bold inline */}
      {post.text && post.imageUrl ? (
        <Pressable
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Ver publicación' : 'View post'}
          onPress={onPress}
          style={({ pressed }) => [styles.captionBox, pressed && styles.pressed]}
        >
          <Text
            style={[TypePresets.body, { color: Colors.textPrimary }]}
            numberOfLines={2}
          >
            <Text style={styles.authorNameInline}>{post.author.name}</Text>{' '}
            {post.text}
          </Text>
        </Pressable>
      ) : null}

      {/* View all comments */}
      {(post.comments ?? 0) > 0 ? (
        <Pressable
          accessibilityRole={Roles.button}
          accessibilityLabel={
            t
              ? `Ver los ${post.comments} comentarios`
              : `View all ${post.comments} comments`
          }
          onPress={onPress}
          style={styles.viewCommentsBox}
        >
          <Caption tone="muted">
            {t
              ? `Ver los ${post.comments} comentarios`
              : `View all ${post.comments} comments`}
          </Caption>
        </Pressable>
      ) : null}

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
              accessibilityRole="button"
              accessibilityLabel={t ? 'Cerrar' : 'Close'}
              onPress={() => setPreviewVisible(false)}
              hitSlop={HitSlop.expand}
              activeOpacity={0.7}
              style={styles.previewClose}
            >
              <Feather name="x" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Image
              source={{ uri: post.imageUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    paddingTop: Spacing[4],
    paddingBottom: Spacing[5],
  },
  pressed: { opacity: 0.7 },

  // Header
  hdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginBottom: Spacing[3],
  },
  user: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  authorInfo: { flex: 1 },
  timeKicker: {
    marginTop: 2,
    letterSpacing: 1.2,
  },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text-only
  textOnlyBox: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[2],
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

  // Actions bar
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter - Spacing[2],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[1],
  },
  actionsLeft: { flexDirection: 'row', gap: Spacing[1] },
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },

  // Reactions row
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  reactionStack: {
    flexDirection: 'row',
    height: 22,
    minWidth: 22,
  },
  reactionBubble: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bgPrimary,
  },
  reactionBubbleText: {
    fontSize: 13,
    lineHeight: 14,
  },
  reactionCount: {
    marginLeft: 28,
  },

  // Caption
  captionBox: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  authorNameInline: {
    fontFamily: 'Inter_700Bold',
    color: Colors.textPrimary,
  },
  viewCommentsBox: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },

  // Preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: Colors.bgOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewImage: { width: '100%', height: '80%' },
});
