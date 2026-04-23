import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supportApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

export default function SupportChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function load() {
    try {
      const r = await supportApi.messages(id);
      const msgs = r.data?.data?.data ?? r.data?.data ?? [];
      setMessages(msgs);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText('');
    try {
      await supportApi.sendMessage(id, { content: body });
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert(
        t ? 'Error' : 'Error',
        err?.response?.data?.message || (t ? 'No se pudo enviar.' : 'Could not send.'),
      );
      setText(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerMid}>
            <View style={styles.avatar}>
              <Feather name="headphones" size={16} color={Colors.textInverse} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{t ? 'Soporte OPALBAR' : 'OPALBAR Support'}</Text>
              <Text style={styles.headerSub}>
                <View style={styles.onlineDot} />
                {' '}{t ? 'En línea' : 'Online'}
              </Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
            renderItem={({ item }) => {
              const isMe = item.senderId === user?.id || item.senderType === 'USER';
              return (
                <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.bubbleText, isMe && { color: Colors.textInverse }]}>
                      {item.content}
                    </Text>
                    <Text style={[styles.bubbleTime, isMe && { color: 'rgba(0,0,0,0.5)' }]}>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {t ? 'Inicia la conversación.' : 'Start the conversation.'}
              </Text>
            }
          />
        )}

        {/* Input */}
        <View style={styles.compose}>
          <TextInput
            style={styles.composeInput}
            placeholder={t ? 'Escribe un mensaje…' : 'Type a message…'}
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            hitSlop={8}
          >
            {sending
              ? <ActivityIndicator color={Colors.textInverse} size="small" />
              : <Feather name="send" size={18} color={Colors.textInverse} />}
          </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerMid: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  headerSub: { color: Colors.accentSuccess, fontSize: 11, marginTop: 2 },
  onlineDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.accentSuccess,
  },

  msgRow: { flexDirection: 'row' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 2,
  },
  bubbleMe: {
    backgroundColor: Colors.accentPrimary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: Colors.bgCard,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 19 },
  bubbleTime: { color: Colors.textMuted, fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },

  empty: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 40 },

  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  composeInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
});
