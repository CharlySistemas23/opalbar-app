// ─────────────────────────────────────────────
//  Messages · Chat thread — Editorial Premium
//
//  This screen owns hooks, state, navigation, socket lifecycle, mutations
//  and optimistic-update bookkeeping. UI primitives live in
//  `src/components/messages/`: MessageBubble, DateDivider, TypingBubble,
//  VoiceBubble, ChatInputBar, StickerPicker, MessageReactionRow.
//
//  Editorial choices:
//   · Body sans for message text · Kicker caps for date dividers
//   · Bubbles use Radius.md (8) — no pills.
//   · Bubble bg: bgCard (received) vs accentPrimary (sent)
//   · Sheets via <Sheet> primitive; long-press menu via <Sheet>.
//   · New messages enter with FadeIn delay=0 (no scale, no slide).
//   · Loading: SkeletonList placeholders.
// ─────────────────────────────────────────────
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

import { messagesApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing, Typography } from '@/constants/tokens';
import { useThreadSocket } from '@/hooks/useThreadSocket';
import { useFeedback } from '@/hooks/useFeedback';
import { uploadImage } from '@/utils/uploadImage';
import { uploadAudio } from '@/utils/uploadAudio';
import {
  Body,
  Button,
  Caption,
  FadeIn,
  Kicker,
  Pressy,
  Sheet,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  ChatInputBar,
  DateDivider,
  MessageBubble,
  MessageReactionRow,
  StickerPicker,
  TypingBubble,
  type ReactionAggregate,
} from '@/components/messages';

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#6FB892', '#E06868', '#EC4899'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtDuration(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;
function buildTimeline(messages: any[]) {
  const out: any[] = [];
  let lastDate: Date | null = null;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const at = m.createdAt ? new Date(m.createdAt) : new Date();
    if (!lastDate || !isSameDay(lastDate, at)) {
      out.push({ type: 'date', id: `d-${at.toISOString().slice(0, 10)}`, at });
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const prevAt = prev?.createdAt ? new Date(prev.createdAt) : null;
    const nextAt = next?.createdAt ? new Date(next.createdAt) : null;
    const prevSame =
      !!prev && prev.senderId === m.senderId && !!prevAt &&
      isSameDay(prevAt, at) && at.getTime() - prevAt.getTime() < GROUP_WINDOW_MS;
    const nextSame =
      !!next && next.senderId === m.senderId && !!nextAt &&
      isSameDay(nextAt, at) && nextAt.getTime() - at.getTime() < GROUP_WINDOW_MS;
    out.push({
      type: 'msg',
      id: m.id,
      msg: m,
      isFirstInGroup: !prevSame,
      isLastInGroup: !nextSame,
      at,
    });
    lastDate = at;
  }
  return out;
}

// GIPHY API key — must be provided via env. When empty, the GIF picker is
// disabled (no network calls). Document `EXPO_PUBLIC_GIPHY_KEY` in
// `.env.example` as optional but recommended to enable the in-app GIF browser.
const GIPHY_KEY = process.env['EXPO_PUBLIC_GIPHY_KEY'] ?? '';
const GIPHY_ENABLED = GIPHY_KEY.length > 0;

export default function MessageThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<any>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDur, setRecordingDur] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const recTimerRef = useRef<any>(null);
  const lastTapRef = useRef<{ id: string; at: number } | null>(null);
  const listRef = useRef<FlatList>(null);
  // Mirror of `messages` for closures that need the latest value without
  // having to capture state (avoids stale-closure bugs in sendPayload's
  // replyTo lookup when an optimistic insert races with an incoming socket).
  const messagesRef = useRef<any[]>([]);
  // Track whether the user is parked near the bottom of the list. When false,
  // we suppress auto-scroll on incoming/optimistic messages so we don't yank
  // them away from history they're reading.
  const atBottomRef = useRef(true);
  // Debounce token for markRead so a burst of incoming messages collapses
  // into a single API call.
  const markReadTimerRef = useRef<any>(null);
  const fb = useFeedback();

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Load thread + initial page ───────────────
  const load = useCallback(async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        messagesApi.thread(id),
        messagesApi.messages(id, { limit: 30 }),
      ]);
      setThread(tRes.data?.data);
      const msgs = mRes.data?.data ?? [];
      setMessages(msgs);
      if (msgs.length >= 30) {
        setCursor(msgs[0]?.id ?? null);
        setHasMore(true);
      } else {
        setHasMore(false);
      }
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const r = await messagesApi.messages(id, { cursor, limit: 30 });
      const older = r.data?.data ?? [];
      if (older.length === 0) {
        setHasMore(false);
      } else {
        setMessages((prev) => [...older, ...prev]);
        setCursor(older[0]?.id ?? null);
        if (older.length < 30) setHasMore(false);
      }
    } catch {} finally { setLoadingMore(false); }
  }, [cursor, loadingMore, hasMore, id]);

  // ── Socket handlers ──────────────────────────
  const handleIncoming = useCallback((msg: any) => {
    if (!msg?.id) return;
    let added = false;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      added = true;
      return [...prev, msg];
    });
    if (added && msg.senderId !== me?.id) fb.notification();
    // Only auto-scroll for incoming messages when the user is already
    // parked near the bottom — otherwise we'd yank them out of history
    // they're actively reading.
    if (atBottomRef.current) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [fb, me?.id]);

  const handleReaction = useCallback((payload: any) => {
    const messageId = payload?.messageId ?? payload?.data?.messageId ?? payload?.id;
    const reactions = payload?.reactions ?? payload?.data?.reactions;
    if (!messageId || !Array.isArray(reactions)) return;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
  }, []);

  const handleDeleted = useCallback((payload: any) => {
    const mid = payload?.id ?? payload?.messageId;
    if (!mid) return;
    setMessages((prev) => prev.filter((m) => m.id !== mid));
  }, []);

  const handlePeerRead = useCallback((_payload: { byUserId: string }) => {
    setMessages((prev) =>
      prev.map((m) => (m.senderId === me?.id && !m.isRead ? { ...m, isRead: true } : m)),
    );
  }, [me?.id]);

  const {
    otherOnline,
    otherLastSeenAt,
    typingUserIds,
    recordingUserIds,
    emitTyping,
    emitRecording,
    markRead,
  } = useThreadSocket(
    id,
    handleIncoming,
    {
      otherUserId: thread?.otherUser?.id,
      onReaction: handleReaction,
      onDeleted: handleDeleted,
      onRead: handlePeerRead,
    },
  );

  // markRead is debounced 800ms: in bursty conversations (peer sends 10
  // messages back-to-back) we used to fire 10 separate API calls; collapse
  // those into a single tail call. We also gate on `atBottomRef` so that
  // if the user is reading old history while new messages arrive, we don't
  // mark them as read prematurely. The screen-focus + send paths both
  // reset `atBottomRef` to true, so the normal foreground case still marks.
  useEffect(() => {
    if (loading) return;
    if (!atBottomRef.current) return;
    if (!messages.some((m) => m.senderId !== me?.id && !m.isRead)) return;
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      markRead();
      markReadTimerRef.current = null;
    }, 800);
    return () => {
      if (markReadTimerRef.current) {
        clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
    };
  }, [loading, messages, me?.id, markRead]);

  // ── Sending (optimistic) ─────────────────────
  const sendPayload = useCallback(async (
    payload: {
      content?: string;
      imageUrl?: string;
      stickerKey?: string;
      audioUrl?: string;
      audioDurationSec?: number;
      replyToId?: string;
    },
    opts: { tempId?: string } = {},
  ) => {
    setSending(true);
    fb.send();
    const tempId = opts.tempId ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = {
      id: tempId,
      senderId: me?.id,
      content: payload.content ?? null,
      imageUrl: payload.imageUrl ?? null,
      stickerKey: payload.stickerKey ?? null,
      audioUrl: payload.audioUrl ?? null,
      audioDurationSec: payload.audioDurationSec ?? null,
      replyToId: payload.replyToId ?? null,
      replyTo: payload.replyToId
        ? messagesRef.current.find((x) => x.id === payload.replyToId) ?? null
        : null,
      reactions: [],
      createdAt: new Date().toISOString(),
      isRead: false,
      _status: 'sending' as 'sending' | 'failed' | 'sent',
      _payload: payload,
    };
    setMessages((m) => {
      const without = m.filter((x) => x.id !== tempId);
      return [...without, optimistic];
    });
    // User-initiated send: always pin to bottom and treat the list as
    // "at bottom" again, regardless of where they were scrolled.
    atBottomRef.current = true;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const r = await messagesApi.send(id, payload);
      const real = r.data?.data;
      setMessages((m) => {
        const without = m.filter((x) => x.id !== tempId && x.id !== real?.id);
        return real ? [...without, real] : without;
      });
    } catch {
      fb.error();
      setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, _status: 'failed' } : x)));
      throw new Error('send failed');
    } finally {
      setSending(false);
    }
  }, [fb, id, me?.id]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    emitTyping(false);
    const replyId = replyTo?.id;
    setReplyTo(null);
    try { await sendPayload({ content: body, replyToId: replyId }); } catch {}
  }, [text, emitTyping, replyTo?.id, sendPayload]);

  const retrySend = useCallback(async (msg: any) => {
    if (!msg?._payload) return;
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, _status: 'sending' } : x)));
    try {
      await sendPayload(msg._payload, { tempId: msg.id });
    } catch {}
  }, [sendPayload]);

  const discardFailed = useCallback((msg: any) => {
    setMessages((m) => m.filter((x) => x.id !== msg.id));
  }, []);

  // ── Image / attach ───────────────────────────
  async function pickAndSendImage(source: 'camera' | 'library') {
    setAttachOpen(false);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t ? 'Cámara' : 'Camera', t ? 'Necesitamos permiso para usar la cámara.' : 'We need camera permission.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t ? 'Galería' : 'Library', t ? 'Necesitamos permiso para acceder a tus fotos.' : 'We need photo library permission.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setUploadingImage(true);
      const url = await uploadImage(result.assets[0].uri, { kind: 'post' });
      const replyId = replyTo?.id;
      setReplyTo(null);
      await sendPayload({ imageUrl: url, replyToId: replyId });
    } catch (err: any) {
      fb.error();
      Alert.alert('Error', err?.message ?? 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  }

  async function sendSticker(emoji: string) {
    setStickerOpen(false);
    const replyId = replyTo?.id;
    setReplyTo(null);
    try { await sendPayload({ stickerKey: emoji, replyToId: replyId }); } catch {}
  }

  // ── Voice notes ──────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t ? 'Micrófono' : 'Microphone', t ? 'Necesitamos permiso para grabar audio.' : 'We need mic permission.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      } as any);
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setRecordingDur(0);
      fb.tap();
      emitRecording(true);
      recTimerRef.current = setInterval(() => setRecordingDur((d) => d + 1), 1000);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Recording failed');
    }
  }, [fb, t, emitRecording]);

  const cancelRecording = useCallback(async () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    setRecordingDur(0);
    try { await recording?.stopAndUnloadAsync(); } catch {}
    setRecording(null);
    emitRecording(false);
  }, [recording, emitRecording]);

  const stopAndSendRecording = useCallback(async () => {
    const rec = recording;
    if (!rec) return;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    const duration = recordingDur;
    setRecording(null);
    setRecordingDur(0);
    emitRecording(false);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return;
      if (duration < 1) return;
      setUploadingAudio(true);
      const url = await uploadAudio(uri);
      const replyId = replyTo?.id;
      setReplyTo(null);
      await sendPayload({ audioUrl: url, audioDurationSec: duration, replyToId: replyId });
    } catch (err: any) {
      fb.error();
      Alert.alert('Error', err?.message ?? 'Upload failed');
    } finally {
      setUploadingAudio(false);
    }
  }, [recording, recordingDur, replyTo?.id, sendPayload, fb, emitRecording]);

  // ── Reactions ────────────────────────────────
  const reactToMessage = useCallback(async (msg: any, emoji: string) => {
    if (!me?.id) return;
    const cur = (msg.reactions ?? []) as Array<{ userId: string; emoji: string }>;
    const myPrior = cur.find((r) => r.userId === me.id)?.emoji ?? null;
    const isToggleOff = myPrior === emoji;

    const next = cur.filter((r) => r.userId !== me.id);
    if (!isToggleOff) next.push({ userId: me.id, emoji });

    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reactions: next } : m)));
    fb.tap();

    try {
      if (isToggleOff) {
        await messagesApi.unreact(msg.id, emoji);
      } else {
        await messagesApi.react(msg.id, emoji);
      }
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reactions: cur } : m)));
    }
  }, [me?.id, fb]);

  const handleBubbleTap = useCallback((msg: any) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === msg.id && now - last.at < 280) {
      reactToMessage(msg, '❤️');
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: msg.id, at: now };
    }
  }, [reactToMessage]);

  // ── Long-press menu ──────────────────────────
  const openMenu = useCallback((msg: any) => {
    if (msg._status === 'sending' || msg._status === 'failed') return;
    fb.tap();
    setActionMsg(msg);
  }, [fb]);

  const menuCopy = useCallback(() => {
    if (actionMsg?.content) {
      Clipboard.setStringAsync(actionMsg.content).catch(() => undefined);
    }
    setActionMsg(null);
  }, [actionMsg]);

  const menuReply = useCallback(() => {
    setReplyTo(actionMsg);
    setActionMsg(null);
  }, [actionMsg]);

  // ── GIF picker ───────────────────────────────
  const searchGifs = useCallback(async (q: string) => {
    // No-op when GIPHY is not configured — the picker entry point is also
    // hidden in the attach sheet, but guard here too so accidental opens
    // don't hammer Giphy with a missing key.
    if (!GIPHY_ENABLED) {
      setGifs([]);
      return;
    }
    setGifLoading(true);
    try {
      const url = q.trim().length > 0
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`;
      const r = await fetch(url);
      const j = await r.json();
      setGifs(j?.data ?? []);
    } catch {
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!gifOpen) return;
    const handle = setTimeout(() => searchGifs(gifQuery), gifQuery ? 400 : 0);
    return () => clearTimeout(handle);
  }, [gifOpen, gifQuery, searchGifs]);

  const sendGif = useCallback(async (gif: any) => {
    const url = gif?.images?.original?.url ?? gif?.images?.fixed_height?.url;
    if (!url) return;
    setGifOpen(false);
    setGifQuery('');
    const replyId = replyTo?.id;
    setReplyTo(null);
    try { await sendPayload({ imageUrl: url, replyToId: replyId }); } catch {}
  }, [replyTo?.id, sendPayload]);

  // ── Derived UI ───────────────────────────────
  const other = thread?.otherUser;
  const isOtherTyping = !!other?.id && typingUserIds.has(other.id);
  const isOtherRecording = !!other?.id && recordingUserIds.has(other.id);
  const first = other?.profile?.firstName ?? '';
  const last = other?.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || 'Usuario';
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';

  const lastSeenLabel = useMemo(() => {
    if (otherOnline) return null;
    const iso = otherLastSeenAt ?? other?.lastSeenAt ?? null;
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return null;
    const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (diffMin < 1) return t ? 'Última vez hace un momento' : 'Last seen just now';
    if (diffMin < 60) return t ? `Última vez hace ${diffMin} min` : `Last seen ${diffMin} min ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return t ? `Última vez hace ${diffH} h` : `Last seen ${diffH} h ago`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 7) return t ? `Última vez hace ${diffD} d` : `Last seen ${diffD} d ago`;
    const d = new Date(iso);
    return t ? `Última vez ${d.toLocaleDateString('es')}` : `Last seen ${d.toLocaleDateString('en')}`;
  }, [otherOnline, otherLastSeenAt, other?.lastSeenAt, t]);

  const timeline = useMemo(() => {
    const tl = buildTimeline(messages);
    if (isOtherTyping) tl.push({ type: 'typing', id: '__typing__' });
    return tl;
  }, [messages, isOtherTyping]);

  const lastReadMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId === me?.id && m.isRead && !m._status) return m.id;
    }
    return null;
  }, [messages, me?.id]);
  const lastSentMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === me?.id && !messages[i]._status) return messages[i].id;
    }
    return null;
  }, [messages, me?.id]);

  function aggReactions(reactions: any[]): ReactionAggregate[] {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions || []) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (r.userId === me?.id) cur.mine = true;
      map.set(r.emoji, cur);
    }
    return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, ...v }));
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header ──────────────────────────────── */}
        <View style={styles.header}>
          <Pressy
            onPress={() => router.back()}
            accessibilityLabel={t ? 'Volver' : 'Back'}
            accessibilityRole={Roles.button}
            hitSlop={HitSlop.expand}
            style={styles.headerBtn}
          >
            <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
          </Pressy>
          <Pressy
            onPress={() => other?.id && router.push(`/(app)/users/${other.id}` as never)}
            accessibilityLabel={name}
            accessibilityRole={Roles.button}
            style={styles.headerMid}
            haptic="select"
          >
            <View style={{ position: 'relative' }}>
              {other?.profile?.avatarUrl ? (
                <Image source={{ uri: other.profile.avatarUrl }} style={styles.headerAvatar} />
              ) : (
                <View
                  style={[
                    styles.headerAvatar,
                    { backgroundColor: colorFor(other?.id || id) },
                  ]}
                >
                  <Body size="sm" tone="inverse" weight="bold">{initials}</Body>
                </View>
              )}
              {otherOnline ? <View style={styles.onlineDot} /> : null}
            </View>
            <View style={{ flex: 1, marginLeft: Spacing[3] }}>
              <Subhead numberOfLines={1} style={styles.headerName}>{name}</Subhead>
              <View style={styles.headerSubRow}>
                {isOtherRecording ? (
                  <>
                    <View style={[styles.statusDot, { backgroundColor: Colors.accentDanger }]} />
                    <Caption size="sm" tone="danger">
                      {t ? 'Grabando audio…' : 'Recording audio…'}
                    </Caption>
                  </>
                ) : isOtherTyping ? (
                  <>
                    <View style={[styles.statusDot, { backgroundColor: Colors.accentPrimary }]} />
                    <Caption size="sm" tone="accent">
                      {t ? 'Escribiendo…' : 'Typing…'}
                    </Caption>
                  </>
                ) : otherOnline ? (
                  <>
                    <View style={[styles.statusDot, { backgroundColor: Colors.accentSuccess }]} />
                    <Caption size="sm" tone="secondary">{t ? 'En línea' : 'Online'}</Caption>
                  </>
                ) : (
                  <>
                    <View style={[styles.statusDot, { backgroundColor: Colors.textMuted }]} />
                    <Caption size="sm" tone="muted" numberOfLines={1}>
                      {lastSeenLabel ?? (t ? 'Desconectado' : 'Offline')}
                    </Caption>
                  </>
                )}
              </View>
            </View>
          </Pressy>
          <Pressy
            onPress={() => other?.id && router.push(`/(app)/users/${other.id}` as never)}
            accessibilityLabel={t ? 'Más opciones' : 'More options'}
            accessibilityRole={Roles.button}
            hitSlop={HitSlop.expand}
            style={styles.headerBtn}
          >
            <Feather name="more-vertical" size={20} color={Colors.textSecondary} />
          </Pressy>
        </View>

        {/* Body — chat list ───────────────────── */}
        {loading ? (
          <View style={styles.skeletonPad}>
            <View style={{ alignSelf: 'flex-start', marginTop: Spacing[3] }}>
              <Skeleton width={220} height={42} radius={Radius.md} />
            </View>
            <View style={{ alignSelf: 'flex-end', marginTop: Spacing[3] }}>
              <Skeleton width={180} height={42} radius={Radius.md} />
            </View>
            <View style={{ alignSelf: 'flex-start', marginTop: Spacing[3] }}>
              <Skeleton width={260} height={62} radius={Radius.md} />
            </View>
            <View style={{ alignSelf: 'flex-end', marginTop: Spacing[3] }}>
              <Skeleton width={140} height={42} radius={Radius.md} />
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={timeline}
            keyExtractor={(x) => x.id}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => {
              // Only pin to bottom when the user was already near the bottom
              // (or just sent a message — sendPayload resets atBottomRef).
              // Otherwise we'd hijack scroll while they read history.
              if (atBottomRef.current) {
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onScroll={(e) => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              atBottomRef.current =
                contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
              if (contentOffset.y < 80 && hasMore && !loadingMore) loadMore();
            }}
            scrollEventThrottle={300}
            ListHeaderComponent={
              loadingMore ? (
                <View style={{ paddingVertical: Spacing[3] }}>
                  <ActivityIndicator color={Colors.accentPrimary} size="small" />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              if (item.type === 'date') {
                return <DateDivider date={item.at} language={language} />;
              }
              if (item.type === 'typing') return <TypingBubble />;

              const m = item.msg;
              const isMe = m.senderId === me?.id;
              const showMeta = item.isLastInGroup;
              const showReadTick = isMe && m.id === lastSentMineId;
              const isRead = isMe && m.id === lastReadMineId;
              const reactions = aggReactions(m.reactions ?? []);

              return (
                <FadeIn>
                  <MessageBubble
                    message={m}
                    isMe={isMe}
                    isFirstInGroup={item.isFirstInGroup}
                    isLastInGroup={item.isLastInGroup}
                    at={item.at}
                    showMeta={showMeta}
                    showReadTick={showReadTick}
                    isRead={isRead}
                    reactions={reactions}
                    other={!isMe ? {
                      id: other?.id,
                      avatarUrl: other?.profile?.avatarUrl,
                      initials,
                    } : undefined}
                    threadId={id}
                    language={language}
                    t={t}
                    selfId={me?.id}
                    selfName={me ? (t ? 'Tú' : 'You') : undefined}
                    authorName={name}
                    onTap={handleBubbleTap}
                    onLongPress={openMenu}
                    onImagePress={setLightboxUrl}
                    onReact={reactToMessage}
                    onRetry={retrySend}
                    onDiscard={discardFailed}
                  />
                </FadeIn>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Kicker tone="champagne">{t ? 'NUEVA CONVERSACIÓN' : 'NEW CONVERSATION'}</Kicker>
                <View style={{ marginTop: Spacing[3] }}>
                  <Subhead align="center" style={{ fontFamily: Typography.fontFamily.serifSemiBold, fontSize: Typography.fontSize['2xl'] }}>
                    {t ? 'Saluda a ' : 'Say hi to '}{name}
                  </Subhead>
                </View>
                <Body align="center" tone="secondary" style={styles.emptyBody}>
                  {t
                    ? 'Aún no hay mensajes. Rompe el hielo con un gesto breve.'
                    : 'No messages yet. Break the ice with a quick hello.'}
                </Body>
                <View style={styles.emptyHints}>
                  {(t
                    ? ['Hola 👋', '¿Qué tal?', '¡Nos vemos pronto!']
                    : ['Hi 👋', "What's up?", 'See you soon!']
                  ).map((s) => (
                    <Pressy
                      key={s}
                      onPress={() => setText(s)}
                      accessibilityLabel={s}
                      accessibilityRole={Roles.button}
                      haptic="select"
                      style={styles.hintChip}
                    >
                      <Body size="sm" tone="primary" weight="medium">{s}</Body>
                    </Pressy>
                  ))}
                </View>
              </View>
            }
          />
        )}

        {/* Reply chip above composer ─────────── */}
        {replyTo && (
          <View style={styles.replyComposeChip}>
            <View style={styles.replyComposeBar} />
            <View style={{ flex: 1 }}>
              <Caption size="sm" tone="secondary">
                <Feather name="corner-up-left" size={11} color={Colors.accentPrimary} />
                {'  '}
                {t ? 'Respondiendo a ' : 'Replying to '}
                <Body size="sm" weight="bold">
                  {replyTo.senderId === me?.id ? (t ? 'ti' : 'yourself') : name}
                </Body>
              </Caption>
              <Body size="sm" weight="medium" numberOfLines={1} style={{ marginTop: 2 }}>
                {replyTo.content
                  ?? (replyTo.imageUrl ? (t ? 'Foto' : 'Photo')
                    : replyTo.audioUrl ? (t ? 'Nota de voz' : 'Voice note')
                      : replyTo.stickerKey ?? '…')}
              </Body>
            </View>
            {replyTo.imageUrl ? (
              <Image source={{ uri: replyTo.imageUrl }} style={styles.replyComposeThumb} />
            ) : replyTo.stickerKey ? (
              <View style={styles.replyComposeStickerThumb}>
                <Body size="lg" style={{ fontSize: 26 }}>{replyTo.stickerKey}</Body>
              </View>
            ) : null}
            <Pressy
              onPress={() => setReplyTo(null)}
              accessibilityLabel={t ? 'Cancelar respuesta' : 'Cancel reply'}
              accessibilityRole={Roles.button}
              hitSlop={HitSlop.expand}
              haptic="select"
              style={styles.replyComposeClose}
            >
              <Feather name="x" size={16} color={Colors.textSecondary} />
            </Pressy>
          </View>
        )}

        {/* Composer or recording overlay ───── */}
        {recording ? (
          <RecordingBar
            duration={recordingDur}
            uploading={uploadingAudio}
            onCancel={cancelRecording}
            onSend={stopAndSendRecording}
            t={t}
          />
        ) : (
          <ChatInputBar
            text={text}
            onChangeText={(v) => { setText(v); emitTyping(v.length > 0); }}
            onFocus={() => setComposerFocused(true)}
            onBlur={() => setComposerFocused(false)}
            focused={composerFocused}
            sending={sending}
            uploadingImage={uploadingImage}
            uploadingAudio={uploadingAudio}
            onAttachPress={() => setAttachOpen(true)}
            onStickerPress={() => setStickerOpen(true)}
            onSend={send}
            onMicStart={startRecording}
            t={t}
          />
        )}
      </KeyboardAvoidingView>

      {/* Sheets ─────────────────────────────── */}
      <Sheet open={attachOpen} onClose={() => setAttachOpen(false)} title={t ? 'Adjuntar' : 'Attach'}>
        <AttachOption
          icon="camera"
          tint={Colors.accentPrimary}
          label={t ? 'Cámara' : 'Camera'}
          onPress={() => pickAndSendImage('camera')}
        />
        <AttachOption
          icon="image"
          tint={Colors.accentInfo}
          label={t ? 'Galería' : 'Photo library'}
          onPress={() => pickAndSendImage('library')}
        />
        <AttachOption
          icon="smile"
          tint={Colors.accentChampagne}
          label={t ? 'Sticker' : 'Sticker'}
          onPress={() => { setAttachOpen(false); setStickerOpen(true); }}
        />
        {GIPHY_ENABLED ? (
          <AttachOption
            label="GIF"
            customGlyph="GIF"
            tint="#A855F7"
            onPress={() => { setAttachOpen(false); setGifOpen(true); setGifQuery(''); }}
          />
        ) : null}
      </Sheet>

      <Sheet open={stickerOpen} onClose={() => setStickerOpen(false)} title={t ? 'Stickers' : 'Stickers'}>
        <StickerPicker onSelect={sendSticker} />
      </Sheet>

      <Sheet open={gifOpen} onClose={() => setGifOpen(false)} title="GIFs">
        <View style={styles.gifSearchWrap}>
          <Feather name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.gifSearch}
            value={gifQuery}
            onChangeText={setGifQuery}
            placeholder={t ? 'Busca GIFs…' : 'Search GIFs…'}
            placeholderTextColor={Colors.textMuted}
            autoFocus
            accessibilityLabel={t ? 'Buscar GIFs' : 'Search GIFs'}
          />
        </View>
        {gifLoading ? (
          <View style={{ padding: Spacing[8] }}>
            <ActivityIndicator color={Colors.accentPrimary} />
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={styles.gifGrid}>
            {gifs.map((g) => {
              const url = g?.images?.fixed_height_small?.url ?? g?.images?.fixed_height?.url;
              if (!url) return null;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => sendGif(g)}
                  accessibilityRole={Roles.button}
                  accessibilityLabel={g.title ?? 'GIF'}
                  style={styles.gifCell}
                >
                  <Image source={{ uri: url }} style={styles.gifImage} />
                </Pressable>
              );
            })}
            {gifs.length === 0 && (
              <Caption tone="muted" align="center" style={{ padding: Spacing[6], width: '100%' }}>
                {t ? 'Sin resultados' : 'No results'}
              </Caption>
            )}
          </ScrollView>
        )}
      </Sheet>

      {/* Long-press action menu — reactions row INSIDE so they share the
          same modal layer; opening a second sheet would cover this one. */}
      <Sheet open={!!actionMsg} onClose={() => setActionMsg(null)} title={t ? 'Mensaje' : 'Message'}>
        <MessageReactionRow
          onSelect={(emoji) => {
            if (actionMsg) reactToMessage(actionMsg, emoji);
            setActionMsg(null);
          }}
        />
        <AttachOption
          icon="corner-up-left"
          tint={Colors.accentPrimary}
          label={t ? 'Responder' : 'Reply'}
          onPress={menuReply}
        />
        {!!actionMsg?.content && (
          <AttachOption
            icon="copy"
            tint={Colors.accentInfo}
            label={t ? 'Copiar' : 'Copy'}
            onPress={menuCopy}
          />
        )}
      </Sheet>

      {/* Image lightbox — kept as native RNModal because <Sheet> animates
          from the bottom; full-screen image viewers want a fade. */}
      <RNModal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <Pressable
          style={styles.lightboxBackdrop}
          onPress={() => setLightboxUrl(null)}
          accessibilityLabel={t ? 'Cerrar foto' : 'Close photo'}
        >
          {lightboxUrl ? (
            <Image source={{ uri: lightboxUrl }} style={styles.lightboxImage} resizeMode="contain" />
          ) : null}
          <Pressable
            style={styles.lightboxClose}
            onPress={() => setLightboxUrl(null)}
            hitSlop={HitSlop.expand}
            accessibilityLabel={t ? 'Cerrar' : 'Close'}
            accessibilityRole={Roles.button}
          >
            <Feather name="x" size={22} color={Colors.white} />
          </Pressable>
        </Pressable>
      </RNModal>
    </SafeAreaView>
  );
}

function AttachOption({
  icon,
  customGlyph,
  tint,
  label,
  onPress,
}: {
  icon?: React.ComponentProps<typeof Feather>['name'];
  customGlyph?: string;
  tint: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressy
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole={Roles.button}
      style={styles.attachRow}
    >
      <View style={[styles.attachIcon, { backgroundColor: tint + '14', borderColor: tint + '33' }]}>
        {icon ? (
          <Feather name={icon} size={18} color={tint} />
        ) : (
          <Body size="sm" weight="bold" style={{ color: tint, letterSpacing: 0.5 }}>{customGlyph}</Body>
        )}
      </View>
      <Subhead>{label}</Subhead>
    </Pressy>
  );
}

function RecordingBar({
  duration,
  uploading,
  onCancel,
  onSend,
  t,
}: {
  duration: number;
  uploading: boolean;
  onCancel: () => void;
  onSend: () => void;
  t: boolean;
}) {
  return (
    <View style={styles.recordBar}>
      <View style={styles.recordPulse} />
      <Body weight="bold" style={{ minWidth: 50 }}>{fmtDuration(duration)}</Body>
      <Body size="sm" tone="secondary">{t ? 'Grabando…' : 'Recording…'}</Body>
      <View style={{ flex: 1 }} />
      <Pressy
        onPress={onCancel}
        accessibilityLabel={t ? 'Cancelar grabación' : 'Cancel recording'}
        accessibilityRole={Roles.button}
        hitSlop={HitSlop.expand}
        haptic="select"
        style={styles.recordCancel}
      >
        <Feather name="x" size={18} color={Colors.textSecondary} />
      </Pressy>
      <Pressy
        onPress={onSend}
        accessibilityLabel={t ? 'Enviar nota de voz' : 'Send voice note'}
        accessibilityRole={Roles.button}
        hitSlop={HitSlop.expand}
        haptic="success"
        style={styles.recordSend}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={Colors.textInverse} />
        ) : (
          <Feather name="send" size={17} color={Colors.textInverse} />
        )}
      </Pressy>
    </View>
  );
}

// ── Button kept referenced for future inline destructive flows. ──
void Button;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingTop: 4,
    paddingBottom: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.bgPrimary,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMid: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  headerName: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: Typography.fontSize.lg,
    letterSpacing: Typography.letterSpacing.tight,
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accentSuccess,
    borderWidth: 2.5,
    borderColor: Colors.bgPrimary,
  },

  // List
  skeletonPad: {
    flex: 1,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[5],
  },
  listContent: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[4],
    flexGrow: 1,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EditorialSpacing.heroPadding,
    gap: Spacing[2],
  },
  emptyBody: {
    maxWidth: 280,
    marginTop: Spacing[2],
  },
  emptyHints: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing[2],
    marginTop: Spacing[5],
  },
  hintChip: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },

  // Reply-to chip above composer
  replyComposeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.accentPrimary + '44',
  },
  replyComposeBar: {
    width: 3,
    height: 34,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 2,
  },
  replyComposeThumb: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
  },
  replyComposeStickerThumb: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyComposeClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },

  // Recording bar
  recordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderStrong,
    backgroundColor: Colors.bgPrimary,
  },
  recordPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accentDanger,
  },
  recordCancel: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordSend: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Attach sheet rows
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    paddingVertical: Spacing[3],
  },
  attachIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  // GIF picker
  gifSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    marginBottom: Spacing[3],
  },
  gifSearch: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.base,
    paddingVertical: 0,
  },
  gifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: Spacing[4],
  },
  gifCell: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
  },
  gifImage: { width: '100%', height: '100%' },

  // Lightbox
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
