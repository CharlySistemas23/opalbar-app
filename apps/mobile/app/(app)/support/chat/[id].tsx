// ─────────────────────────────────────────────
//  Support Chat — Editorial Premium
//
//  · Header: back + Kicker "SOPORTE" + Heading title + status dot
//  · Body: FlatList of message bubbles (parchment for them, amber for me)
//  · Empty/Error via EmptyState/ErrorState primitives
//  · Compose dock at bottom: TextInput + circular send button
// ─────────────────────────────────────────────
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { supportApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  SkeletonList,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

interface ChatMessage {
  id: string;
  content: string;
  senderId?: string;
  senderType?: string;
  createdAt?: string;
}

export default function SupportChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  async function load() {
    setLoadError(null);
    try {
      const r = await supportApi.messages(id);
      const msgs = (r.data?.data?.data ?? r.data?.data ?? []) as ChatMessage[];
      setMessages(msgs);
    } catch (err) {
      setLoadError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSend() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText('');
    try {
      await supportApi.sendMessage(id, { content: body });
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      toast(
        apiError(err, t ? 'No se pudo enviar el mensaje.' : 'Could not send the message.'),
        'danger',
      );
      setText(body);
    } finally {
      setSending(false);
    }
  }

  const canSend = text.trim().length > 0 && !sending;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Pressy
            onPress={() => router.back()}
            haptic="select"
            hitSlop={HitSlop.expand}
            accessibilityRole={Roles.button}
            accessibilityLabel="Volver"
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </Pressy>
          <View style={{ flex: 1 }}>
            <Kicker tone="muted">{t ? 'SOPORTE OPALBAR' : 'OPALBAR SUPPORT'}</Kicker>
            <View style={styles.titleRow}>
              <Heading size="sm">{t ? 'Conversación' : 'Conversation'}</Heading>
              <View style={styles.statusDot} />
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Hairline variant="subtle" />

        {loading ? (
          <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[4] }}>
            <SkeletonList count={4} itemHeight={64} />
          </View>
        ) : loadError && messages.length === 0 ? (
          <ErrorState
            message={loadError}
            retryLabel={t ? 'Reintentar' : 'Retry'}
            onRetry={() => {
              setLoading(true);
              load();
            }}
          />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isMe = item.senderId === user?.id || item.senderType === 'USER';
              return (
                <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Body
                      tone={isMe ? 'inverse' : 'primary'}
                      style={{ lineHeight: 21 }}
                    >
                      {item.content}
                    </Body>
                    {item.createdAt ? (
                      <Caption
                        tone={isMe ? 'inverse' : 'muted'}
                        align="right"
                        style={isMe ? [styles.bubbleTime, { opacity: 0.65 }] : [styles.bubbleTime]}
                      >
                        {new Date(item.createdAt).toLocaleTimeString(language, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Caption>
                    ) : null}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="message-circle"
                title={t ? 'Inicia la conversación' : 'Start the conversation'}
                message={
                  t
                    ? 'Cuéntanos cómo podemos ayudarte. Te respondemos cuanto antes.'
                    : 'Tell us how we can help. We will reply as soon as possible.'
                }
              />
            }
          />
        )}

        {/* ── Compose dock ─────────────────────── */}
        <Hairline variant="subtle" />
        <View style={styles.compose}>
          <TextInput
            style={styles.composeInput}
            placeholder={t ? 'Escribe un mensaje…' : 'Type a message…'}
            placeholderTextColor={Colors.textDisabled}
            value={text}
            onChangeText={setText}
            multiline
            accessibilityLabel={t ? 'Mensaje' : 'Message'}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            hitSlop={HitSlop.expand}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Enviar' : 'Send'}
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && { opacity: 0.4 },
              pressed && canSend && { opacity: 0.85 },
            ]}
          >
            {sending ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <Feather name="arrow-up" size={18} color={Colors.textInverse} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
    gap: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentSuccess,
  },

  list: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[5],
    gap: Spacing[3],
  },
  msgRow: { flexDirection: 'row' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[2],
    borderRadius: Radius.lg,
  },
  bubbleMe: {
    backgroundColor: Colors.accentPrimary,
    borderTopRightRadius: Radius.xs,
  },
  bubbleThem: {
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    borderTopLeftRadius: Radius.xs,
  },
  bubbleTime: {
    marginTop: Spacing[1],
    fontSize: 10,
  },

  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[3],
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgPrimary,
  },
  composeInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    color: Colors.textPrimary,
    ...TypePresets.body,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
