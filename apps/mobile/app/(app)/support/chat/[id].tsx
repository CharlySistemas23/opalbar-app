// ─────────────────────────────────────────────
//  Support Chat — Editorial Premium
//
//  · Header: back + Kicker "SOPORTE" + real ticket subject + status dot
//    (+ "Cerrar ticket" action while the ticket is still open)
//  · Body: FlatList of message bubbles (parchment for them, amber for me,
//    centered caption for SYSTEM notes) with the agent's name/avatar shown
//    above their bubbles
//  · Empty/Error via EmptyState/ErrorState primitives
//  · Live: agent replies arrive via useRealtime('ticket') — no polling
//  · Compose dock: optimistic send; disabled once CLOSED/RESOLVED
// ─────────────────────────────────────────────
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { useRealtime } from '@/hooks/useRealtime';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  ConfirmDialog,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  SkeletonList,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

type Sender = 'USER' | 'AGENT' | 'SYSTEM';

interface ChatMessage {
  id: string;
  content: string;
  senderId?: string;
  sender?: Sender;
  createdAt?: string;
  senderUser?: {
    id: string;
    role?: string;
    profile?: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null;
  } | null;
}

interface TicketDetail {
  id: string;
  subject?: string;
  status?: string;
  category?: string;
  assignedTo?: {
    id: string;
    profile?: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null;
  } | null;
}

const TERMINAL_STATUSES = new Set(['RESOLVED', 'CLOSED']);

const STATUS_LABEL: Record<string, { es: string; en: string }> = {
  OPEN: { es: 'Abierto', en: 'Open' },
  IN_REVIEW: { es: 'En revisión', en: 'In review' },
  WAITING_USER: { es: 'Esperando tu respuesta', en: 'Waiting on you' },
  RESOLVED: { es: 'Resuelto', en: 'Resolved' },
  CLOSED: { es: 'Cerrado', en: 'Closed' },
};

function agentName(u: ChatMessage['senderUser'], t: boolean) {
  const p = u?.profile;
  const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();
  return name || (t ? 'Soporte OPALBAR' : 'OPALBAR Support');
}

export default function SupportChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const listRef = useRef<FlatList>(null);
  const scrolledOnce = useRef(false);

  async function load() {
    setLoadError(null);
    try {
      const [ticketRes, msgsRes] = await Promise.all([
        supportApi.ticket(id),
        supportApi.messages(id),
      ]);
      setTicket(ticketRes.data?.data ?? null);
      const msgs = (msgsRes.data?.data?.data ?? msgsRes.data?.data ?? []) as ChatMessage[];
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

  // Scroll to the bottom once, right after the first page of messages lands.
  useEffect(() => {
    if (!loading && messages.length > 0 && !scrolledOnce.current) {
      scrolledOnce.current = true;
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    }
  }, [loading, messages.length]);

  // Live: agent replies / status changes for THIS ticket. The envelope
  // carries either { message, status } (new message) or the whole updated
  // ticket record (close / reassign / status change) — both have `status`.
  useRealtime('ticket', (env) => {
    if (env.id !== id) return;
    const data: any = env.data ?? {};
    if (data.message?.id) {
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message],
      );
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
    if (data.status) {
      setTicket((prev) => (prev ? { ...prev, status: data.status } : prev));
    }
  });

  const isTerminal = !!ticket?.status && TERMINAL_STATUSES.has(ticket.status);

  async function handleSend() {
    const body = text.trim();
    if (!body || sending) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      content: body,
      senderId: user?.id,
      sender: 'USER',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setSending(true);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    try {
      const res = await supportApi.sendMessage(id, { content: body });
      const real = res.data?.data;
      setMessages((prev) =>
        real?.id ? prev.map((m) => (m.id === tempId ? real : m)) : prev,
      );
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast(
        apiError(err, t ? 'No se pudo enviar el mensaje.' : 'Could not send the message.'),
        'danger',
      );
      setText(body);
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    await supportApi.closeTicket(id);
    setTicket((prev) => (prev ? { ...prev, status: 'CLOSED' } : prev));
    setConfirmClose(false);
    toast(t ? 'Ticket cerrado.' : 'Ticket closed.', 'success');
  }

  const canSend = text.trim().length > 0 && !sending && !isTerminal;
  const statusLabel = ticket?.status ? STATUS_LABEL[ticket.status]?.[language] : undefined;

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
              <Heading size="sm" numberOfLines={1} style={{ flex: 1 }}>
                {ticket?.subject || (t ? 'Conversación' : 'Conversation')}
              </Heading>
              {ticket ? (
                <View
                  style={[styles.statusDot, isTerminal && { backgroundColor: Colors.textMuted }]}
                />
              ) : null}
            </View>
            {statusLabel ? (
              <Caption tone="muted" style={{ marginTop: 2 }} numberOfLines={1}>
                {statusLabel}
              </Caption>
            ) : null}
          </View>
          {ticket && !isTerminal ? (
            <Pressy
              onPress={() => setConfirmClose(true)}
              haptic="select"
              hitSlop={HitSlop.expand}
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Cerrar ticket' : 'Close ticket'}
              style={styles.closeBtn}
            >
              <Feather name="x-circle" size={20} color={Colors.textSecondary} />
            </Pressy>
          ) : (
            <View style={{ width: 40 }} />
          )}
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
            onContentSizeChange={() => {
              if (scrolledOnce.current) listRef.current?.scrollToEnd({ animated: false });
            }}
            renderItem={({ item, index }) => {
              if (item.sender === 'SYSTEM') {
                return (
                  <View style={styles.systemRow}>
                    <Caption tone="muted" align="center">{item.content}</Caption>
                  </View>
                );
              }
              const isMe = item.sender ? item.sender === 'USER' : item.senderId === user?.id;
              const isAgent = item.sender === 'AGENT';
              const prev = messages[index - 1];
              const showAgentHeader = isAgent && prev?.sender !== 'AGENT';
              return (
                <View>
                  {showAgentHeader ? (
                    <View style={styles.agentHeaderRow}>
                      {item.senderUser?.profile?.avatarUrl ? (
                        <Image
                          source={{ uri: item.senderUser.profile.avatarUrl }}
                          style={styles.agentAvatar}
                        />
                      ) : (
                        <View style={[styles.agentAvatar, styles.agentAvatarFallback]}>
                          <Feather name="headphones" size={12} color={Colors.accentPrimary} />
                        </View>
                      )}
                      <Body size="sm" tone="secondary" weight="semiBold">
                        {agentName(item.senderUser, t)}
                      </Body>
                    </View>
                  ) : null}
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
        {isTerminal ? (
          <View style={styles.closedBanner}>
            <Feather name="lock" size={14} color={Colors.textMuted} />
            <Caption tone="muted">
              {t
                ? 'Este ticket está cerrado. Abre uno nuevo si necesitas ayuda otra vez.'
                : 'This ticket is closed. Open a new one if you need help again.'}
            </Caption>
          </View>
        ) : (
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
        )}
      </KeyboardAvoidingView>

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={handleClose}
        title={t ? '¿Cerrar este ticket?' : 'Close this ticket?'}
        description={
          t
            ? 'No podrás enviar más mensajes en esta conversación. Puedes abrir un ticket nuevo cuando quieras.'
            : "You won't be able to send more messages here. You can open a new ticket anytime."
        }
        confirmLabel={t ? 'Cerrar ticket' : 'Close ticket'}
        cancelLabel={t ? 'Cancelar' : 'Cancel'}
      />
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
  closeBtn: {
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
  systemRow: {
    paddingVertical: Spacing[1],
  },
  agentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[1],
    marginTop: Spacing[1],
  },
  agentAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.bgElevated,
  },
  agentAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
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
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
    backgroundColor: Colors.bgPrimary,
  },
});
