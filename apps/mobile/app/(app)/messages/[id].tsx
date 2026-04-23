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
} from 'react-native';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { messagesApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { useThreadSocket } from '@/hooks/useThreadSocket';
import { useFeedback } from '@/hooks/useFeedback';

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#6FB892', '#E06868', '#EC4899'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── Helpers ─────────────────────────────────────────
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

// ─── Typing indicator (3 bouncing dots) ──────────────
function TypingBubble() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(v, {
            toValue: 1,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={[styles.msgRow, styles.msgRowThem]}>
      <View style={[styles.bubble, styles.bubbleThem, styles.typingBubble]}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                opacity: v,
                transform: [{ scale: v.interpolate({ inputRange: [0.3, 1], outputRange: [0.7, 1] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Prepare grouped messages with date separators ───
// Groups consecutive messages from same sender within 5 min.
// Inserts a synthetic { type: 'date' } row whenever the day changes.
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
  const listRef = useRef<FlatList>(null);
  const fb = useFeedback();

  const load = useCallback(async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        messagesApi.thread(id),
        messagesApi.messages(id),
      ]);
      setThread(tRes.data?.data);
      setMessages(mRes.data?.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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

  const { otherOnline, typingUserIds, emitTyping, markRead } = useThreadSocket(
    id,
    handleIncoming,
    { otherUserId: thread?.otherUser?.id },
  );

  useEffect(() => {
    if (!loading && messages.some((m) => m.senderId !== me?.id && !m.isRead)) {
      markRead();
    }
  }, [loading, messages, me?.id, markRead]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText('');
    emitTyping(false);
    fb.send();
    try {
      const r = await messagesApi.send(id, body);
      const newMsg = r.data?.data;
      if (newMsg) {
        setMessages((m) => (m.some((x) => x.id === newMsg.id) ? m : [...m, newMsg]));
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      fb.error();
      setText(body);
    } finally {
      setSending(false);
    }
  }

  const other = thread?.otherUser;
  const isOtherTyping = !!other?.id && typingUserIds.has(other.id);
  const first = other?.profile?.firstName ?? '';
  const last = other?.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || 'Usuario';
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';

  const timeline = useMemo(() => {
    const tl = buildTimeline(messages);
    if (isOtherTyping) {
      tl.push({ type: 'typing', id: '__typing__' });
    }
    return tl;
  }, [messages, isOtherTyping]);

  // Find last "read" msg index (mine) — only show ✓✓ on that one, IG-style.
  const lastReadMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId === me?.id && m.isRead) return m.id;
    }
    return null;
  }, [messages, me?.id]);
  const lastSentMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === me?.id) return messages[i].id;
    }
    return null;
  }, [messages, me?.id]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerMid}
            onPress={() => other?.id && router.push(`/(app)/users/${other.id}` as never)}
            activeOpacity={0.8}
          >
            <View style={{ position: 'relative' }}>
              {other?.profile?.avatarUrl
                ? <Image source={{ uri: other.profile.avatarUrl }} style={styles.avatar36} />
                : <View style={[styles.avatar36, { backgroundColor: colorFor(other?.id || id) }]}>
                    <Text style={styles.avatar36Text}>{initials}</Text>
                  </View>}
              {otherOnline ? <View style={styles.onlineDot} /> : null}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {isOtherTyping
                  ? (t ? 'Escribiendo…' : 'Typing…')
                  : otherOnline
                    ? (t ? 'En línea' : 'Online')
                    : (t ? 'Desconectado' : 'Offline')}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={timeline}
            keyExtractor={(x) => x.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              // Date separator
              if (item.type === 'date') {
                return (
                  <View style={styles.dateRow}>
                    <View style={styles.dateHairline} />
                    <Text style={styles.dateText}>{dateLabel(item.at, t)}</Text>
                    <View style={styles.dateHairline} />
                  </View>
                );
              }
              // Typing
              if (item.type === 'typing') {
                return <TypingBubble />;
              }
              // Regular message
              const m = item.msg;
              const isMe = m.senderId === me?.id;
              const { isFirstInGroup, isLastInGroup, at } = item;

              // Corner radii based on group position — IG style stacking
              const bubbleStyle = [
                styles.bubble,
                isMe ? styles.bubbleMe : styles.bubbleThem,
                {
                  borderTopLeftRadius: !isMe && !isFirstInGroup ? 6 : 18,
                  borderTopRightRadius: isMe && !isFirstInGroup ? 6 : 18,
                  borderBottomLeftRadius: !isMe && !isLastInGroup ? 6 : isMe ? 18 : 4,
                  borderBottomRightRadius: isMe && !isLastInGroup ? 6 : isMe ? 4 : 18,
                },
              ];

              const showMeta = isLastInGroup;
              const showReadTick = isMe && m.id === lastSentMineId;
              const isRead = isMe && m.id === lastReadMineId;

              return (
                <View
                  style={[
                    styles.msgRow,
                    isMe ? styles.msgRowMe : styles.msgRowThem,
                    { marginTop: isFirstInGroup ? 8 : 2 },
                  ]}
                >
                  <View style={bubbleStyle}>
                    <Text style={[styles.bubbleText, isMe && { color: Colors.textInverse }]}>
                      {m.content}
                    </Text>
                    {showMeta && (
                      <View style={styles.metaRow}>
                        <Text style={[styles.bubbleTime, isMe && { color: 'rgba(0,0,0,0.55)' }]}>
                          {at ? fmtTime(at, language) : ''}
                        </Text>
                        {showReadTick && (
                          <Feather
                            name={isRead ? 'check-circle' : 'check'}
                            size={11}
                            color={isRead ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)'}
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Feather name="message-circle" size={28} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>
                  {t ? 'Rompe el hielo' : 'Break the ice'}
                </Text>
                <Text style={styles.emptySub}>
                  {t ? 'Envía el primer mensaje a ' : 'Send the first message to '}
                  <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>{name}</Text>
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.compose}>
          <View style={styles.composeInputWrap}>
            <TextInput
              style={styles.composeInput}
              value={text}
              onChangeText={(v) => { setText(v); emitTyping(v.length > 0); }}
              placeholder={t ? 'Mensaje…' : 'Message…'}
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!text.trim() || sending) && { opacity: 0.35 },
              pressed && text.trim() && !sending && { transform: [{ scale: 0.92 }] },
            ]}
            onPress={send}
            disabled={!text.trim() || sending}
            hitSlop={8}
          >
            {sending
              ? <ActivityIndicator color={Colors.textInverse} size="small" />
              : <Feather name="send" size={17} color={Colors.textInverse} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerMid: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginHorizontal: 6 },
  avatar36: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar36Text: { color: Colors.textInverse, fontSize: 13, fontWeight: '800' },
  headerName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  headerSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 1 },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: Colors.accentSuccess,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },

  // Date separators
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
    paddingHorizontal: 8,
  },
  dateHairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dateText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },

  // Message bubbles
  msgRow: { flexDirection: 'row', paddingHorizontal: 4 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleMe: { backgroundColor: Colors.accentPrimary },
  bubbleThem: { backgroundColor: Colors.bgCard },
  bubbleText: { color: Colors.textPrimary, fontSize: 14.5, lineHeight: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  bubbleTime: { color: Colors.textMuted, fontSize: 10, fontWeight: '500' },

  // Typing
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  emptySub: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Composer
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  composeInputWrap: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    minHeight: 42,
    justifyContent: 'center',
  },
  composeInput: {
    color: Colors.textPrimary,
    fontSize: 14.5,
    maxHeight: 120,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
});
