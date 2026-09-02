import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Caption,
  ConfirmDialog,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { AdminHeader, StatusPill } from '@/components/admin';

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
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tRes, mRes] = await Promise.all([
        adminApi.threadDetail(id),
        adminApi.threadMessages(id),
      ]);
      setThread(tRes?.data?.data ?? tRes?.data ?? null);
      setMessages(mRes?.data?.data ?? mRes?.data ?? []);
    } catch (err) {
      setError(apiError(err));
    } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function performDelete() {
    if (!confirmDel) return;
    try {
      await adminApi.deleteMessage(confirmDel);
      setConfirmDel(null);
      load();
    } catch (err) {
      Alert.alert('Error', apiError(err));
      setConfirmDel(null);
    }
  }

  function viewUser(userId: string) {
    router.push(`/(admin)/users/${userId}` as never);
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  if (error)
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <AdminHeader title="Conversación" kicker="Modo moderación" onBack={goBack} />
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      </SafeAreaView>
    );
  if (!thread)
    return (
      <View style={styles.center}>
        <Caption tone="muted">Hilo no encontrado</Caption>
      </View>
    );

  const a = thread.userA;
  const b = thread.userB;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader title="Conversación" kicker="Modo moderación" onBack={goBack} />

      <View style={styles.participants}>
        <ParticipantCard user={a} onPress={() => viewUser(a.id)} />
        <View style={styles.arrowBox}>
          <Feather name="repeat" size={14} color={Colors.textMuted} />
        </View>
        <ParticipantCard user={b} onPress={() => viewUser(b.id)} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: Spacing[4], gap: Spacing[2], paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={32} color={Colors.textMuted} />
            <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
              Sin mensajes en este hilo.
            </Caption>
          </View>
        }
        renderItem={({ item }) => {
          const fromA = item.senderId === a.id;
          const sender = fromA ? a : b;
          const deleted = !!item.deletedAt;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.msgRow,
                fromA ? styles.msgLeft : styles.msgRight,
                pressed && styles.pressed,
              ]}
              onLongPress={() => !deleted && setConfirmDel(item.id)}
              delayLongPress={350}
              accessibilityRole="button"
              accessibilityHint="Mantener presionado para eliminar"
            >
              <View style={styles.msgAvatar}>
                <Caption tone="inverse" size="sm" style={{ fontWeight: '700' }}>
                  {userName(sender)[0]?.toUpperCase() ?? '?'}
                </Caption>
              </View>
              <View
                style={[
                  styles.bubble,
                  fromA ? styles.bubbleLeft : styles.bubbleRight,
                  deleted && styles.bubbleDeleted,
                ]}
              >
                <Caption tone="muted" size="sm" style={{ fontWeight: '700' }}>
                  {userName(sender)}
                </Caption>
                <Body
                  size="sm"
                  tone={deleted ? 'muted' : 'primary'}
                  style={deleted ? styles.italic : undefined}
                >
                  {item.content}
                </Body>
                <View style={styles.bubbleFoot}>
                  <Caption tone="muted" size="sm">
                    {new Date(item.createdAt).toLocaleString('es', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Caption>
                  {deleted ? (
                    <View style={styles.deletedBadge}>
                      <Feather name="trash-2" size={10} color={Colors.accentDanger} />
                      <Caption tone="danger" size="sm" style={{ fontWeight: '700' }}>
                        Eliminado
                      </Caption>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setConfirmDel(item.id)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Eliminar mensaje"
                    >
                      <Feather name="trash-2" size={13} color={Colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Feather name="info" size={12} color={Colors.textMuted} />
        <Caption tone="muted" size="sm">
          Mantén presionado un mensaje para eliminarlo.
        </Caption>
      </View>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={performDelete}
        title="Eliminar mensaje"
        description="¿Ocultar este mensaje? No se borra de la base de datos — queda marcado como eliminado (con registro de moderación) y ambos participantes dejan de verlo."
        confirmLabel="Eliminar"
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

function ParticipantCard({ user, onPress }: { user: any; onPress: () => void }) {
  const name = userName(user);
  const banned = user?.status === 'BANNED';
  return (
    <Pressable
      style={({ pressed }) => [styles.pcard, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver perfil de ${name}`}
    >
      <View style={styles.pAvatar}>
        <Body tone="inverse" weight="bold">
          {name[0]?.toUpperCase() ?? '?'}
        </Body>
      </View>
      <Subhead numberOfLines={1} style={{ marginTop: 4 }}>
        {name}
      </Subhead>
      <Caption tone="muted" size="sm" numberOfLines={1}>
        {user?.email ?? '—'}
      </Caption>
      {banned && (
        <View style={{ marginTop: 4 }}>
          <StatusPill label="BANEADO" tone="danger" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  italic: { fontStyle: 'italic' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
  },

  participants: {
    flexDirection: 'row',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pcard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  pAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  msgRow: { flexDirection: 'row', gap: Spacing[2], alignItems: 'flex-end', maxWidth: '90%' },
  msgLeft: { alignSelf: 'flex-start' },
  msgRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bubble: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    padding: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 4,
    maxWidth: 260,
  },
  bubbleLeft: { borderBottomLeftRadius: Radius.sm },
  bubbleRight: { borderBottomRightRadius: Radius.sm, backgroundColor: Colors.bgElevated },
  bubbleDeleted: { opacity: 0.6, borderColor: 'rgba(196,104,104,0.40)' },
  bubbleFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
    marginTop: 2,
  },
  deletedBadge: { flexDirection: 'row', gap: 4, alignItems: 'center' },

  footer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },

  empty: { alignItems: 'center', paddingTop: 60 },
});
