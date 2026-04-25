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
} from 'react-native';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { messagesApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius, Shadows, Typography } from '@/constants/tokens';
import { useThreadSocket } from '@/hooks/useThreadSocket';
import { useFeedback } from '@/hooks/useFeedback';
import { uploadImage } from '@/utils/uploadImage';

// Curated sticker palette — emoji-based, no asset bundling needed.
// stickerKey is just the emoji, rendered large (80px) on a transparent bubble.
const STICKER_PACK = [
  '🔥', '💖', '😂', '🥳', '😍', '😎',
  '🍻', '🥂', '🍷', '🎉', '✨', '⭐',
  '👀', '👋', '🙌', '👏', '💯', '💃',
  '🕺', '🎶', '🎵', '🎁', '💋', '😘',
  '😭', '🤣', '😅', '🫶', '❤️‍🔥', '💕',
];

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
    <View style={[styles.msgRow, styles.msgRowThem, { marginTop: 4 }]}>
      <View style={styles.themAvatarSpacer} />
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

// ─── Animated message wrapper — soft fade + slide on mount ────
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

// ─── Prepare grouped messages with date separators ───
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
  const [composerFocused, setComposerFocused] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const fb = useFeedback();

  // Send button bounce on tap
  const sendScale = useRef(new Animated.Value(1)).current;

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

  async function sendPayload(payload: { content?: string; imageUrl?: string; stickerKey?: string }) {
    setSending(true);
    fb.send();
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 90, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, damping: 12, stiffness: 320, useNativeDriver: true }),
    ]).start();
    try {
      const r = await messagesApi.send(id, payload);
      const newMsg = r.data?.data;
      if (newMsg) {
        setMessages((m) => (m.some((x) => x.id === newMsg.id) ? m : [...m, newMsg]));
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      fb.error();
      throw new Error('send failed');
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    emitTyping(false);
    try {
      await sendPayload({ content: body });
    } catch {
      setText(body);
    }
  }

  async function pickAndSendImage(source: 'camera' | 'library') {
    setAttachOpen(false);
    try {
      // Permission gating
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
      await sendPayload({ imageUrl: url });
    } catch (err: any) {
      fb.error();
      Alert.alert('Error', err?.message ?? 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  }

  async function sendSticker(emoji: string) {
    setStickerOpen(false);
    try {
      await sendPayload({ stickerKey: emoji });
    } catch {}
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

  // Tiny avatar component used next to "them" bubbles on group end
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

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header — premium with serif name */}
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
              if (item.type === 'typing') {
                return <TypingBubble />;
              }
              const m = item.msg;
              const isMe = m.senderId === me?.id;
              const { isFirstInGroup, isLastInGroup, at } = item;
              const isSticker = !!m.stickerKey;
              const isImage = !!m.imageUrl && !isSticker;

              // Tail radius — sharper corner on the speaker side at group end
              const bubbleStyle = [
                styles.bubble,
                isImage ? styles.bubbleImage : isMe ? styles.bubbleMe : styles.bubbleThem,
                {
                  borderTopLeftRadius: !isMe && !isFirstInGroup ? 8 : 20,
                  borderTopRightRadius: isMe && !isFirstInGroup ? 8 : 20,
                  borderBottomLeftRadius: !isMe && !isLastInGroup ? 8 : isMe ? 20 : 6,
                  borderBottomRightRadius: isMe && !isLastInGroup ? 8 : isMe ? 6 : 20,
                },
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

                    {isSticker ? (
                      // Sticker — no bubble, big emoji + meta row underneath
                      <View style={[styles.stickerWrap, isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
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
                      </View>
                    ) : (
                      <View style={bubbleStyle}>
                        {isImage ? (
                          <Pressable onPress={() => setLightboxUrl(m.imageUrl)}>
                            <Image
                              source={{ uri: m.imageUrl }}
                              style={styles.imageThumb}
                              resizeMode="cover"
                            />
                            {!!m.content && (
                              <Text style={styles.imageCaption}>{m.content}</Text>
                            )}
                          </Pressable>
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
                            {showReadTick && (
                              <Feather
                                name={isRead ? 'check-circle' : 'check'}
                                size={11}
                                color={
                                  isImage
                                    ? '#fff'
                                    : isRead
                                      ? 'rgba(15,13,12,0.85)'
                                      : 'rgba(15,13,12,0.45)'
                                }
                                style={{ marginLeft: 4 }}
                              />
                            )}
                          </View>
                        )}
                      </View>
                    )}
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

        {/* Composer — premium with focus ring + attachment slot */}
        <View style={styles.compose}>
          <Pressable
            style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.7 }]}
            hitSlop={6}
            onPress={() => { fb.tap(); setAttachOpen(true); }}
            disabled={sending || uploadingImage}
          >
            {uploadingImage
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
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                (!text.trim() || sending) && styles.sendBtnDisabled,
                pressed && text.trim() && !sending && { opacity: 0.85 },
              ]}
              onPress={send}
              disabled={!text.trim() || sending}
              hitSlop={8}
            >
              {sending
                ? <ActivityIndicator color={Colors.textInverse} size="small" />
                : <Feather name="send" size={17} color={text.trim() ? Colors.textInverse : Colors.textMuted} />}
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {/* Attach action sheet — camera / library */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header ────────────────────────────────────
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
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerMid: { flexDirection: 'row', alignItems: 'center', flex: 1, marginHorizontal: 4 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerAvatarText: { color: Colors.textInverse, fontSize: 14, fontFamily: Typography.fontFamily.sansBold },
  headerName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.serifSemiBold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  headerSub: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sansMedium,
  },
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

  // ── Date separators (chip style) ────────────
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
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

  // ── Message bubbles ─────────────────────────
  msgRow: { flexDirection: 'row', paddingHorizontal: 4, alignItems: 'flex-end', gap: 6 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  themAvatar: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  themAvatarSpacer: { width: 26, marginBottom: 2 },
  themAvatarText: {
    color: Colors.textInverse,
    fontSize: 10,
    fontFamily: Typography.fontFamily.sansBold,
  },
  bubble: {
    maxWidth: '74%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Shadows.sm,
  },
  bubbleMe: {
    backgroundColor: Colors.accentPrimary,
  },
  bubbleThem: {
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  bubbleImage: {
    backgroundColor: Colors.bgCard,
    padding: 4,
    overflow: 'hidden',
  },
  imageThumb: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: Colors.bgElevated,
  },
  imageCaption: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.base,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
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
  bubbleTimeOnImage: { color: '#fff' },

  // Sticker (no bubble)
  stickerWrap: {
    maxWidth: '74%',
    paddingVertical: 4,
  },
  stickerGlyph: {
    fontSize: 78,
    lineHeight: 92,
  },
  stickerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  bubbleText: {
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.snug,
    fontFamily: Typography.fontFamily.sans,
  },
  bubbleTextMe: { color: Colors.textInverse },
  bubbleTextThem: { color: Colors.textPrimary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTime: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: Typography.fontFamily.sansMedium,
    letterSpacing: 0.2,
  },
  bubbleTimeMe: { color: 'rgba(15,13,12,0.65)' },

  // ── Typing ─────────────────────────────────
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.textSecondary,
  },

  // ── Empty state ────────────────────────────
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentPrimary + '14',
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
  emptyName: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sansSemiBold,
  },
  emptyHints: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  hintChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  hintText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.sansMedium,
  },

  // ── Composer ───────────────────────────────
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
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
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: 42,
    justifyContent: 'center',
  },
  composeInputWrapFocus: {
    borderColor: Colors.accentPrimary + '88',
    backgroundColor: Colors.bgElevated,
  },
  composeInput: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.sans,
    maxHeight: 120,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stickerBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },

  // ── Attach action sheet ─────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderStrong,
    ...Shadows.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: Typography.fontSize.lg,
    letterSpacing: Typography.letterSpacing.tight,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  sheetIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  sheetLabel: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: Typography.fontSize.base,
  },

  // ── Sticker grid ────────────────────────────
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  stickerCell: {
    width: '16.66%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 6,
  },
  stickerCellGlyph: {
    fontSize: 36,
    lineHeight: 44,
  },

  // ── Lightbox ────────────────────────────────
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  lightboxClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
});
