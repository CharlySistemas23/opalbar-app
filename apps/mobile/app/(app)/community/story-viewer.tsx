import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { communityApi, messagesApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { Colors } from '@/constants/tokens';

// Use the canonical FB-style reaction set (single source of truth).
import { REACTION_EMOJIS } from '@/components/ui/ReactionPicker';
const QUICK_REACTIONS = REACTION_EMOJIS;

// ─────────────────────────────────────────────
//  Story Viewer — IG-style fullscreen
//  · Auto-advance (~5s per story)
//  · Tap right = next, tap left = previous
//  · Long-press = pause
//  · Swipe down / X = close
//  · Progress bars at top
// ─────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function relTime(d: Date) {
  const diff = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diff < 5) return 'ahora';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

interface StoryItem {
  id: string;
  mediaUrl: string;
  caption?: string | null;
  createdAt: string;
  seen?: boolean;
  viewsCount?: number;
}
interface StoryGroup {
  user: {
    id: string;
    profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
    // Venue bundles come with a flat `name` instead of a profile.
    name?: string;
  };
  stories: StoryItem[];
  hasUnseen: boolean;
  isVenue?: boolean;
}

const VENUE_AUTHOR_ID = '__venue__';

export default function StoryViewer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    userId: startUserId,
    single,
    venue,
  } = useLocalSearchParams<{ userId?: string; single?: string; venue?: string }>();
  const isSingle = single === '1';
  const isVenueMode = venue === '1';
  const { user: me } = useAuthStore();

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupIdx, setGroupIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  // Don't start the auto-advance timer until the foreground image loads —
  // otherwise users on slow networks see the bar fill while the story is
  // still a black screen.
  const [imageReady, setImageReady] = useState(false);
  // Progress 0-100 for the active bar. Simple setInterval-based to avoid
  // RN Animated edge cases with string-interpolated percent widths.
  const [progressPct, setProgressPct] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const elapsedAtPauseRef = useRef<number>(0);

  // Reply / reactions state
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [replyFocused, setReplyFocused] = useState(false);
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  }

  useEffect(() => {
    let alive = true;

    const onResolved = (g: StoryGroup[], jumpUserId?: string) => {
      if (!alive) return;
      setGroups(g);
      if (jumpUserId) {
        const found = g.findIndex((gr) => gr.user.id === jumpUserId);
        if (found >= 0) setGroupIdx(found);
      }
    };

    const request = (async () => {
      if (isSingle && startUserId) {
        const r = await communityApi.userStories(startUserId);
        const payload = r.data?.data ?? r.data ?? {};
        if (!payload.user || !payload.stories?.length) return onResolved([]);
        return onResolved([
          { user: payload.user, stories: payload.stories, hasUnseen: !!payload.hasUnseen },
        ]);
      }

      const r = await communityApi.stories();
      const payload = r.data?.data ?? r.data ?? {};
      const venueGroup: StoryGroup | null = payload.venue
        ? { ...payload.venue, isVenue: true }
        : null;
      const personal: StoryGroup[] = payload.personal ?? [];

      if (isVenueMode) return onResolved(venueGroup ? [venueGroup] : []);

      const combined = venueGroup ? [venueGroup, ...personal] : personal;
      const jumpUserId =
        startUserId ?? (venueGroup && !personal.length ? VENUE_AUTHOR_ID : undefined);
      onResolved(combined, jumpUserId);
    })();

    request.catch(() => {}).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [startUserId, isSingle, isVenueMode]);

  const currentGroup = groups[groupIdx];
  const currentStory = currentGroup?.stories[storyIdx];

  // Reset progress when story changes
  useEffect(() => {
    if (!currentStory) return;
    setProgressPct(0);
    elapsedAtPauseRef.current = 0;
    startedAtRef.current = Date.now();
    setImageReady(false);
    setReplyText('');
    setReactedEmoji(null);
    // Mark viewed in background
    if (currentStory.id && !currentStory.seen) {
      communityApi.viewStory(currentStory.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx]);

  // Pause auto-advance while the user is composing a reply
  const effectivePaused = paused || replyFocused;

  // Drive the progress bar (setInterval-based — reliable across platforms)
  useEffect(() => {
    if (!currentStory) return;
    if (!imageReady) return;
    if (effectivePaused) {
      // Preserve elapsed time so resume continues from current progress
      elapsedAtPauseRef.current = Date.now() - startedAtRef.current;
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    // Resume (or start): shift startedAt back by the time already elapsed
    startedAtRef.current = Date.now() - elapsedAtPauseRef.current;
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION) * 100);
      setProgressPct(pct);
      if (elapsed >= STORY_DURATION) {
        if (tickRef.current) clearInterval(tickRef.current);
        advance();
      }
    }, 50);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx, effectivePaused, imageReady]);

  function advance() {
    if (!currentGroup) return;
    if (storyIdx + 1 < currentGroup.stories.length) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx + 1 < groups.length) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
    } else {
      router.back();
    }
  }

  function goBack() {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(0);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!currentGroup || !currentStory) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <Text style={styles.emptyText}>No hay historias activas</Text>
        <Pressable onPress={() => router.back()} style={styles.closeFallback}>
          <Text style={styles.closeFallbackText}>Cerrar</Text>
        </Pressable>
      </View>
    );
  }

  const author = currentGroup.user;
  const isVenueGroup = currentGroup.isVenue || author.id === VENUE_AUTHOR_ID;
  const name = isVenueGroup
    ? author.name ?? 'OPAL BAR PV'
    : `${author?.profile?.firstName ?? ''} ${author?.profile?.lastName ?? ''}`.trim() || 'Usuario';
  const initials = isVenueGroup
    ? 'OB'
    : ((author?.profile?.firstName?.[0] || '') + (author?.profile?.lastName?.[0] || ''))
        .toUpperCase() || 'U';
  const isMine = !isVenueGroup && author.id === me?.id;
  const canReply = !isMine && !isVenueGroup && !!author.id;

  async function handleQuickReact(emoji: string) {
    if (!currentStory || !canReply) return;
    setReactedEmoji(emoji);
    flashToast(`Reaccionaste ${emoji}`);
    try {
      await communityApi.reactStory(currentStory.id, emoji);
    } catch {
      setReactedEmoji(null);
    }
  }

  async function handleSendReply() {
    const text = replyText.trim();
    if (!text || !canReply || !currentStory || sending) return;
    setSending(true);
    try {
      const tr = await messagesApi.createThread(author.id);
      const threadId = (tr.data?.data ?? tr.data)?.id;
      if (!threadId) throw new Error('no thread');
      // Prefix lets the recipient know which surface the message references.
      // Lightweight quote — no schema changes needed for chunk 3.
      const quoted = `↪️ Respuesta a tu historia:\n${text}`;
      await messagesApi.send(threadId, { content: quoted });
      setReplyText('');
      Keyboard.dismiss();
      flashToast('Mensaje enviado');
    } catch {
      flashToast('No se pudo enviar');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Backdrop — same image blurred/dimmed so non-9:16 photos don't leave
          black bars. IG pattern: zoom-fill + darken + foreground contain. */}
      <Image
        source={{ uri: currentStory.mediaUrl }}
        style={styles.backdrop}
        resizeMode="cover"
        blurRadius={40}
      />
      <View style={styles.backdropDim} />

      {/* Foreground — full photo, no stretch, no crop */}
      <Image
        source={{ uri: currentStory.mediaUrl }}
        style={styles.img}
        resizeMode="contain"
        onLoadEnd={() => setImageReady(true)}
        onError={() => setImageReady(true)}
      />
      {!imageReady ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      <View style={styles.vignetteTop} />
      <View style={styles.vignetteBottom} />

      {/* Tap zones */}
      <Pressable
        style={[styles.tapZone, { left: 0, width: SCREEN_W * 0.35 }]}
        onPress={goBack}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        delayLongPress={200}
      />
      <Pressable
        style={[styles.tapZone, { right: 0, width: SCREEN_W * 0.65 }]}
        onPress={advance}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        delayLongPress={200}
      />

      {/* Progress bars */}
      <View
        style={[styles.progressRow, { top: Math.max(insets.top, 12) + 6 }]}
        pointerEvents="none"
      >
        {currentGroup.stories.map((s, i) => {
          const pct = i < storyIdx ? 100 : i === storyIdx ? progressPct : 0;
          return (
            <View key={s.id} style={styles.progressBg}>
              <View style={[styles.progressFg, { width: `${pct}%` }]} />
            </View>
          );
        })}
      </View>

      {/* Top bar */}
      <View
        style={[styles.topBar, { top: Math.max(insets.top, 12) + 22 }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => {
            if (isVenueGroup) return;
            router.push(`/(app)/users/${author.id}` as never);
          }}
          style={styles.userBtn}
          hitSlop={6}
        >
          {author.profile?.avatarUrl ? (
            <Image source={{ uri: author.profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: isVenueGroup ? Colors.accentPrimary : colorFor(author.id),
                },
              ]}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.authorName}>{isMine ? 'Tu historia' : name}</Text>
          <Text style={styles.timeAgo}>{relTime(new Date(currentStory.createdAt))}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={10}>
          <Feather name="x" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Caption */}
      {currentStory.caption ? (
        <View style={styles.captionBox} pointerEvents="none">
          <Text style={styles.captionText}>{currentStory.caption}</Text>
        </View>
      ) : null}

      {/* Bottom bar — views count if mine */}
      {isMine && (
        <View style={styles.bottomBar} pointerEvents="box-none">
          <View style={styles.viewsRow}>
            <Feather name="eye" size={14} color="#fff" />
            <Text style={styles.viewsText}>{(currentStory as any).viewsCount ?? 0}</Text>
          </View>
        </View>
      )}

      {/* Reply + quick reactions — only for personal stories that aren't mine */}
      {canReply && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.replyWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
          pointerEvents="box-none"
        >
          <View style={styles.quickRow}>
            {QUICK_REACTIONS.map((emoji) => {
              const mine = reactedEmoji === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => handleQuickReact(emoji)}
                  style={({ pressed }) => [
                    styles.quickEmojiBtn,
                    mine && styles.quickEmojiBtnMine,
                    pressed && { transform: [{ scale: 1.15 }] },
                  ]}
                  hitSlop={6}
                >
                  <Text style={styles.quickEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.replyRow}>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              onFocus={() => setReplyFocused(true)}
              onBlur={() => setReplyFocused(false)}
              placeholder={`Enviar mensaje a ${name.split(' ')[0] || 'usuario'}…`}
              placeholderTextColor="rgba(255,255,255,0.55)"
              multiline
              maxLength={500}
              editable={!sending}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleSendReply}
            />
            {replyText.trim().length > 0 && (
              <Pressable
                onPress={handleSendReply}
                disabled={sending}
                style={[styles.replySendBtn, sending && { opacity: 0.5 }]}
                hitSlop={8}
              >
                <Feather name="send" size={18} color="#fff" />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {toast && (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + (canReply ? 110 : 60) }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: { color: '#fff', fontSize: 14 },
  closeFallback: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  closeFallbackText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  backdropDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  img: { width: SCREEN_W, height: SCREEN_H, position: 'absolute' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vignetteTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  vignetteBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },

  progressRow: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 5,
  },
  progressBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  progressFg: {
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOpacity: 0.7,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },

  topBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  userBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  authorName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  timeAgo: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionBox: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 80,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },

  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewsText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  replyWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
    zIndex: 10,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 6,
  },
  quickEmojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  quickEmojiBtnMine: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  quickEmoji: { fontSize: 22 },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  replyInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
    paddingVertical: 4,
  },
  replySendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentPrimary,
  },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 12,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
