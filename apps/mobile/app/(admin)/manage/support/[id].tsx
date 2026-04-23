import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, ScrollView } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { apiClient, adminApi, supportApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  OPEN: { bg: 'rgba(244,163,64,0.15)', color: Colors.accentPrimary, label: 'ABIERTO' },
  IN_REVIEW: { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA', label: 'EN REVISIÓN' },
  WAITING_USER: { bg: 'rgba(168,85,247,0.15)', color: '#A855F7', label: 'ESPERA USER' },
  RESOLVED: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'RESUELTO' },
  CLOSED: { bg: 'rgba(107,107,120,0.15)', color: Colors.textMuted, label: 'CERRADO' },
};

export default function SupportChatAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage/support');
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  async function openTemplates() {
    setShowTemplates(true);
    if (templates.length > 0) return;
    setLoadingTemplates(true);
    try {
      const r = await adminApi.quickReplies();
      setTemplates(r.data?.data ?? r.data ?? []);
    } catch {} finally { setLoadingTemplates(false); }
  }

  function insertTemplate(body: string) {
    setText((prev) => prev ? `${prev}\n\n${body}` : body);
    setShowTemplates(false);
  }

  const load = useCallback(async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        apiClient.get(`/admin/support/tickets`).catch(() => null),
        supportApi.messages(id).catch(() => null),
      ]);
      const list = tRes?.data?.data?.data ?? tRes?.data?.data ?? [];
      setTicket(list.find((t: any) => t.id === id) ?? null);
      const ms = mRes?.data?.data ?? [];
      setMessages(Array.isArray(ms) ? ms : []);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    setSending(true);
    try {
      await supportApi.sendMessage(id, { content: body });
      await load();
    } catch (err) {
      Alert.alert('Error', apiError(err));
      setText(body);
    } finally { setSending(false); }
  }

  async function updateStatus(status: string) {
    try {
      await apiClient.patch(`/admin/support/tickets/${id}`, { status });
      setTicket((t: any) => t ? { ...t, status } : t);
    } catch (err) { Alert.alert('Error', apiError(err)); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (!ticket) return <View style={styles.center}><Text style={{ color: Colors.textMuted }}>Ticket no encontrado</Text></View>;

  const user = ticket.user;
  const name = `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || user?.email || 'Usuario';
  const st = STATUS_META[ticket.status] ?? STATUS_META.OPEN;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={goBack} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{ticket.subject}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{name}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={styles.actionsBar}>
          <TouchableOpacity style={styles.actionChip} onPress={() => updateStatus('IN_REVIEW')}>
            <Text style={styles.actionChipLbl}>En proceso</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionChip} onPress={() => updateStatus('WAITING_USER')}>
            <Text style={styles.actionChipLbl}>Espera user</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionChip, styles.actionResolve]} onPress={() => updateStatus('RESOLVED')}>
            <Text style={styles.actionResolveLbl}>Resolver</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const fromUser = item.userId === ticket.userId;
            return (
              <View style={[styles.bubbleRow, !fromUser && styles.bubbleRowStaff]}>
                <View style={[styles.bubble, fromUser ? styles.bubbleUser : styles.bubbleStaff]}>
                  <Text style={[styles.bubbleText, !fromUser && styles.bubbleTextStaff]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.bubbleTime, !fromUser && styles.bubbleTimeStaff]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={
            <View style={styles.ticketBody}>
              <Text style={styles.ticketDesc}>{ticket.description}</Text>
            </View>
          }
        />

        <View style={styles.composer}>
          <TouchableOpacity style={styles.zapBtn} onPress={openTemplates} hitSlop={8}>
            <Feather name="zap" size={18} color={Colors.accentPrimary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Escribe una respuesta…"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color={Colors.textInverse} size="small" />
              : <Feather name="send" size={18} color={Colors.textInverse} />}
          </TouchableOpacity>
        </View>

        <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
          <TouchableOpacity style={styles.tmplBackdrop} activeOpacity={1} onPress={() => setShowTemplates(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.tmplSheet}>
              <View style={styles.tmplHandle} />
              <View style={styles.tmplHead}>
                <View>
                  <Text style={styles.tmplTitle}>Plantillas de respuesta</Text>
                  <Text style={styles.tmplSub}>Toca para insertar en la respuesta</Text>
                </View>
                <TouchableOpacity
                  style={styles.tmplEditBtn}
                  onPress={() => { setShowTemplates(false); router.push('/(admin)/manage/support/templates' as never); }}
                >
                  <Feather name="edit-2" size={13} color={Colors.accentPrimary} />
                  <Text style={styles.tmplEditLbl}>Administrar</Text>
                </TouchableOpacity>
              </View>
              {loadingTemplates ? (
                <ActivityIndicator color={Colors.accentPrimary} style={{ marginVertical: 40 }} />
              ) : templates.length === 0 ? (
                <View style={styles.tmplEmpty}>
                  <Feather name="zap" size={36} color={Colors.textMuted} />
                  <Text style={styles.tmplEmptyText}>Sin plantillas guardadas.</Text>
                  <TouchableOpacity
                    style={styles.tmplCreateBtn}
                    onPress={() => { setShowTemplates(false); router.push('/(admin)/manage/support/templates' as never); }}
                  >
                    <Feather name="plus" size={14} color={Colors.textInverse} />
                    <Text style={styles.tmplCreateLbl}>Crear primera plantilla</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
                  {templates.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.tmplRow}
                      activeOpacity={0.85}
                      onPress={() => insertTemplate(t.body)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tmplRowTitle}>{t.title}</Text>
                        <Text style={styles.tmplRowBody} numberOfLines={2}>{t.body}</Text>
                      </View>
                      <Feather name="plus-circle" size={18} color={Colors.accentPrimary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  actionsBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  actionChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionChipLbl: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  actionResolve: { backgroundColor: 'rgba(56,199,147,0.15)', borderColor: Colors.accentSuccess },
  actionResolveLbl: { color: Colors.accentSuccess, fontSize: 11, fontWeight: '800' },

  ticketBody: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 6,
  },
  ticketDesc: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },

  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowStaff: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleUser: { backgroundColor: Colors.bgCard, borderBottomLeftRadius: 4 },
  bubbleStaff: { backgroundColor: Colors.accentPrimary, borderBottomRightRadius: 4 },
  bubbleText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  bubbleTextStaff: { color: Colors.textInverse },
  bubbleTime: { color: Colors.textMuted, fontSize: 10, marginTop: 4 },
  bubbleTimeStaff: { color: 'rgba(13,13,15,0.6)' },

  composer: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bgCard, borderRadius: 22,
    color: Colors.textPrimary, fontSize: 14,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  zapBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(244,163,64,0.15)',
    borderWidth: 1, borderColor: 'rgba(244,163,64,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  tmplBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  tmplSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
    gap: 10,
    borderTopWidth: 1, borderColor: Colors.border,
    alignItems: 'stretch',
  },
  tmplHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#2A2A32',
    alignSelf: 'center',
  },
  tmplHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tmplTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  tmplSub: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  tmplEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(244,163,64,0.12)',
    borderWidth: 1, borderColor: 'rgba(244,163,64,0.3)',
  },
  tmplEditLbl: { color: Colors.accentPrimary, fontSize: 11, fontWeight: '700' },
  tmplEmpty: { alignItems: 'center', padding: 30, gap: 10 },
  tmplEmptyText: { color: Colors.textMuted, fontSize: 13 },
  tmplCreateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 10,
  },
  tmplCreateLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '800' },
  tmplRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgElevated,
    borderRadius: 10, padding: 12,
  },
  tmplRowTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  tmplRowBody: { color: Colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
});
