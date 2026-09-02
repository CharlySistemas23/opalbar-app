// ─────────────────────────────────────────────
//  PostModerationCard — compact FB-style moderation card
//
//  Used by the admin community feed and the post detail. Mirrors the
//  public <PostCard> silhouette (avatar · name · time · text · media
//  thumbs · counters) but adds the moderation layer: email, status pill,
//  report count and the action bar (Verificar / Ocultar / Rechazar /
//  Fijar / Eliminar / Ver reportes).
//
//  Posts publish immediately; "Verificar" flips a PENDING_REVIEW/HIDDEN/
//  REJECTED post to PUBLISHED. Actions the current status makes
//  pointless are hidden instead of disabled (no dead buttons).
// ─────────────────────────────────────────────
import { memo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Caption, Subhead } from '@/components/ui';
import { StatusPill } from './StatusPill';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

export type AdminPostStatus = 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN' | 'DELETED';

export interface AdminPost {
  id: string;
  content?: string | null;
  imageUrl?: string | null;
  mediaUrls?: string[];
  status: AdminPostStatus;
  isPinned?: boolean;
  surface?: 'community' | 'wall';
  createdAt: string;
  rejectionReason?: string | null;
  likesCount?: number;
  commentsCount?: number;
  reportsCount?: number;
  moderationScore?: number | null;
  user?: {
    id: string;
    email?: string | null;
    role?: string;
    profile?: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null;
  } | null;
  _count?: { comments?: number; reports?: number; emojiReactions?: number };
}

export const POST_STATUS_META: Record<
  AdminPostStatus,
  { label: string; tone: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info' }
> = {
  PUBLISHED: { label: 'Publicado', tone: 'success' },
  PENDING_REVIEW: { label: 'Pendiente', tone: 'warning' },
  HIDDEN: { label: 'Oculto', tone: 'neutral' },
  REJECTED: { label: 'Rechazado', tone: 'danger' },
  DELETED: { label: 'Eliminado', tone: 'danger' },
};

export function postAuthorName(post: AdminPost) {
  const p = post.user?.profile;
  return `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || 'Usuario';
}

export function postMedia(post: AdminPost): string[] {
  const list = Array.isArray(post.mediaUrls) ? post.mediaUrls.filter((u) => u && u !== '__WALL__') : [];
  if (post.imageUrl && !list.includes(post.imageUrl)) list.unshift(post.imageUrl);
  return list;
}

export function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`;
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export interface PostModerationActions {
  onVerify?: (post: AdminPost) => void;
  onHide?: (post: AdminPost) => void;
  onReject?: (post: AdminPost) => void;
  onTogglePin?: (post: AdminPost) => void;
  onDelete?: (post: AdminPost) => void;
  onViewReports?: (post: AdminPost) => void;
}

interface Props extends PostModerationActions {
  post: AdminPost;
  onPress?: (post: AdminPost) => void;
  onLongPress?: (post: AdminPost) => void;
  /** Card is part of a multi-select session */
  selectable?: boolean;
  selected?: boolean;
  /** Hide the action bar (detail screen renders its own) */
  hideActions?: boolean;
  /** Full text + larger media (detail screen) */
  expanded?: boolean;
  busy?: boolean;
}

function PostModerationCardInner({
  post,
  onPress,
  onLongPress,
  selectable,
  selected,
  hideActions,
  expanded,
  busy,
  onVerify,
  onHide,
  onReject,
  onTogglePin,
  onDelete,
  onViewReports,
}: Props) {
  const name = postAuthorName(post);
  const avatar = post.user?.profile?.avatarUrl;
  const media = postMedia(post);
  const meta = POST_STATUS_META[post.status] ?? POST_STATUS_META.PUBLISHED;
  const likes = post.likesCount ?? post._count?.emojiReactions ?? 0;
  const comments = post.commentsCount ?? post._count?.comments ?? 0;
  const reports = post.reportsCount ?? post._count?.reports ?? 0;
  const isDeleted = post.status === 'DELETED';

  const showVerify = !isDeleted && post.status !== 'PUBLISHED' && !!onVerify;
  const showHide = post.status === 'PUBLISHED' && !!onHide;
  const showReject = !isDeleted && post.status !== 'REJECTED' && !!onReject;
  const showPin = post.status === 'PUBLISHED' && !!onTogglePin;
  const showDelete = !isDeleted && !!onDelete;
  const showReports = reports > 0 && !!onViewReports;
  const hasActions =
    !hideActions && (showVerify || showHide || showReject || showPin || showDelete || showReports);

  return (
    <View style={[styles.card, selected && styles.cardSelected, isDeleted && styles.cardMuted]}>
      <Pressable
        onPress={onPress ? () => onPress(post) : undefined}
        onLongPress={onLongPress ? () => onLongPress(post) : undefined}
        delayLongPress={250}
        disabled={!onPress && !onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`Post de ${name}, ${meta.label}`}
        style={{ gap: Spacing[2] }}
      >
        <View style={styles.head}>
          {selectable ? (
            <View style={[styles.checkbox, selected && styles.checkboxOn]}>
              {selected ? <Feather name="check" size={14} color={Colors.textInverse} /> : null}
            </View>
          ) : null}
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Body tone="inverse" weight="bold">
                {name[0]?.toUpperCase() ?? '?'}
              </Body>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Subhead numberOfLines={1} style={{ flexShrink: 1 }}>
                {name}
              </Subhead>
              {post.isPinned ? (
                <Feather name="bookmark" size={12} color={Colors.accentPrimary} />
              ) : null}
              {post.surface === 'wall' ? (
                <StatusPill label="Muro" tone="info" />
              ) : null}
            </View>
            <Caption tone="muted" numberOfLines={1} style={{ marginTop: 1 }}>
              {post.user?.email ? `${post.user.email} · ` : ''}
              {relTime(post.createdAt)}
            </Caption>
          </View>
          <StatusPill label={meta.label} tone={meta.tone} />
        </View>

        {post.content ? (
          <Body size={expanded ? 'md' : 'sm'} numberOfLines={expanded ? undefined : 4}>
            {post.content}
          </Body>
        ) : null}

        {media.length > 0 ? (
          expanded ? (
            <View style={{ gap: Spacing[2] }}>
              {media.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.imageFull} resizeMode="cover" />
              ))}
            </View>
          ) : (
            <View style={styles.thumbs}>
              {media.slice(0, 4).map((uri, i) => (
                <View key={uri + i} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                  {i === 3 && media.length > 4 ? (
                    <View style={styles.thumbMore}>
                      <Caption tone="primary" style={{ fontWeight: '700' }}>
                        +{media.length - 4}
                      </Caption>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )
        ) : null}

        {post.status === 'REJECTED' && post.rejectionReason ? (
          <View style={styles.reasonBox}>
            <Feather name="info" size={12} color={Colors.accentDanger} />
            <Caption style={{ color: Colors.accentDanger, flex: 1 }} numberOfLines={2}>
              {post.rejectionReason}
            </Caption>
          </View>
        ) : null}

        <View style={styles.counters}>
          <Counter icon="heart" value={likes} />
          <Counter icon="message-circle" value={comments} />
          <Counter icon="flag" value={reports} danger={reports > 0} />
          {typeof post.moderationScore === 'number' ? (
            <Counter
              icon="shield"
              value={post.moderationScore.toFixed(2)}
              danger={post.moderationScore > 0.5}
            />
          ) : null}
        </View>
      </Pressable>

      {hasActions ? (
        <View style={styles.actions}>
          {showVerify ? (
            <ActionChip icon="check-circle" label="Verificar" tone="success" disabled={busy} onPress={() => onVerify!(post)} />
          ) : null}
          {showHide ? (
            <ActionChip icon="eye-off" label="Ocultar" disabled={busy} onPress={() => onHide!(post)} />
          ) : null}
          {showReject ? (
            <ActionChip icon="x-circle" label="Rechazar" tone="danger" disabled={busy} onPress={() => onReject!(post)} />
          ) : null}
          {showPin ? (
            <ActionChip
              icon="bookmark"
              label={post.isPinned ? 'Desfijar' : 'Fijar'}
              tone={post.isPinned ? 'accent' : undefined}
              disabled={busy}
              onPress={() => onTogglePin!(post)}
            />
          ) : null}
          {showReports ? (
            <ActionChip icon="flag" label={`Reportes (${reports})`} tone="danger" disabled={busy} onPress={() => onViewReports!(post)} />
          ) : null}
          {showDelete ? (
            <ActionChip icon="trash-2" label="Eliminar" tone="danger" disabled={busy} onPress={() => onDelete!(post)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const PostModerationCard = memo(PostModerationCardInner);

function Counter({ icon, value, danger }: { icon: FeatherIcon; value: number | string; danger?: boolean }) {
  const color = danger ? Colors.accentDanger : Colors.textMuted;
  return (
    <View style={styles.counter}>
      <Feather name={icon} size={12} color={color} />
      <Caption size="sm" style={{ color }}>
        {value}
      </Caption>
    </View>
  );
}

function ActionChip({
  icon,
  label,
  tone,
  disabled,
  onPress,
}: {
  icon: FeatherIcon;
  label: string;
  tone?: 'success' | 'danger' | 'accent';
  disabled?: boolean;
  onPress: () => void;
}) {
  const color =
    tone === 'success'
      ? Colors.accentSuccess
      : tone === 'danger'
        ? Colors.accentDanger
        : tone === 'accent'
          ? Colors.accentPrimary
          : Colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: color + '40' },
        pressed && { opacity: 0.6 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Feather name={icon} size={13} color={color} />
      <Caption size="sm" style={{ color, fontWeight: '600' }}>
        {label}
      </Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing[3],
  },
  cardSelected: {
    borderColor: Colors.accentPrimary,
    backgroundColor: 'rgba(201,169,97,0.06)',
  },
  cardMuted: { opacity: 0.6 },
  head: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  checkboxOn: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.bgElevated },
  avatarFallback: { backgroundColor: Colors.accentPrimary, alignItems: 'center', justifyContent: 'center' },
  thumbs: { flexDirection: 'row', gap: 6 },
  thumbWrap: { flex: 1, aspectRatio: 1, maxWidth: 96, borderRadius: Radius.lg, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%', backgroundColor: Colors.bgElevated },
  thumbMore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,7,6,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFull: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, backgroundColor: Colors.bgElevated },
  reasonBox: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(196,104,104,0.10)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[2],
    paddingVertical: 6,
  },
  counters: { flexDirection: 'row', gap: Spacing[3], alignItems: 'center' },
  counter: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: Colors.bgElevated,
  },
});
