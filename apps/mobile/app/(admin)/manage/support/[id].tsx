import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, supportApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Button,
  Caption,
  Kicker,
  Sheet,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { AdminHeader, OptionSheet, StatusPill } from '@/components/admin';
import type { OptionSheetItem } from '@/components/admin';

const STATUS_TONE: Record<
  string,
  { tone: 'accent' | 'info' | 'success' | 'neutral'; label: string }
> = {
  OPEN: { tone: 'accent', label: 'ABIERTO' },
  IN_REVIEW: { tone: 'info', label: 'EN REVISIÓN' },
  WAITING_USER: { tone: 'neutral', label: 'ESPERA USER' },
  RESOLVED: { tone: 'success', label: 'RESUELTO' },
  CLOSED: { tone: 'neutral', label: 'CERRADO' },
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export default function SupportChatAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage/support');
  const me = useAuthStore((s) => s.user);
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [assigning, setAssigning] = useState(false);

  async function openTemplates() {
    setShowTemplates(true);
    if (templates.length > 0) return;
    setLoadingTemplates(true);
    try {
      const r = await adminApi.quickReplies();
      setTemplates(r.data?.data ?? r.data ?? []);
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally { setLoadingTemplates(false); }
  }

  function insertTemplate(body: string) {
    setText((prev) => (prev ? `${prev}\n\n${body}` : body));
    setShowTemplates(false);
  }

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setError(null);
    try {
      // Detail endpoint (not the paginated list) — a ticket past the first
      // page used to 404 as "no encontrado" because this fetched page 1 of
      // the list and did a client-side .find().
      const r = await adminApi.ticket(id);
      setTicket(r.data?.data ?? null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    setSending(true);
    try {
      await supportApi.sendMessage(id, { content: body });
      await load({ silent: true });
    } catch (err) {
      Alert.alert('Error', apiError(err));
      setText(body);
    } finally {
      setSending(false);
    }
  }

  async function updateTicket(patch: { status?: string; priority?: string; assignedToId?: string | null }) {
    const snapshot = ticket;
    setTicket((t: any) => (t ? { ...t, ...patch } : t));
    try {
      await adminApi.updateTicket(id, patch);
    } catch (err) {
      setTicket(snapshot);
      Alert.alert('Error', apiError(err));
    }
  }

  async function toggleAssignSelf() {
    if (assigning || !me) return;
    setAssigning(true);
    const mine = ticket?.assignedToId === me.id;
    await updateTicket({ assignedToId: mine ? null : me.id });
    setAssigning(false);
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  if (error && !ticket)
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <AdminHeader title="Ticket" kicker="Soporte" onBack={goBack} />
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      </SafeAreaView>
    );
  if (!ticket)
    return (
      <View style={styles.center}>
        <Caption tone="muted">Ticket no encontrado</Caption>
      </View>
    );

  const user = ticket.user;
  const name =
    `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() ||
    user?.email ||
    'Usuario';
  const st = STATUS_TONE[ticket.status] ?? STATUS_TONE.OPEN;
  const allMessages: any[] = Array.isArray(ticket.messages) ? ticket.messages : [];
  // The ticket has no `description` column — the opening request is simply
  // its first message. Show it as the pinned header, and the thread below
  // starts from the first reply so it isn't shown twice.
  const openingMessage = allMessages[0];
  const threadMessages = allMessages.slice(1);
  const assignedName = ticket.assignedTo
    ? `${ticket.assignedTo.profile?.firstName ?? ''} ${ticket.assignedTo.profile?.lastName ?? ''}`.trim() || ticket.assignedTo.email
    : null;
  const isAssignedToMe = !!me && ticket.assignedToId === me.id;

  const priorityOptions: OptionSheetItem<string>[] = (['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => ({
    value: p,
    label: PRIORITY_LABEL[p],
  }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <AdminHeader
          title={ticket.subject}
          kicker={name}
          onBack={goBack}
          right={<StatusPill label={st.label} tone={st.tone} />}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={styles.actionsBar} contentContainerStyle={{ gap: Spacing[2] }}>
          <ActionChip label="En proceso" active={ticket.status === 'IN_REVIEW'} onPress={() => updateTicket({ status: 'IN_REVIEW' })} />
          <ActionChip label="Espera user" active={ticket.status === 'WAITING_USER'} onPress={() => updateTicket({ status: 'WAITING_USER' })} />
          <ActionChip
            label="Resolver"
            active={ticket.status === 'RESOLVED'}
            onPress={() => updateTicket({ status: 'RESOLVED' })}
            tone="success"
          />
          <ActionChip
            label="Cerrar"
            active={ticket.status === 'CLOSED'}
            onPress={() =>
              Alert.alert('Cerrar ticket', '¿Cerrar este ticket? El usuario podrá reabrirlo si vuelve a escribir.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Cerrar', style: 'destructive', onPress: () => updateTicket({ status: 'CLOSED' }) },
              ])
            }
          />
          <ActionChip
            label={`Prioridad: ${PRIORITY_LABEL[ticket.priority] ?? '—'}`}
            onPress={() => setShowPriority(true)}
          />
          <ActionChip
            label={isAssignedToMe ? 'Desasignarme' : assignedName ? `De ${assignedName}` : 'Asignarme'}
            active={isAssignedToMe}
            disabled={assigning}
            onPress={toggleAssignSelf}
          />
        </ScrollView>

        <FlatList
          data={threadMessages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: Spacing[4], gap: Spacing[2] }}
          renderItem={({ item }) => {
            if (item.sender === 'SYSTEM') {
              return (
                <View style={styles.systemRow}>
                  <Caption tone="muted" size="sm" align="center">{item.content}</Caption>
                </View>
              );
            }
            // SupportMessage carries `sender: 'USER' | 'AGENT' | 'SYSTEM'`,
            // not a `userId` to compare against — that field doesn't exist.
            const fromUser = item.sender === 'USER';
            return (
              <View style={[styles.bubbleRow, !fromUser && styles.bubbleRowStaff]}>
                <View
                  style={[
                    styles.bubble,
                    fromUser ? styles.bubbleUser : styles.bubbleStaff,
                  ]}
                >
                  <Body size="sm" tone={fromUser ? 'primary' : 'inverse'}>
                    {item.content}
                  </Body>
                  <Caption
                    tone={fromUser ? 'muted' : 'inverse'}
                    size="sm"
                    style={{ marginTop: 4, opacity: fromUser ? 1 : 0.7 }}
                  >
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Caption>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={
            openingMessage ? (
              <View style={styles.ticketBody}>
                <Kicker tone="muted" style={{ marginBottom: 4 }}>Solicitud original</Kicker>
                <Body size="sm">{openingMessage.content}</Body>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Caption tone="muted" align="center" style={{ marginTop: Spacing[4] }}>
              Sin respuestas todavía.
            </Caption>
          }
        />

        <View style={styles.composer}>
          <Pressable
            style={({ pressed }) => [styles.zapBtn, pressed && styles.pressed]}
            onPress={openTemplates}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Plantillas"
          >
            <Feather name="zap" size={18} color={Colors.accentPrimary} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Escribe una respuesta..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!text.trim() || sending) && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={send}
            disabled={!text.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
          >
            {sending ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <Feather name="send" size={18} color={Colors.textInverse} />
            )}
          </Pressable>
        </View>

        <Sheet
          open={showTemplates}
          onClose={() => setShowTemplates(false)}
          title="Plantillas de respuesta"
        >
          <View style={{ gap: Spacing[3] }}>
            <View style={styles.tmplHead}>
              <Caption tone="muted">Toca para insertar en la respuesta</Caption>
              <Pressable
                style={({ pressed }) => [styles.tmplEditBtn, pressed && styles.pressed]}
                onPress={() => {
                  setShowTemplates(false);
                  router.push('/(admin)/manage/support/templates' as never);
                }}
                accessibilityRole="button"
                accessibilityLabel="Administrar plantillas"
              >
                <Feather name="edit-2" size={12} color={Colors.accentPrimary} />
                <Kicker tone="accent" style={{ fontSize: 10 }}>Administrar</Kicker>
              </Pressable>
            </View>
            {loadingTemplates ? (
              <ActivityIndicator color={Colors.accentPrimary} style={{ marginVertical: 40 }} />
            ) : templates.length === 0 ? (
              <View style={styles.tmplEmpty}>
                <Feather name="zap" size={32} color={Colors.textMuted} />
                <Caption tone="muted">Sin plantillas guardadas.</Caption>
                <Button
                  label="Crear primera plantilla"
                  variant="primary"
                  onPress={() => {
                    setShowTemplates(false);
                    router.push('/(admin)/manage/support/templates' as never);
                  }}
                  leftIcon={<Feather name="plus" size={14} color={Colors.textInverse} />}
                />
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 400 }}
                contentContainerStyle={{ gap: Spacing[2], paddingBottom: Spacing[5] }}
              >
                {templates.map((t) => (
                  <Pressable
                    key={t.id}
                    style={({ pressed }) => [styles.tmplRow, pressed && styles.pressed]}
                    onPress={() => insertTemplate(t.body)}
                    accessibilityRole="button"
                    accessibilityLabel={`Plantilla ${t.title}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Subhead>{t.title}</Subhead>
                      <Caption tone="muted" numberOfLines={2} style={{ marginTop: 4 }}>
                        {t.body}
                      </Caption>
                    </View>
                    <Feather name="plus-circle" size={18} color={Colors.accentPrimary} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </Sheet>

        <OptionSheet<string>
          open={showPriority}
          onClose={() => setShowPriority(false)}
          title="Prioridad del ticket"
          options={priorityOptions}
          value={ticket.priority}
          onSelect={(priority) => updateTicket({ priority })}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ActionChip({
  label,
  onPress,
  tone,
  active,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'success';
  active?: boolean;
  disabled?: boolean;
}) {
  const isSuccess = tone === 'success';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionChip,
        isSuccess && styles.actionResolve,
        active && !isSuccess && styles.actionActive,
        (pressed || disabled) && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      accessibilityLabel={label}
    >
      <Caption
        tone={isSuccess ? 'success' : active ? 'accent' : 'secondary'}
        size="sm"
        style={{ fontWeight: '700' }}
      >
        {label}
      </Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  actionsBar: {
    flexGrow: 0,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  actionChip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  actionResolve: {
    backgroundColor: 'rgba(111,168,138,0.14)',
    borderColor: Colors.accentSuccess,
  },
  actionActive: {
    backgroundColor: 'rgba(201,169,97,0.14)',
    borderColor: Colors.accentPrimary,
  },
  systemRow: { alignItems: 'center', paddingVertical: 4 },

  ticketBody: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: 6,
  },

  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowStaff: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.xl,
  },
  bubbleUser: {
    backgroundColor: Colors.bgCard,
    borderBottomLeftRadius: Radius.sm,
  },
  bubbleStaff: {
    backgroundColor: Colors.accentPrimary,
    borderBottomRightRadius: Radius.sm,
  },

  composer: {
    flexDirection: 'row',
    gap: Spacing[2],
    alignItems: 'flex-end',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zapBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(201,169,97,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,97,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sheet content
  tmplHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tmplEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing[2],
    paddingVertical: 6,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,97,0.30)',
  },
  tmplEmpty: { alignItems: 'center', padding: Spacing[6], gap: Spacing[2] },
  tmplRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing[3],
  },
});
