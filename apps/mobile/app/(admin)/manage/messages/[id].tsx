import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function userName(u: any) {
  if (!u) return 'Usuario';
  return `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.trim() || u.email || 'Usuario';
}

export default function ThreadModerationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage/messages');
  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        adminApi.threadDetail(id).catch(() => null),
        adminApi.threadMessages(id).catch(() => null),
      ]);
      setThread(tRes?.data?.data ?? tRes?.data ?? null);
      setMessages(mRes?.data?.data ?? mRes?.data ?? []);
    } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete(msgId: string) {
    Alert.alert('Eliminar mensaje', '¿Eliminar este mensaje permanentemente? Quedará registro de moderación.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminApi.deleteMessage(msgId);
            load();
          } catch (err) { Alert.alert('Error', apiError(err)); }
        },
      },
    ]);
  }

  function viewUser(userId: string) {
    router.push(`/(admin)/users/${userId}` as never);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (!thread) return <View style={styles.center}><Text style={{ color: Colors.textMuted }}>Hilo no encontrado</Text></View>;

  const a = thread.userA;
  const b = thread.userB;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Conversación</Text>
          <Text style={styles.subtitle}>Modo moderación</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Participants */}
      <View style={styles.participants}>
        <ParticipantCard user={a} onPress={() => viewUser(a.id)} />
        <View style={styles.arrowBox}><Feather name="repeat" size={14} color={Colors.textMuted} /></View>
        <ParticipantCard user={b} onPress={() => viewUser(b.id)} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Sin mensajes en este hilo.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fromA = item.senderId === a.id;
          const sender = fromA ? a : b;
          const deleted = !!item.deletedAt;
          return (
            <TouchableOpacity
              style={[styles.msgRow, fromA ? styles.msgLeft : styles.msgRight]}
              onLongPress={() => !deleted && confirmDelete(item.id)}
              delayLongPress={350}
              activeOpacity={0.85}
            >
              <View style={[styles.msgAvatar, { backgroundColor: colorFor(sender?.id ?? '') }]}>
                <Text style={styles.msgAvatarText}>{userName(sender)[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <View style={[styles.bubble, fromA ? styles.bubbleLeft : styles.bubbleRight, deleted && styles.bubbleDeleted]}>
                <Text style={styles.bubbleSender}>{userName(sender)}</Text>
                <Text style={[styles.bubbleText, deleted && styles.bubbleTextDeleted]}>
                  {item.content}
                </Text>
                <View style={styles.bubbleFoot}>
                  <Text style={styles.bubbleTime}>
                    {new Date(item.createdAt).toLocaleString('es', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  {deleted ? (
                    <View style={styles.deletedBadge}>
                      <Feather name="trash-2" size={10} color={Colors.accentDanger} />
                      <Text style={styles.deletedText}>Eliminado</Text>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => confirmDelete(item.id)} hitSlop={6}>
                      <Feather name="trash-2" size={13} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <Feather name="info" size={12} color={Colors.textMuted} />
        <Text style={styles.footerText}>
          Mantén presionado un mensaje para eliminarlo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function ParticipantCard({ user, onPress }: { user: any; onPress: () => void }) {
  const name = userName(user);
  const banned = user?.status === 'BANNED';
  return (
    <TouchableOpacity style={styles.pcard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.pAvatar, { backgroundColor: colorFor(user?.id ?? '') }]}>
        <Text style={styles.pAvatarText}>{name[0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <Text style={styles.pName} numberOfLines={1}>{name}</Text>
      <Text style={styles.pEmail} numberOfLines={1}>{user?.email ?? '—'}</Text>
      {banned && (
        <View style={styles.pBanned}>
          <Text style={styles.pBannedText}>BANEADO</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  subtitle: { color: Colors.accentPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },

  participants: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pcard: {
    flex: 1, alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: Colors.border,
    gap: 4,
  },
  pAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pAvatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 14 },
  pName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  pEmail: { color: Colors.textMuted, fontSize: 10 },
  pBanned: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(228,88,88,0.15)',
  },
  pBannedText: { color: Colors.accentDanger, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  arrowBox: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },

  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', maxWidth: '90%' },
  msgLeft: { alignSelf: 'flex-start' },
  msgRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 11 },

  bubble: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: Colors.border,
    gap: 4, maxWidth: 260,
  },
  bubbleLeft: { borderBottomLeftRadius: 4 },
  bubbleRight: { borderBottomRightRadius: 4, backgroundColor: Colors.bgElevated },
  bubbleDeleted: { opacity: 0.6, borderColor: 'rgba(228,88,88,0.4)' },
  bubbleSender: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  bubbleText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  bubbleTextDeleted: { color: Colors.textMuted, fontStyle: 'italic' },
  bubbleFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginTop: 2,
  },
  bubbleTime: { color: Colors.textMuted, fontSize: 10 },
  deletedBadge: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  deletedText: { color: Colors.accentDanger, fontSize: 9, fontWeight: '800' },

  footer: {
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  footerText: { color: Colors.textMuted, fontSize: 11 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
