// ─────────────────────────────────────────────
//  MessageBubble — Editorial Premium message row
//
//  Variants (driven by props):
//   · text       — bgCard for them, accentPrimary for me. Radius.md.
//   · image      — image thumbnail with optional caption beneath.
//   · sticker    — large glyph, no bubble bg.
//   · voice      — uses VoiceBubble.
//
//  Slots: avatar (only on last-in-group for "them"), reply quote, meta
//  (time + read-tick), reaction chips, failed banner.
//
//  Accessibility: each row is one accessibility element with a synthesized
//  label so a screen reader announces author + content + time + status.
// ─────────────────────────────────────────────
import { memo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing, Typography } from '@/constants/tokens';
import { Body, Caption } from '@/components/ui';
import { VoiceBubble } from './VoiceBubble';

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#6FB892', '#E06868', '#EC4899'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function fmtTime(d: Date, lang: string) {
  return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

export interface ReactionAggregate {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface MessageBubbleProps {
  message: any;
  isMe: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  at: Date;
  showMeta: boolean;
  showReadTick: boolean;
  isRead: boolean;
  reactions: ReactionAggregate[];
  /** Other-user info — only used when not isMe and last-in-group. */
  other?: { id?: string; avatarUrl?: string; initials?: string };
  threadId: string;
  language: string;
  t: boolean;
  selfId?: string;
  selfName?: string;
  authorName?: string;
  onTap: (msg: any) => void;
  onLongPress: (msg: any) => void;
  onImagePress: (url: string) => void;
  onReact: (msg: any, emoji: string) => void;
  onRetry: (msg: any) => void;
  onDiscard: (msg: any) => void;
}

function MessageBubbleImpl({
  message: m,
  isMe,
  isFirstInGroup,
  isLastInGroup,
  at,
  showMeta,
  showReadTick,
  isRead,
  reactions,
  other,
  threadId,
  language,
  t,
  selfId,
  selfName,
  authorName,
  onTap,
  onLongPress,
  onImagePress,
  onReact,
  onRetry,
  onDiscard,
}: MessageBubbleProps) {
  const isSticker = !!m.stickerKey;
  const isImage = !!m.imageUrl && !isSticker;
  const isVoice = !!m.audioUrl && !isImage && !isSticker;
  const isFailed = m._status === 'failed';
  const isPending = m._status === 'sending';

  const bubbleShape = {
    borderTopLeftRadius: !isMe && !isFirstInGroup ? Radius.sm : Radius.md,
    borderTopRightRadius: isMe && !isFirstInGroup ? Radius.sm : Radius.md,
    borderBottomLeftRadius: !isMe && !isLastInGroup ? Radius.sm : isMe ? Radius.md : 4,
    borderBottomRightRadius: isMe && !isLastInGroup ? Radius.sm : isMe ? 4 : Radius.md,
  };

  // Synthesize a single accessibility label per bubble.
  const a11yAuthor = isMe ? (t ? 'Tú' : 'You') : authorName ?? (t ? 'Contacto' : 'Contact');
  const a11yBody = isSticker
    ? `${t ? 'Sticker' : 'Sticker'} ${m.stickerKey}`
    : isImage
      ? (m.content ? `${t ? 'Foto' : 'Photo'}: ${m.content}` : (t ? 'Foto' : 'Photo'))
      : isVoice
        ? `${t ? 'Nota de voz' : 'Voice note'}`
        : (m.content ?? '');
  const a11yTime = at ? fmtTime(at, language) : '';
  const a11yLabel = `${a11yAuthor}: ${a11yBody}. ${a11yTime}`;

  return (
    <View
      style={[
        styles.row,
        isMe ? styles.rowMe : styles.rowThem,
        { marginTop: isFirstInGroup ? 10 : 2 },
      ]}
      accessible
      accessibilityLabel={a11yLabel}
      accessibilityHint={t ? 'Mantén pulsado para más opciones' : 'Long-press for more options'}
    >
      {!isMe && (isLastInGroup ? (
        other?.avatarUrl ? (
          <Image source={{ uri: other.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colorFor(other?.id || threadId) }]}>
            <Body size="sm" tone="inverse" weight="bold" style={styles.avatarText}>
              {other?.initials ?? 'U'}
            </Body>
          </View>
        )
      ) : (
        <View style={styles.avatarSpacer} />
      ))}

      <View style={{ maxWidth: '78%' }}>
        {isSticker ? (
          <Pressable
            onPress={() => onTap(m)}
            onLongPress={() => onLongPress(m)}
            delayLongPress={280}
            style={[styles.stickerWrap, isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}
          >
            {m.replyTo && (
              <ReplyQuote
                quote={m.replyTo}
                isMe={isMe}
                t={t}
                selfId={selfId}
                selfName={selfName}
                authorName={authorName}
              />
            )}
            <View style={styles.stickerGlyph}>
              <Body size="lg" style={{ fontSize: 78, lineHeight: 92 }}>{m.stickerKey}</Body>
            </View>
            {showMeta && (
              <MetaRow
                at={at}
                language={language}
                isMe={isMe}
                isPending={isPending}
                showReadTick={showReadTick}
                isRead={isRead}
                onImage={false}
                onSticker
              />
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => onTap(m)}
            onLongPress={() => onLongPress(m)}
            delayLongPress={280}
            style={[
              styles.bubble,
              isImage ? styles.bubbleImage : isMe ? styles.bubbleMe : styles.bubbleThem,
              bubbleShape,
              isPending && { opacity: 0.7 },
            ]}
          >
            {m.replyTo && (
              <ReplyQuote
                quote={m.replyTo}
                isMe={isMe}
                t={t}
                selfId={selfId}
                selfName={selfName}
                authorName={authorName}
              />
            )}
            {isImage ? (
              <Pressable onPress={() => onImagePress(m.imageUrl)} onLongPress={() => onLongPress(m)}>
                <Image
                  source={{ uri: m.imageUrl }}
                  style={styles.imageThumb}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                {!!m.content && (
                  <Body style={styles.imageCaption} tone={isMe ? 'inverse' : 'primary'}>
                    {m.content}
                  </Body>
                )}
              </Pressable>
            ) : isVoice ? (
              <VoiceBubble url={m.audioUrl} durationSec={m.audioDurationSec} isMe={isMe} />
            ) : (
              <Body tone={isMe ? 'inverse' : 'primary'} style={styles.bubbleText}>
                {m.content}
              </Body>
            )}
            {showMeta && (
              <MetaRow
                at={at}
                language={language}
                isMe={isMe}
                isPending={isPending}
                showReadTick={showReadTick}
                isRead={isRead}
                onImage={isImage}
              />
            )}
          </Pressable>
        )}

        {isFailed && (
          <View style={[styles.failedRow, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
            <Feather name="alert-circle" size={12} color={Colors.accentDanger} />
            <Caption size="sm" tone="danger" style={styles.failedText}>
              {t ? 'No se envió' : 'Not sent'}
            </Caption>
            <Pressable onPress={() => onRetry(m)} hitSlop={6}>
              <Caption size="sm" tone="accent" style={styles.failedAction}>
                {t ? 'Reintentar' : 'Retry'}
              </Caption>
            </Pressable>
            <Pressable onPress={() => onDiscard(m)} hitSlop={6}>
              <Caption size="sm" tone="muted" style={styles.failedAction}>
                {t ? 'Descartar' : 'Discard'}
              </Caption>
            </Pressable>
          </View>
        )}

        {reactions.length > 0 && (
          <View style={[styles.reactionRow, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
            {reactions.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => onReact(m, r.emoji)}
                accessibilityRole="button"
                accessibilityLabel={`${r.emoji} ${r.count}`}
                accessibilityState={{ selected: r.mine }}
                style={[styles.reactionChip, r.mine && styles.reactionChipMine]}
              >
                <Body size="sm" style={styles.reactionEmoji}>{r.emoji}</Body>
                {r.count > 1 && (
                  <Caption size="sm" tone="primary" style={styles.reactionCount}>
                    {r.count}
                  </Caption>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ReplyQuote({
  quote: q,
  isMe,
  t,
  selfId,
  authorName,
}: {
  quote: any;
  isMe: boolean;
  t: boolean;
  selfId?: string;
  selfName?: string;
  authorName?: string;
}) {
  if (!q) return null;
  const isMyQuote = !!selfId && q.senderId === selfId;
  const author = isMyQuote ? (t ? 'Tú' : 'You') : (authorName ?? (t ? 'Contacto' : 'Contact'));
  const preview = q.content
    ? q.content.slice(0, 80)
    : q.imageUrl
      ? (t ? 'Foto' : 'Photo')
      : q.audioUrl
        ? (t ? 'Nota de voz' : 'Voice note')
        : q.stickerKey
          ? 'Sticker'
          : '…';
  return (
    <View style={[styles.replyQuote, isMe ? styles.replyQuoteMe : styles.replyQuoteThem]}>
      <View style={[styles.replyBar, { backgroundColor: isMe ? 'rgba(15,13,12,0.55)' : Colors.accentPrimary }]} />
      <View style={{ flex: 1 }}>
        <Caption
          size="sm"
          style={[styles.replyAuthor, { color: isMe ? 'rgba(15,13,12,0.85)' : Colors.accentPrimary }]}
          numberOfLines={1}
        >
          {author}
        </Caption>
        <Caption
          size="sm"
          style={{ color: isMe ? 'rgba(15,13,12,0.75)' : Colors.textSecondary }}
          numberOfLines={1}
        >
          {preview}
        </Caption>
      </View>
      {q.imageUrl ? (
        <Image source={{ uri: q.imageUrl }} style={styles.replyQuoteThumb} />
      ) : q.stickerKey ? (
        <View style={styles.replyQuoteSticker}>
          <Body size="lg" style={{ fontSize: 22 }}>{q.stickerKey}</Body>
        </View>
      ) : q.audioUrl ? (
        <View
          style={[
            styles.replyQuoteSticker,
            { backgroundColor: isMe ? 'rgba(15,13,12,0.18)' : Colors.bgElevated },
          ]}
        >
          <Feather
            name="mic"
            size={14}
            color={isMe ? 'rgba(15,13,12,0.85)' : Colors.accentPrimary}
          />
        </View>
      ) : null}
    </View>
  );
}

function MetaRow({
  at,
  language,
  isMe,
  isPending,
  showReadTick,
  isRead,
  onImage,
  onSticker,
}: {
  at: Date;
  language: string;
  isMe: boolean;
  isPending: boolean;
  showReadTick: boolean;
  isRead: boolean;
  onImage: boolean;
  onSticker?: boolean;
}) {
  const timeColor = onImage
    ? '#fff'
    : isMe
      ? 'rgba(15,13,12,0.65)'
      : Colors.textMuted;
  const tickColor = onImage
    ? '#fff'
    : isMe
      ? isRead ? 'rgba(15,13,12,0.85)' : 'rgba(15,13,12,0.45)'
      : isRead ? Colors.accentPrimary : Colors.textMuted;
  return (
    <View style={[styles.metaRow, onImage && styles.metaRowOnImage, onSticker && { marginTop: 2 }]}>
      <Caption
        size="sm"
        style={{ color: timeColor, fontFamily: Typography.fontFamily.sansMedium, fontSize: 10, letterSpacing: 0.2 }}
      >
        {at ? fmtTime(at, language) : ''}
      </Caption>
      {isPending && (
        <Feather
          name="clock"
          size={10}
          color={timeColor}
          style={{ marginLeft: 4 }}
        />
      )}
      {showReadTick && !isPending && (
        <Feather
          name={isRead ? 'check-circle' : 'check'}
          size={11}
          color={tickColor}
          style={{ marginLeft: 4 }}
        />
      )}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    gap: 6,
  },
  rowMe: { justifyContent: 'flex-end' },
  rowThem: { justifyContent: 'flex-start' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  avatarSpacer: { width: 26, marginBottom: 2 },
  avatarText: { fontSize: 10 },

  bubble: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[3] },
  bubbleMe: { backgroundColor: Colors.accentPrimary },
  bubbleThem: {
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  bubbleImage: { backgroundColor: Colors.bgCard, padding: 3, overflow: 'hidden' },
  bubbleText: {
    fontSize: Typography.fontSize.base,
  },

  imageThumb: {
    width: 240,
    height: 240,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
  },
  imageCaption: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  metaRowOnImage: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Reply quote
  replyQuote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 6,
    paddingLeft: 8,
    borderRadius: Radius.sm,
    gap: 8,
    marginBottom: 8,
    minHeight: 36,
  },
  replyQuoteMe: { backgroundColor: 'rgba(15,13,12,0.10)' },
  replyQuoteThem: { backgroundColor: Colors.bgElevated },
  replyBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  replyAuthor: {
    letterSpacing: 0.2,
    fontFamily: Typography.fontFamily.sansBold,
    marginBottom: 2,
  },
  replyQuoteThumb: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
  },
  replyQuoteSticker: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
  },

  // Sticker
  stickerWrap: { paddingVertical: 4 },
  stickerGlyph: {},

  // Failed
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  failedText: { fontSize: 11 },
  failedAction: { fontSize: 11, marginLeft: 4, fontFamily: Typography.fontFamily.sansBold },

  // Reaction chips
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginHorizontal: 4,
    gap: 5,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  reactionChipMine: {
    backgroundColor: Colors.accentPrimary + '2A',
    borderColor: Colors.accentPrimary,
  },
  reactionEmoji: { fontSize: 14, lineHeight: 16 },
  reactionCount: {
    fontSize: 11,
    letterSpacing: 0.2,
    fontFamily: Typography.fontFamily.sansBold,
  },
});
