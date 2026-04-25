import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  Clipboard,
} from 'react-native';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { messagesApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius, Shadows, Typography } from '@/constants/tokens';
import { useThreadSocket } from '@/hooks/useThreadSocket';
import { useFeedback } from '@/hooks/useFeedback';
import { uploadImage } from '@/utils/uploadImage';
import { uploadAudio } from '@/utils/uploadAudio';

const STICKER_PACK = [
  '🔥', '💖', '😂', '🥳', '😍', '😎',
  '🍻', '🥂', '🍷', '🎉', '✨', '⭐',
  '👀', '👋', '🙌', '👏', '💯', '💃',
  '🕺', '🎶', '🎵', '🎁', '💋', '😘',
  '😭', '🤣', '😅', '🫶', '❤️‍🔥', '💕',
];
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏'];

// Public Giphy beta key — fine for dev / preview channel.
const GIPHY_KEY = process.env['EXPO_PUBLIC_GIPHY_KEY'] ?? 'dc6zaTOxFJmzC';

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
function dateLabel(d: Date, t: boolean) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return t ? 'Hoy' : 'Today';
  if (isSameDay(d, yesterday)) return t ? 'Ayer' : 'Yesterday';
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  if (d > weekAgo) {
    return d.toLocaleDateString(t ? 'es' : 'en', { weekday: 'long' });
  }
  return d.toLocaleDateString(t ? 'es' : 'en', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}
function fmtTime(d: Date, lang: string) {
  return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Pulsing red dot for the recording bar.
function RecordingPulse() {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.35, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[
        styles.recordPulse,
        { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0.35, 1], outputRange: [0.85, 1.15] }) }] },
      ]}
    />
  );
}

function TypingBubble() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={[styles.msgRow, styles.msgRowThem, { marginTop: 4 }]}>
      <View style={styles.themAvatarSpacer} />
      <View style={[styles.bubble, styles.bubbleThem, styles.typingBubble]}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0.3, 1], outputRange: [0.7, 1] }) }] }]}
          />
        ))}
      </View>
    </View>
  );
}

function AnimatedMessage({ children, fromMe }: { children: React.ReactNode; fromMe: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const translateX = useRef(new Animated.Value(fromMe ? 14 : -14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 16, stiffness: 220, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, damping: 18, stiffness: 240, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, translateX]);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { translateX }] }}>
      {children}
    </Animated.View>
  );
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
    const prevSame = !!prev && prev.senderId === m.senderId && !!prevAt && isSameDay(prevAt, at) && at.getTime() - prevAt.getTime() < GROUP_WINDOW_MS;
    const nextSame = !!next && next.senderId === m.senderId && !!nextAt && isSameDay(nextAt, at) && nextAt.getTime() - at.getTime() < GROUP_WINDOW_MS;
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

// Stable pseudo-waveform — derive bar heights from the URL hash so a given
// voice note always renders the same shape across mounts.
function waveformFor(url: string, bars = 28) {
  const out: number[] = [];
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  for (let i = 0; i < bars; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out.push(0.35 + ((h >>> 8) & 0xff) / 255 * 0.65);
  }
  return out;
}

// Voice-note bubble — tap to play/pause, animated progress over a waveform.
function VoiceBubble({ url, durationSec, isMe }: { url: string; durationSec?: number | null; isMe: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const bars = useMemo(() => waveformFor(url), [url]);

  const cleanup = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try { s.setOnPlaybackStatusUpdate(null as any); } catch {}
      try { await s.unloadAsync(); } catch {}
    }
  }, []);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const toggle = useCallback(async () => {
    try {
      // Already loaded: just pause/resume.
      if (soundRef.current) {
        const status: any = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else if (status.isLoaded) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }
      // Fresh play: ensure audio mode is set for playback (after recording the
      // mode may still be in capture state, which on Android causes glitches).
      setLoading(true);
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        } as any);
      } catch {}
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, isLooping: false, volume: 1.0 },
      );
      soundRef.current = sound;
      setLoading(false);
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status?.isLoaded) return;
        if (status.durationMillis) {
          setProgress(Math.min(1, status.positionMillis / status.durationMillis));
        }
        if (status.didJustFinish) {
          // Fully release the sound so a future tap creates a fresh instance.
          setIsPlaying(false);
          setProgress(0);
          cleanup();
        }
      });
    } catch {
      setLoading(false);
    }
  }, [url, cleanup]);

  const fillColor = isMe ? 'rgba(15,13,12,0.85)' : Colors.accentPrimary;
  const dimColor = isMe ? 'rgba(15,13,12,0.28)' : Colors.borderStrong;

  return (
    <View style={styles.voiceRow}>
      <Pressable onPress={toggle} hitSlop={6} style={[styles.voicePlay, { backgroundColor: fillColor }]}>
        {loading ? (
          <ActivityIndicator size="small" color={isMe ? Colors.accentPrimary : '#fff'} />
        ) : (
          <Feather name={isPlaying ? 'pause' : 'play'} size={14} color={isMe ? Colors.accentPrimary : '#fff'} />
        )}
      </Pressable>
      <View style={styles.voiceWaveform}>
        {bars.map((h, i) => {
          const played = i / bars.length <= progress;
          return (
            <View
              key={i}
              style={[
                styles.voiceBar,
                {
                  height: 4 + h * 18,
                  backgroundColor: played ? fillColor : dimColor,
                  opacity: played ? 1 : 0.6,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.voiceTime, { color: isMe ? 'rgba(15,13,12,0.65)' : Colors.textMuted }]}>
        {fmtDuration(durationSec ?? 0)}
      </Text>
    </View>
  );
}

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
  const fb = useFeedback();
  const sendScale = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        messagesApi.thread(id),
        messagesApi.messages(id, { limit: 30 }),
      ]);
      setThread(tRes.data?.data);
      const msgs = mRes.data?.data ?? [];
      setMessages(msgs);
      // The first (oldest in returned slice) message id is our cursor for the next page.
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

  const handleIncoming = useCallback((msg: any) => {
    if (!msg?.id) return;
    let added = false;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      added = true;
      return [...prev, msg];
    });
    if (added && msg.senderId !== me?.id) fb.notification();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
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

  const { otherOnline, typingUserIds, emitTyping, markRead } = useThreadSocket(
    id,
    handleIncoming,
    { otherUserId: thread?.otherUser?.id, onReaction: handleReaction, onDeleted: handleDeleted },
  );

  useEffect(() => {
    if (!loading && messages.some((m) => m.senderId !== me?.id && !m.isRead)) {
      markRead();
    }
  }, [loading, messages, me?.id, markRead]);

  // Optimistic send: push a temp message immediately, then reconcile with the
  // server response. On failure, mark as failed so the user can retry inline.
  const sendPayload = useCallback(async (
    payload: { content?: string; imageUrl?: string; stickerKey?: string; audioUrl?: string; audioDurationSec?: number; replyToId?: string },
    opts: { tempId?: string } = {},
  ) => {
    setSending(true);
    fb.send();
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 90, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, damping: 12, stiffness: 320, useNativeDriver: true }),
    ]).start();
    const tempId = opts.tempId ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Insert optimistic bubble
    const optimistic = {
      id: tempId,
      senderId: me?.id,
      content: payload.content ?? null,
      imageUrl: payload.imageUrl ?? null,
      stickerKey: payload.stickerKey ?? null,
      audioUrl: payload.audioUrl ?? null,
      audioDurationSec: payload.audioDurationSec ?? null,
      replyToId: payload.replyToId ?? null,
      replyTo: payload.replyToId ? messages.find((x) => x.id === payload.replyToId) ?? null : null,
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
  }, [fb, id, me?.id, messages, sendScale]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    emitTyping(false);
    const replyId = replyTo?.id;
    setReplyTo(null);
    try {
      await sendPayload({ content: body, replyToId: replyId });
    } catch {
      // optimistic bubble keeps body — composer is empty already
    }
  }

  async function retrySend(msg: any) {
    if (!msg?._payload) return;
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, _status: 'sending' } : x)));
    try {
      await sendPayload(msg._payload, { tempId: msg.id });
    } catch {}
  }

  function discardFailed(msg: any) {
    setMessages((m) => m.filter((x) => x.id !== msg.id));
  }

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

  // ── Voice notes ───────────────────────────────
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
      recTimerRef.current = setInterval(() => setRecordingDur((d) => d + 1), 1000);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Recording failed');
    }
  }, [fb, t]);

  const cancelRecording = useCallback(async () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    setRecordingDur(0);
    try { await recording?.stopAndUnloadAsync(); } catch {}
    setRecording(null);
  }, [recording]);

  const stopAndSendRecording = useCallback(async () => {
    const rec = recording;
    if (!rec) return;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    const duration = recordingDur;
    setRecording(null);
    setRecordingDur(0);
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
  }, [recording, recordingDur, replyTo?.id, sendPayload, fb]);

  // ── Reactions ─────────────────────────────────
  const reactToMessage = useCallback(async (msg: any, emoji: string) => {
    if (!me?.id) return;
    const existing = (msg.reactions ?? []).some((r: any) => r.userId === me.id && r.emoji === emoji);
    // Optimistic
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msg.id) return m;
      const cur = m.reactions ?? [];
      const next = existing
        ? cur.filter((r: any) => !(r.userId === me.id && r.emoji === emoji))
        : [...cur, { userId: me.id, emoji }];
      return { ...m, reactions: next };
    }));
    fb.tap();
    try {
      if (existing) await messagesApi.unreact(msg.id, emoji);
      else await messagesApi.react(msg.id, emoji);
    } catch {
      // Revert on failure
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reactions: msg.reactions ?? [] } : m)));
    }
  }, [me?.id, fb]);

  // Double-tap heart
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

  // ── Long-press menu ────────────────────────────
  const openMenu = useCallback((msg: any) => {
    if (msg._status === 'sending' || msg._status === 'failed') return;
    fb.tap();
    setActionMsg(msg);
  }, [fb]);

  const menuCopy = useCallback(() => {
    if (actionMsg?.content) Clipboard.setString(actionMsg.content);
    setActionMsg(null);
  }, [actionMsg]);

  const menuReply = useCallback(() => {
    setReplyTo(actionMsg);
    setActionMsg(null);
  }, [actionMsg]);

  const menuDelete = useCallback(async () => {
    if (!actionMsg) return;
    const m = actionMsg;
    setActionMsg(null);
    if (m.senderId !== me?.id) return;
    Alert.alert(
      t ? 'Eliminar mensaje' : 'Delete message',
      t ? '¿Eliminar este mensaje? No se podrá recuperar.' : 'Delete this message? It cannot be recovered.',
      [
        { text: t ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: t ? 'Eliminar' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
            try { await messagesApi.deleteMessage(m.id); } catch {}
          },
        },
      ],
    );
  }, [actionMsg, me?.id, t]);

  // ── GIF picker ────────────────────────────────
  const searchGifs = useCallback(async (q: string) => {
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

  const other = thread?.otherUser;
  const isOtherTyping = !!other?.id && typingUserIds.has(other.id);
  const first = other?.profile?.firstName ?? '';
  const last = other?.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || 'Usuario';
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';

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

  const ThemAvatar = ({ visible }: { visible: boolean }) => {
    if (!visible) return <View style={styles.themAvatarSpacer} />;
    return other?.profile?.avatarUrl ? (
      <Image source={{ uri: other.profile.avatarUrl }} style={styles.themAvatar} />
    ) : (
      <View style={[styles.themAvatar, { backgroundColor: colorFor(other?.id || id) }]}>
        <Text style={styles.themAvatarText}>{initials}</Text>
      </View>
    );
  };

  const ReplyQuote = ({ q, isMe }: { q: any; isMe: boolean }) => {
    if (!q) return null;
    const isMyQuote = q.senderId === me?.id;
    const author = isMyQuote ? (t ? 'Tú' : 'You') : name;
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
          <Text style={[styles.replyAuthor, { color: isMe ? 'rgba(15,13,12,0.85)' : Colors.accentPrimary }]} numberOfLines={1}>
            {author}
          </Text>
          <Text style={[styles.replyPreview, { color: isMe ? 'rgba(15,13,12,0.75)' : Colors.textSecondary }]} numberOfLines={1}>
            {preview}
          </Text>
        </View>
        {q.imageUrl ? (
          <Image source={{ uri: q.imageUrl }} style={styles.replyQuoteThumb} />
        ) : q.stickerKey ? (
          <View style={styles.replyQuoteSticker}><Text style={{ fontSize: 22 }}>{q.stickerKey}</Text></View>
        ) : q.audioUrl ? (
          <View style={[styles.replyQuoteSticker, { backgroundColor: isMe ? 'rgba(15,13,12,0.18)' : Colors.bgElevated }]}>
            <Feather name="mic" size={14} color={isMe ? 'rgba(15,13,12,0.85)' : Colors.accentPrimary} />
          </View>
        ) : null}
      </View>
    );
  };

  // Aggregate reactions {emoji -> { count, mine }} for chip render.
  function aggReactions(reactions: any[]) {
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerMid}
            onPress={() => other?.id && router.push(`/(app)/users/${other.id}` as never)}
            activeOpacity={0.8}
          >
            <View style={{ position: 'relative' }}>
              {other?.profile?.avatarUrl
                ? <Image source={{ uri: other.profile.avatarUrl }} style={styles.headerAvatar} />
                : <View style={[styles.headerAvatar, { backgroundColor: colorFor(other?.id || id) }]}>
                    <Text style={styles.headerAvatarText}>{initials}</Text>
                  </View>}
              {otherOnline ? <View style={styles.onlineDot} /> : null}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
              <View style={styles.headerSubRow}>
                {isOtherTyping ? (
                  <>
                    <View style={[styles.statusDot, { backgroundColor: Colors.accentPrimary }]} />
                    <Text style={[styles.headerSub, { color: Colors.accentPrimary }]}>
                      {t ? 'Escribiendo…' : 'Typing…'}
                    </Text>
                  </>
                ) : otherOnline ? (
                  <>
                    <View style={[styles.statusDot, { backgroundColor: Colors.accentSuccess }]} />
                    <Text style={styles.headerSub}>{t ? 'En línea' : 'Online'}</Text>
                  </>
                ) : (
                  <>
                    <View style={[styles.statusDot, { backgroundColor: Colors.textMuted }]} />
                    <Text style={styles.headerSub}>{t ? 'Desconectado' : 'Offline'}</Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            hitSlop={10}
            onPress={() => other?.id && router.push(`/(app)/users/${other.id}` as never)}
          >
            <Feather name="more-vertical" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={timeline}
            keyExtractor={(x) => x.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onScroll={(e) => {
              if (e.nativeEvent.contentOffset.y < 80 && hasMore && !loadingMore) loadMore();
            }}
            scrollEventThrottle={300}
            ListHeaderComponent={loadingMore ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator color={Colors.accentPrimary} size="small" />
              </View>
            ) : null}
            renderItem={({ item }) => {
              if (item.type === 'date') {
                return (
                  <View style={styles.dateRow}>
                    <View style={styles.dateChip}>
                      <Text style={styles.dateText}>{dateLabel(item.at, t)}</Text>
                    </View>
                  </View>
                );
              }
              if (item.type === 'typing') return <TypingBubble />;

              const m = item.msg;
              const isMe = m.senderId === me?.id;
              const { isFirstInGroup, isLastInGroup, at } = item;
              const isSticker = !!m.stickerKey;
              const isImage = !!m.imageUrl && !isSticker;
              const isVoice = !!m.audioUrl && !isImage && !isSticker;
              const isFailed = m._status === 'failed';
              const isPending = m._status === 'sending';
              const reactions = aggReactions(m.reactions ?? []);

              const bubbleStyle = [
                styles.bubble,
                isImage ? styles.bubbleImage : isMe ? styles.bubbleMe : styles.bubbleThem,
                {
                  borderTopLeftRadius: !isMe && !isFirstInGroup ? 8 : 20,
                  borderTopRightRadius: isMe && !isFirstInGroup ? 8 : 20,
                  borderBottomLeftRadius: !isMe && !isLastInGroup ? 8 : isMe ? 20 : 6,
                  borderBottomRightRadius: isMe && !isLastInGroup ? 8 : isMe ? 6 : 20,
                },
                isPending && { opacity: 0.7 },
              ];

              const showMeta = isLastInGroup;
              const showReadTick = isMe && m.id === lastSentMineId;
              const isRead = isMe && m.id === lastReadMineId;

              return (
                <AnimatedMessage fromMe={isMe}>
                  <View
                    style={[
                      styles.msgRow,
                      isMe ? styles.msgRowMe : styles.msgRowThem,
                      { marginTop: isFirstInGroup ? 10 : 2 },
                    ]}
                  >
                    {!isMe && <ThemAvatar visible={isLastInGroup} />}

                    <View style={{ maxWidth: '78%' }}>
                      {isSticker ? (
                        <Pressable
                          onPress={() => handleBubbleTap(m)}
                          onLongPress={() => openMenu(m)}
                          delayLongPress={280}
                          style={[styles.stickerWrap, isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}
                        >
                          {m.replyTo && <ReplyQuote q={m.replyTo} isMe={isMe} />}
                          <Text style={styles.stickerGlyph}>{m.stickerKey}</Text>
                          {showMeta && (
                            <View style={styles.stickerMetaRow}>
                              <Text style={styles.bubbleTime}>{at ? fmtTime(at, language) : ''}</Text>
                              {showReadTick && (
                                <Feather
                                  name={isRead ? 'check-circle' : 'check'}
                                  size={11}
                                  color={isRead ? Colors.accentPrimary : Colors.textMuted}
                                  style={{ marginLeft: 4 }}
                                />
                              )}
                            </View>
                          )}
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => handleBubbleTap(m)}
                          onLongPress={() => openMenu(m)}
                          delayLongPress={280}
                          style={bubbleStyle}
                        >
                          {m.replyTo && <ReplyQuote q={m.replyTo} isMe={isMe} />}
                          {isImage ? (
                            <Pressable onPress={() => setLightboxUrl(m.imageUrl)} onLongPress={() => openMenu(m)}>
                              <Image
                                source={{ uri: m.imageUrl }}
                                style={styles.imageThumb}
                                resizeMode="cover"
                              />
                              {!!m.content && <Text style={styles.imageCaption}>{m.content}</Text>}
                            </Pressable>
                          ) : isVoice ? (
                            <VoiceBubble url={m.audioUrl} durationSec={m.audioDurationSec} isMe={isMe} />
                          ) : (
                            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                              {m.content}
                            </Text>
                          )}
                          {showMeta && (
                            <View style={[styles.metaRow, isImage && styles.metaRowOnImage]}>
                              <Text
                                style={[
                                  styles.bubbleTime,
                                  isMe && !isImage && styles.bubbleTimeMe,
                                  isImage && styles.bubbleTimeOnImage,
                                ]}
                              >
                                {at ? fmtTime(at, language) : ''}
                              </Text>
                              {isPending && (
                                <Feather name="clock" size={10} color={isMe ? 'rgba(15,13,12,0.55)' : Colors.textMuted} style={{ marginLeft: 4 }} />
                              )}
                              {showReadTick && !isPending && (
                                <Feather
                                  name={isRead ? 'check-circle' : 'check'}
                                  size={11}
                                  color={
                                    isImage ? '#fff'
                                      : isRead ? 'rgba(15,13,12,0.85)'
                                        : 'rgba(15,13,12,0.45)'
                                  }
                                  style={{ marginLeft: 4 }}
                                />
                              )}
                            </View>
                          )}
                        </Pressable>
                      )}

                      {/* Failed banner with retry */}
                      {isFailed && (
                        <View style={[styles.failedRow, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
                          <Feather name="alert-circle" size={12} color={Colors.accentDanger} />
                          <Text style={styles.failedText}>{t ? 'No se envió' : 'Not sent'}</Text>
                          <Pressable onPress={() => retrySend(m)} hitSlop={6}>
                            <Text style={styles.failedAction}>{t ? 'Reintentar' : 'Retry'}</Text>
                          </Pressable>
                          <Pressable onPress={() => discardFailed(m)} hitSlop={6}>
                            <Text style={[styles.failedAction, { color: Colors.textMuted }]}>{t ? 'Descartar' : 'Discard'}</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* Reaction chips */}
                      {reactions.length > 0 && (
                        <View style={[styles.reactionRow, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
                          {reactions.map((r) => (
                            <Pressable
                              key={r.emoji}
                              onPress={() => reactToMessage(m, r.emoji)}
                              style={[styles.reactionChip, r.mine && styles.reactionChipMine]}
                            >
                              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                              {r.count > 1 && <Text style={styles.reactionCount}>{r.count}</Text>}
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </AnimatedMessage>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Feather name="message-circle" size={28} color={Colors.accentPrimary} />
                </View>
                <Text style={styles.emptyTitle}>
                  {t ? 'Rompe el hielo' : 'Break the ice'}
                </Text>
                <Text style={styles.emptySub}>
                  {t ? 'Envía el primer mensaje a ' : 'Send the first message to '}
                  <Text style={styles.emptyName}>{name}</Text>
                </Text>
                <View style={styles.emptyHints}>
                  {(t
                    ? ['Hola 👋', '¿Qué tal?', '¡Nos vemos pronto!']
                    : ['Hi 👋', "What's up?", 'See you soon!']
                  ).map((s) => (
                    <Pressable
                      key={s}
                      style={({ pressed }) => [styles.hintChip, pressed && { opacity: 0.7 }]}
                      onPress={() => setText(s)}
                    >
                      <Text style={styles.hintText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
          />
        )}

        {/* Reply chip above composer */}
        {replyTo && (
          <View style={styles.replyComposeChip}>
            <View style={styles.replyComposeBar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyComposeAuthor}>
                <Feather name="corner-up-left" size={11} color={Colors.accentPrimary} />
                {'  '}
                {t ? 'Respondiendo a ' : 'Replying to '}
                <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.sansBold }}>
                  {replyTo.senderId === me?.id ? (t ? 'ti' : 'yourself') : name}
                </Text>
              </Text>
              <Text style={styles.replyComposePreview} numberOfLines={1}>
                {replyTo.content
                  ?? (replyTo.imageUrl ? (t ? '📷 Foto' : '📷 Photo')
                    : replyTo.audioUrl ? (t ? '🎤 Nota de voz' : '🎤 Voice note')
                      : replyTo.stickerKey ?? '…')}
              </Text>
            </View>
            {replyTo.imageUrl ? (
              <Image source={{ uri: replyTo.imageUrl }} style={styles.replyComposeThumb} />
            ) : replyTo.stickerKey ? (
              <View style={styles.replyComposeStickerThumb}>
                <Text style={{ fontSize: 26 }}>{replyTo.stickerKey}</Text>
              </View>
            ) : null}
            <Pressable onPress={() => setReplyTo(null)} hitSlop={10} style={styles.replyComposeClose}>
              <Feather name="x" size={16} color={Colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {/* Voice recording overlay (replaces composer while recording) */}
        {recording ? (
          <View style={styles.recordBar}>
            <RecordingPulse />
            <Text style={styles.recordTime}>{fmtDuration(recordingDur)}</Text>
            <Text style={styles.recordHint}>{t ? 'Grabando…' : 'Recording…'}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={cancelRecording} style={styles.recordCancel} hitSlop={8}>
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </Pressable>
            <Pressable onPress={stopAndSendRecording} style={styles.recordSend} hitSlop={8}>
              {uploadingAudio
                ? <ActivityIndicator size="small" color={Colors.textInverse} />
                : <Feather name="send" size={17} color={Colors.textInverse} />}
            </Pressable>
          </View>
        ) : (
          <View style={styles.compose}>
            <Pressable
              style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.7 }]}
              hitSlop={6}
              onPress={() => { fb.tap(); setAttachOpen(true); }}
              disabled={sending || uploadingImage || uploadingAudio}
            >
              {uploadingImage || uploadingAudio
                ? <ActivityIndicator size="small" color={Colors.accentPrimary} />
                : <Feather name="plus" size={20} color={Colors.textSecondary} />}
            </Pressable>
            <View style={[styles.composeInputWrap, composerFocused && styles.composeInputWrapFocus]}>
              <TextInput
                style={styles.composeInput}
                value={text}
                onChangeText={(v) => { setText(v); emitTyping(v.length > 0); }}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                placeholder={t ? 'Mensaje…' : 'Message…'}
                placeholderTextColor={Colors.textMuted}
                multiline
              />
              <Pressable
                style={({ pressed }) => [styles.stickerBtn, pressed && { opacity: 0.6 }]}
                hitSlop={6}
                onPress={() => { fb.tap(); setStickerOpen(true); }}
              >
                <Feather name="smile" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            {text.trim().length === 0 ? (
              <Pressable
                onPress={startRecording}
                style={({ pressed }) => [styles.micBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Feather name="mic" size={18} color={Colors.accentPrimary} />
              </Pressable>
            ) : (
              <Animated.View style={{ transform: [{ scale: sendScale }] }}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sendBtn,
                    sending && styles.sendBtnDisabled,
                    pressed && !sending && { opacity: 0.85 },
                  ]}
                  onPress={send}
                  disabled={sending}
                  hitSlop={8}
                >
                  {sending
                    ? <ActivityIndicator color={Colors.textInverse} size="small" />
                    : <Feather name="send" size={17} color={Colors.textInverse} />}
                </Pressable>
              </Animated.View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Attach action sheet */}
      <Modal visible={attachOpen} transparent animationType="fade" onRequestClose={() => setAttachOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setAttachOpen(false)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t ? 'Adjuntar' : 'Attach'}</Text>
            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]}
              onPress={() => pickAndSendImage('camera')}
            >
              <View style={[styles.sheetIcon, { backgroundColor: Colors.accentPrimary + '14', borderColor: Colors.accentPrimary + '33' }]}>
                <Feather name="camera" size={20} color={Colors.accentPrimary} />
              </View>
              <Text style={styles.sheetLabel}>{t ? 'Cámara' : 'Camera'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]}
              onPress={() => pickAndSendImage('library')}
            >
              <View style={[styles.sheetIcon, { backgroundColor: Colors.accentInfo + '14', borderColor: Colors.accentInfo + '33' }]}>
                <Feather name="image" size={20} color={Colors.accentInfo} />
              </View>
              <Text style={styles.sheetLabel}>{t ? 'Galería' : 'Photo library'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]}
              onPress={() => { setAttachOpen(false); setStickerOpen(true); }}
            >
              <View style={[styles.sheetIcon, { backgroundColor: Colors.accentChampagne + '14', borderColor: Colors.accentChampagne + '33' }]}>
                <Feather name="smile" size={20} color={Colors.accentChampagne} />
              </View>
              <Text style={styles.sheetLabel}>{t ? 'Sticker' : 'Sticker'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]}
              onPress={() => { setAttachOpen(false); setGifOpen(true); setGifQuery(''); }}
            >
              <View style={[styles.sheetIcon, { backgroundColor: '#A855F714', borderColor: '#A855F733' }]}>
                <Text style={{ color: '#A855F7', fontSize: 12, fontFamily: Typography.fontFamily.sansBold, letterSpacing: 0.5 }}>GIF</Text>
              </View>
              <Text style={styles.sheetLabel}>GIF</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sticker palette */}
      <Modal visible={stickerOpen} transparent animationType="fade" onRequestClose={() => setStickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setStickerOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t ? 'Stickers' : 'Stickers'}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <View style={styles.stickerGrid}>
                {STICKER_PACK.map((s) => (
                  <Pressable
                    key={s}
                    style={({ pressed }) => [styles.stickerCell, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
                    onPress={() => sendSticker(s)}
                  >
                    <Text style={styles.stickerCellGlyph}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* GIF picker */}
      <Modal visible={gifOpen} transparent animationType="fade" onRequestClose={() => setGifOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setGifOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: 24, maxHeight: '80%' }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>GIFs</Text>
            <View style={styles.gifSearchWrap}>
              <Feather name="search" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.gifSearch}
                value={gifQuery}
                onChangeText={setGifQuery}
                placeholder={t ? 'Busca GIFs…' : 'Search GIFs…'}
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>
            {gifLoading ? (
              <View style={{ padding: 32 }}><ActivityIndicator color={Colors.accentPrimary} /></View>
            ) : (
              <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={styles.gifGrid}>
                {gifs.map((g) => {
                  const url = g?.images?.fixed_height_small?.url ?? g?.images?.fixed_height?.url;
                  if (!url) return null;
                  return (
                    <Pressable key={g.id} onPress={() => sendGif(g)} style={styles.gifCell}>
                      <Image source={{ uri: url }} style={styles.gifImage} />
                    </Pressable>
                  );
                })}
                {gifs.length === 0 && (
                  <Text style={{ color: Colors.textMuted, padding: 24, textAlign: 'center', width: '100%' }}>
                    {t ? 'Sin resultados' : 'No results'}
                  </Text>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Image lightbox */}
      <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <Pressable style={styles.lightboxBackdrop} onPress={() => setLightboxUrl(null)}>
          {lightboxUrl ? (
            <Image source={{ uri: lightboxUrl }} style={styles.lightboxImage} resizeMode="contain" />
          ) : null}
          <Pressable style={styles.lightboxClose} onPress={() => setLightboxUrl(null)} hitSlop={12}>
            <Feather name="x" size={22} color={Colors.white} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Long-press action menu */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionMsg(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: 24 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.quickReactions}>
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => { if (actionMsg) reactToMessage(actionMsg, emoji); setActionMsg(null); }}
                  style={({ pressed }) => [styles.quickReactionBtn, pressed && { transform: [{ scale: 0.85 }] }]}
                >
                  <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]} onPress={menuReply}>
              <View style={[styles.sheetIcon, { backgroundColor: Colors.accentPrimary + '14', borderColor: Colors.accentPrimary + '33' }]}>
                <Feather name="corner-up-left" size={18} color={Colors.accentPrimary} />
              </View>
              <Text style={styles.sheetLabel}>{t ? 'Responder' : 'Reply'}</Text>
            </Pressable>
            {!!actionMsg?.content && (
              <Pressable style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]} onPress={menuCopy}>
                <View style={[styles.sheetIcon, { backgroundColor: Colors.accentInfo + '14', borderColor: Colors.accentInfo + '33' }]}>
                  <Feather name="copy" size={18} color={Colors.accentInfo} />
                </View>
                <Text style={styles.sheetLabel}>{t ? 'Copiar' : 'Copy'}</Text>
              </Pressable>
            )}
            {actionMsg?.senderId === me?.id && (
              <Pressable style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]} onPress={menuDelete}>
                <View style={[styles.sheetIcon, { backgroundColor: Colors.accentDanger + '14', borderColor: Colors.accentDanger + '33' }]}>
                  <Feather name="trash-2" size={18} color={Colors.accentDanger} />
                </View>
                <Text style={[styles.sheetLabel, { color: Colors.accentDanger }]}>{t ? 'Eliminar' : 'Delete'}</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderStrong,
    backgroundColor: Colors.bgPrimary,
    ...Shadows.sm,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flexDirection: 'row', alignItems: 'center', flex: 1, marginHorizontal: 4 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerAvatarText: { color: Colors.textInverse, fontSize: 14, fontFamily: Typography.fontFamily.sansBold },
  headerName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.serifSemiBold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  headerSub: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sansMedium,
  },
  onlineDot: {
    position: 'absolute', right: -1, bottom: -1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.accentSuccess,
    borderWidth: 2.5, borderColor: Colors.bgPrimary,
  },

  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  dateChip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  dateText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sansMedium,
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },

  msgRow: { flexDirection: 'row', paddingHorizontal: 4, alignItems: 'flex-end', gap: 6 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  themAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  themAvatarSpacer: { width: 26, marginBottom: 2 },
  themAvatarText: { color: Colors.textInverse, fontSize: 10, fontFamily: Typography.fontFamily.sansBold },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, ...Shadows.sm },
  bubbleMe: { backgroundColor: Colors.accentPrimary },
  bubbleThem: { backgroundColor: Colors.bgCard, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderStrong },
  bubbleImage: { backgroundColor: Colors.bgCard, padding: 3, overflow: 'hidden' },
  imageThumb: { width: 240, height: 240, borderRadius: 16, backgroundColor: Colors.bgElevated },
  imageCaption: {
    color: Colors.textPrimary, fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.base, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4,
  },
  metaRowOnImage: {
    position: 'absolute', right: 10, bottom: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bubbleTimeOnImage: { color: '#fff' },

  // Reply quote rendered inside a bubble
  replyQuote: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingRight: 6, paddingLeft: 8,
    borderRadius: 10, gap: 8, marginBottom: 8,
    minHeight: 36,
  },
  replyQuoteMe: { backgroundColor: 'rgba(15,13,12,0.10)' },
  replyQuoteThem: { backgroundColor: Colors.bgElevated },
  replyBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  replyAuthor: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sansBold,
    letterSpacing: 0.2, marginBottom: 2,
  },
  replyPreview: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sans,
  },
  replyQuoteThumb: {
    width: 30, height: 30, borderRadius: 6,
    backgroundColor: Colors.bgCard,
  },
  replyQuoteSticker: {
    width: 30, height: 30, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard,
  },

  // Reaction chips
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginHorizontal: 4, gap: 5 },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.borderStrong,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: Radius.full,
    ...Shadows.sm,
  },
  reactionChipMine: {
    backgroundColor: Colors.accentPrimary + '2A',
    borderColor: Colors.accentPrimary,
  },
  reactionEmoji: { fontSize: 14, lineHeight: 16 },
  reactionCount: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.sansBold,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },

  // Failed retry banner
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  failedText: { fontSize: 11, color: Colors.accentDanger, fontFamily: Typography.fontFamily.sansMedium },
  failedAction: { fontSize: 11, color: Colors.accentPrimary, fontFamily: Typography.fontFamily.sansBold, marginLeft: 4 },

  // Voice
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, minWidth: 200 },
  voicePlay: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  voiceWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    gap: 2,
  },
  voiceBar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 1.5,
  },
  voiceTime: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.sansMedium,
    minWidth: 32,
    textAlign: 'right',
    letterSpacing: 0.3,
  },

  stickerWrap: { paddingVertical: 4 },
  stickerGlyph: { fontSize: 78, lineHeight: 92 },
  stickerMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  bubbleText: {
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.snug,
    fontFamily: Typography.fontFamily.sans,
  },
  bubbleTextMe: { color: Colors.textInverse },
  bubbleTextThem: { color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-end' },
  bubbleTime: {
    color: Colors.textMuted, fontSize: 10,
    fontFamily: Typography.fontFamily.sansMedium, letterSpacing: 0.2,
  },
  bubbleTimeMe: { color: 'rgba(15,13,12,0.65)' },

  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 20, borderBottomLeftRadius: 6,
  },
  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.textSecondary },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.accentPrimary + '14',
    borderWidth: 1, borderColor: Colors.accentPrimary + '33',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.serifSemiBold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  emptySub: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.sans,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * Typography.lineHeight.snug,
  },
  emptyName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.sansSemiBold },
  emptyHints: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 },
  hintChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderStrong,
  },
  hintText: { color: Colors.textPrimary, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.sansMedium },

  // Reply-to chip above composer
  replyComposeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.accentPrimary + '44',
  },
  replyComposeBar: { width: 3, height: 34, backgroundColor: Colors.accentPrimary, borderRadius: 2 },
  replyComposeAuthor: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.sans,
    letterSpacing: 0.2,
  },
  replyComposePreview: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sansMedium,
    marginTop: 2,
  },
  replyComposeThumb: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.bgCard,
  },
  replyComposeStickerThumb: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  replyComposeClose: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderStrong,
  },

  compose: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderStrong,
    backgroundColor: Colors.bgPrimary,
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  composeInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.borderStrong,
    paddingLeft: 16, paddingRight: 4, paddingVertical: 4,
    minHeight: 42,
  },
  composeInputWrapFocus: { borderColor: Colors.accentPrimary + '88', backgroundColor: Colors.bgElevated },
  composeInput: {
    flex: 1, color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.sans,
    maxHeight: 120, paddingVertical: 6,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  sendBtnDisabled: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  micBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accentPrimary + '18',
    borderWidth: 1, borderColor: Colors.accentPrimary + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  stickerBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6, marginBottom: 2,
  },

  // Recording bar
  recordBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderStrong,
    backgroundColor: Colors.bgPrimary,
  },
  recordPulse: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.accentDanger,
  },
  recordTime: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.sansBold,
    minWidth: 50,
  },
  recordHint: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.sansMedium,
  },
  recordCancel: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  recordSend: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8, paddingBottom: 32, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: Colors.borderStrong,
    ...Shadows.lg,
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 16,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: Typography.fontSize.lg,
    letterSpacing: Typography.letterSpacing.tight,
    marginBottom: 8,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  sheetIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  sheetLabel: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.sansSemiBold, fontSize: Typography.fontSize.base },

  // Quick reactions row in long-press menu
  quickReactions: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderStrong,
    marginBottom: 4,
  },
  quickReactionBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  quickReactionEmoji: { fontSize: 28 },

  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: 8 },
  stickerCell: { width: '16.66%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginBottom: 6 },
  stickerCellGlyph: { fontSize: 36, lineHeight: 44 },

  // GIF picker
  gifSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.borderStrong,
    marginBottom: 12, marginTop: 4,
  },
  gifSearch: {
    flex: 1, color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.base,
    paddingVertical: 0,
  },
  gifGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 16 },
  gifCell: { width: '32%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.bgElevated },
  gifImage: { width: '100%', height: '100%' },

  lightboxBackdrop: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxClose: {
    position: 'absolute', top: 50, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
});
