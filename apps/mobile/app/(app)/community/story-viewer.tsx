// ─────────────────────────────────────────────
//  Story Viewer — Editorial Premium
//
//  Story logic preserved verbatim. Overlay redesigned:
//   · Top progress bars are hairline-thin (height 2)
//   · Top author bar uses Kicker + Body for editorial labels
//   · Caption sits in a soft glass card with editorial spacing
//   · Reply dock + quick reactions retain functionality with hairline chrome
//   · Owner-only: "…" menu (delete) + tappable views badge (viewers sheet)
// ─────────────────────────────────────────────
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { communityApi, messagesApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { ConfirmDialog, ListItem, Pressy, Sheet } from '@/components/ui';
import { toast as showToast } from '@/components/Toast';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { REACTION_EMOJIS } from '@/components/ui/ReactionPicker';

const QUICK_REACTIONS = REACTION_EMOJIS;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STORY_DURATION = 5000;

function relTime(d: Date, t: boolean) {
  const diff = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diff < 5) return t ? 'ahora' : 'now';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

interface StoryItem {
  id: string;
  mediaUrl: string;
  caption?: string | null;
  createdAt: string;
  expiresAt: string;
  seen?: boolean;
  viewsCount?: number;
  myReactions?: string[];
}
interface StoryGroup {
  user: {
    id: string;
    profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
    name?: string;
  };
  stories: StoryItem[];
  hasUnseen: boolean;
  isVenue?: boolean;
}
interface StoryViewer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  viewedAt: string;
  reactions: string[];
}

const VENUE_AUTHOR_ID = '__venue__';

function isActiveStory(s: StoryItem) {
  return new Date(s.expiresAt).getTime() > Date.now();
}

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
  const { language } = useAppStore();
  const t = language === 'es';

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupIdx, setGroupIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const elapsedAtPauseRef = useRef<number>(0);

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [reactedEmojis, setReactedEmojis] = useState<string[]>([]);
  const [innerToast, setInnerToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Owner "…" menu → delete
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Owner viewers sheet
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersError, setViewersError] = useState<string | null>(null);

  function flashToast(msg: string) {
    setInnerToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setInnerToast(null), 1800);
  }

  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const onResolved = (g: StoryGroup[], jumpUserId?: string) => {
        if (reqIdRef.current !== id) return;
        const filtered = g
          .map((gr) => ({ ...gr, stories: gr.stories.filter(isActiveStory) }))
          .filter((gr) => gr.stories.length > 0);
        setGroups(filtered);
        setGroupIdx(0);
        setStoryIdx(0);
        if (jumpUserId) {
          const found = filtered.findIndex((gr) => gr.user.id === jumpUserId);
          if (found >= 0) setGroupIdx(found);
        }
      };

      if (isSingle && startUserId) {
        const r = await communityApi.userStories(startUserId);
        const payload = r.data?.data ?? r.data ?? {};
        if (!payload.user || !payload.stories?.length) {
          onResolved([]);
          return;
        }
        onResolved([
          { user: payload.user, stories: payload.stories, hasUnseen: !!payload.hasUnseen },
        ]);
        return;
      }

      // Combined reel: needs the 'following' scope or personal stories are
      // always empty (backend default is venue-only), which used to make
      // "next user" navigation silently dead-end after the first group.
      const r = await communityApi.stories('following');
      const payload = r.data?.data ?? r.data ?? {};
      const venueGroup: StoryGroup | null = payload.venue
        ? { ...payload.venue, isVenue: true }
        : null;
      const personal: StoryGroup[] = payload.personal ?? [];

      if (isVenueMode) {
        onResolved(venueGroup ? [venueGroup] : []);
        return;
      }

      const combined = venueGroup ? [venueGroup, ...personal] : personal;
      const jumpUserId =
        startUserId ?? (venueGroup && !personal.length ? VENUE_AUTHOR_ID : undefined);
      onResolved(combined, jumpUserId);
    } catch (err) {
      if (reqIdRef.current === id) setError(apiError(err));
    } finally {
      if (reqIdRef.current === id) setLoading(false);
    }
  }, [startUserId, isSingle, isVenueMode]);

  useEffect(() => {
    load();
  }, [load]);

  const currentGroup = groups[groupIdx];
  const currentStory = currentGroup?.stories[storyIdx];

  useEffect(() => {
    if (!currentStory) return;
    setProgressPct(0);
    elapsedAtPauseRef.current = 0;
    startedAtRef.current = Date.now();
    setImageReady(false);
    setReplyText('');
    setReactedEmojis(Array.isArray(currentStory.myReactions) ? currentStory.myReactions : []);
    if (currentStory.id && !currentStory.seen) {
      communityApi.viewStory(currentStory.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx]);

  const effectivePaused =
    paused || replyFocused || menuOpen || confirmDeleteOpen || viewersOpen;

  useEffect(() => {
    if (!currentStory) return;
    if (!imageReady) return;
    if (effectivePaused) {
      elapsedAtPauseRef.current = Date.now() - startedAtRef.current;
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
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

  if (error) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={load}
        />
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Cerrar' : 'Close'}
          style={styles.closeFallback}
        >
          <Text style={styles.closeFallbackText}>{t ? 'Cerrar' : 'Close'}</Text>
        </Pressy>
      </View>
    );
  }

  if (!currentGroup || !currentStory) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <EmptyState
          icon="film"
          tint="#fff"
          title={t ? 'Sin historias activas' : 'No active stories'}
          message={
            t
              ? 'No hay nada que mostrar por ahora.'
              : 'There is nothing to show right now.'
          }
        />
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Cerrar' : 'Close'}
          style={styles.closeFallback}
        >
          <Text style={styles.closeFallbackText}>{t ? 'Cerrar' : 'Close'}</Text>
        </Pressy>
      </View>
    );
  }

  const author = currentGroup.user;
  const isVenueGroup = currentGroup.isVenue || author.id === VENUE_AUTHOR_ID;
  const name = isVenueGroup
    ? author.name ?? 'OPAL BAR PV'
    : `${author?.profile?.firstName ?? ''} ${author?.profile?.lastName ?? ''}`.trim() ||
      (t ? 'Usuario' : 'User');
  const initials = isVenueGroup
    ? 'OB'
    : ((author?.profile?.firstName?.[0] || '') + (author?.profile?.lastName?.[0] || ''))
        .toUpperCase() || 'U';
  const isMine = !isVenueGroup && author.id === me?.id;
  // Venue stories can be reacted to by anyone but have no single human author
  // to reply to — keep the two capabilities independent.
  const canReact = !isMine && !!currentStory;
  const canReply = !isMine && !isVenueGroup && !!author.id;

  async function handleQuickReact(emoji: string) {
    if (!currentStory || !canReact) return;
    const alreadyMine = reactedEmojis.includes(emoji);
    setReactedEmojis((prev) => (alreadyMine ? prev.filter((e) => e !== emoji) : [...prev, emoji]));
    flashToast(emoji);
    try {
      await communityApi.reactStory(currentStory.id, emoji);
    } catch {
      setReactedEmojis((prev) =>
        alreadyMine ? [...prev, emoji] : prev.filter((e) => e !== emoji),
      );
      showToast(t ? 'No se pudo reaccionar.' : 'Could not react.', 'danger');
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
      const quoted = `↪️ ${t ? 'Respuesta a tu historia' : 'Reply to your story'}:\n${text}`;
      await messagesApi.send(threadId, { content: quoted });
      setReplyText('');
      Keyboard.dismiss();
      flashToast(t ? 'Enviado' : 'Sent');
      showToast(t ? 'Mensaje enviado' : 'Message sent', 'success');
    } catch {
      flashToast(t ? 'No se pudo enviar' : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteStory() {
    if (!currentStory) return;
    await communityApi.deleteStory(currentStory.id);
    showToast(t ? 'Historia eliminada.' : 'Story deleted.', 'success');
    router.back();
  }

  function loadViewers() {
    if (!currentStory) return;
    setViewersLoading(true);
    setViewersError(null);
    communityApi
      .storyViewers(currentStory.id)
      .then((r) => {
        const payload = r.data?.data ?? r.data ?? {};
        setViewers(Array.isArray(payload.viewers) ? payload.viewers : []);
      })
      .catch((err) => setViewersError(apiError(err)))
      .finally(() => setViewersLoading(false));
  }

  const dockOffset = canReply ? 110 : canReact ? 76 : 60;

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <Image
        source={{ uri: currentStory.mediaUrl }}
        style={styles.backdrop}
        resizeMode="cover"
        blurRadius={40}
      />
      <View style={styles.backdropDim} />

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

      {/* Progress bars — hairline thin */}
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

      {/* Author bar */}
      <View
        style={[styles.topBar, { top: Math.max(insets.top, 12) + 22 }]}
        pointerEvents="box-none"
      >
        <Pressy
          onPress={() => {
            if (isVenueGroup) return;
            router.push(`/(app)/users/${author.id}` as never);
          }}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={name}
          hitSlop={HitSlop.expand}
          style={styles.userBtn}
        >
          {author.profile?.avatarUrl ? (
            <Image source={{ uri: author.profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View>
            <Text style={styles.authorName}>
              {isMine ? (t ? 'Tu historia' : 'Your story') : name}
            </Text>
            <Text style={styles.timeAgo}>{relTime(new Date(currentStory.createdAt), t)}</Text>
          </View>
        </Pressy>
        {isMine ? (
          <Pressy
            onPress={() => setMenuOpen(true)}
            haptic="select"
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Más opciones' : 'More options'}
            hitSlop={HitSlop.expand}
            style={styles.moreBtn}
          >
            <Feather name="more-horizontal" size={22} color="#fff" />
          </Pressy>
        ) : null}
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Cerrar' : 'Close'}
          hitSlop={HitSlop.expand}
          style={styles.closeBtn}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressy>
      </View>

      {/* Caption */}
      {currentStory.caption ? (
        <View style={styles.captionBox} pointerEvents="none">
          <Text style={styles.captionText}>{currentStory.caption}</Text>
        </View>
      ) : null}

      {/* Views — only mine, tap to see who viewed */}
      {isMine ? (
        <View style={styles.bottomBar} pointerEvents="box-none">
          <Pressy
            onPress={() => {
              setViewersOpen(true);
              loadViewers();
            }}
            haptic="select"
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Ver espectadores' : 'View viewers'}
            style={styles.viewsRow}
          >
            <Feather name="eye" size={14} color="#fff" />
            <Text style={styles.viewsText}>{currentStory.viewsCount ?? 0}</Text>
          </Pressy>
        </View>
      ) : null}

      {/* Reactions + reply dock */}
      {canReact ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.replyWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
          pointerEvents="box-none"
        >
          <View style={styles.quickRow}>
            {QUICK_REACTIONS.map((emoji) => {
              const mine = reactedEmojis.includes(emoji);
              return (
                <Pressy
                  key={emoji}
                  onPress={() => handleQuickReact(emoji)}
                  haptic="tap"
                  accessibilityRole={Roles.button}
                  accessibilityLabel={t ? `Reaccionar ${emoji}` : `React ${emoji}`}
                  hitSlop={HitSlop.expand}
                  style={[styles.quickEmojiBtn, mine && styles.quickEmojiBtnMine]}
                >
                  <Text style={styles.quickEmoji}>{emoji}</Text>
                </Pressy>
              );
            })}
          </View>
          {canReply ? (
            <View style={styles.replyRow}>
              <TextInput
                style={styles.replyInput}
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
                placeholder={
                  t
                    ? `Enviar mensaje a ${name.split(' ')[0] || 'usuario'}…`
                    : `Send a message to ${name.split(' ')[0] || 'user'}…`
                }
                placeholderTextColor="rgba(255,255,255,0.55)"
                multiline
                maxLength={500}
                editable={!sending}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={handleSendReply}
                accessibilityLabel={t ? 'Respuesta a la historia' : 'Story reply'}
              />
              {replyText.trim().length > 0 ? (
                <Pressy
                  onPress={handleSendReply}
                  disabled={sending}
                  haptic="tap"
                  accessibilityRole={Roles.button}
                  accessibilityLabel={t ? 'Enviar' : 'Send'}
                  hitSlop={HitSlop.expand}
                  style={[styles.replySendBtn, sending && { opacity: 0.5 }]}
                >
                  <Feather name="arrow-up" size={18} color="#fff" />
                </Pressy>
              ) : null}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      ) : null}

      {innerToast ? (
        <View
          style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + dockOffset }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{innerToast}</Text>
        </View>
      ) : null}

      {/* ── Owner "…" menu ─────────────────── */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t ? 'Tu historia' : 'Your story'}>
        <View style={{ paddingBottom: Spacing[4] }}>
          <ListItem
            title={t ? 'Eliminar historia' : 'Delete story'}
            destructive
            leftIcon={<Feather name="trash-2" size={18} color={Colors.accentDanger} />}
            showChevron={false}
            onPress={() => {
              setMenuOpen(false);
              setConfirmDeleteOpen(true);
            }}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteStory}
        title={t ? '¿Eliminar historia?' : 'Delete story?'}
        description={
          t
            ? 'Se eliminará de inmediato. Esta acción no se puede deshacer.'
            : 'It will be removed immediately. This cannot be undone.'
        }
        confirmLabel={t ? 'Eliminar' : 'Delete'}
        confirmVariant="danger"
      />

      {/* ── Owner viewers sheet ────────────── */}
      <Sheet
        open={viewersOpen}
        onClose={() => setViewersOpen(false)}
        title={t ? 'Espectadores' : 'Viewers'}
      >
        {viewersLoading ? (
          <View style={styles.viewersCenter}>
            <ActivityIndicator color={Colors.accentPrimary} />
          </View>
        ) : viewersError ? (
          <View style={styles.viewersCenter}>
            <Text style={styles.viewersMsg}>{viewersError}</Text>
            <Pressy
              onPress={loadViewers}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Reintentar' : 'Retry'}
              style={styles.viewersRetryBtn}
            >
              <Text style={styles.viewersRetryText}>{t ? 'Reintentar' : 'Retry'}</Text>
            </Pressy>
          </View>
        ) : viewers.length === 0 ? (
          <View style={styles.viewersCenter}>
            <Text style={styles.viewersMsg}>
              {t ? 'Nadie ha visto tu historia todavía.' : 'No one has viewed your story yet.'}
            </Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {viewers.map((v) => {
              const vName = `${v.firstName ?? ''} ${v.lastName ?? ''}`.trim() || (t ? 'Usuario' : 'User');
              const vInitials = ((v.firstName?.[0] || '') + (v.lastName?.[0] || '')).toUpperCase() || 'U';
              return (
                <View key={v.id} style={styles.viewerRow}>
                  {v.avatarUrl ? (
                    <Image source={{ uri: v.avatarUrl }} style={styles.viewerAvatar} />
                  ) : (
                    <View style={[styles.viewerAvatar, styles.viewerAvatarFallback]}>
                      <Text style={styles.viewerAvatarText}>{vInitials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerName} numberOfLines={1}>
                      {vName}
                    </Text>
                    <Text style={styles.viewerTime}>
                      {relTime(new Date(v.viewedAt), t)}
                    </Text>
                  </View>
                  {v.reactions.length > 0 ? (
                    <Text style={styles.viewerReaction}>{v.reactions.join(' ')}</Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </Sheet>
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
  closeFallback: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
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

  // Progress bars — hairline-thin (height 2)
  progressRow: {
    position: 'absolute',
    left: Spacing[3],
    right: Spacing[3],
    flexDirection: 'row',
    gap: Spacing[1],
    zIndex: 5,
  },
  progressBg: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFg: {
    height: '100%',
    backgroundColor: '#fff',
  },

  topBar: {
    position: 'absolute',
    left: Spacing[4],
    right: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  userBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], flex: 1 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    ...TypePresets.label,
    color: '#fff',
    fontSize: 12,
  },
  authorName: {
    ...TypePresets.subhead,
    color: '#fff',
  },
  timeAgo: {
    ...TypePresets.captionSm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  moreBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionBox: {
    position: 'absolute',
    left: Spacing[5],
    right: Spacing[5],
    bottom: 96,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  captionText: {
    ...TypePresets.bodyEmphasis,
    color: '#fff',
  },

  bottomBar: {
    position: 'absolute',
    left: Spacing[4],
    right: Spacing[4],
    bottom: Spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  viewsText: {
    ...TypePresets.label,
    color: '#fff',
    fontSize: 11,
  },

  replyWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    gap: Spacing[3],
    zIndex: 10,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Spacing[1],
  },
  quickEmojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  quickEmojiBtnMine: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  quickEmoji: { fontSize: 22 },

  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[2],
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  replyInput: {
    flex: 1,
    color: '#fff',
    ...TypePresets.body,
    maxHeight: 100,
    paddingVertical: 4,
  },
  replySendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentPrimary,
  },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  toastText: {
    ...TypePresets.caption,
    color: '#fff',
    fontWeight: '600',
  },

  // Viewers sheet
  viewersCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[8],
    gap: Spacing[3],
  },
  viewersMsg: {
    ...TypePresets.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  viewersRetryBtn: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  viewersRetryText: {
    ...TypePresets.bodySm,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textPrimary,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  viewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  viewerAvatarFallback: {
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerAvatarText: {
    ...TypePresets.label,
    color: Colors.textPrimary,
    fontSize: 11,
  },
  viewerName: {
    ...TypePresets.bodySm,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textPrimary,
  },
  viewerTime: {
    ...TypePresets.captionSm,
    color: Colors.textMuted,
    marginTop: 1,
  },
  viewerReaction: {
    fontSize: 15,
  },
});
