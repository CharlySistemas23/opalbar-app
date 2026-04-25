import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { messagesApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius, Spacing, Typography } from '@/constants/tokens';

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#6FB892', '#E06868', '#EC4899'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

type Request = {
  id: string;
  lastMessageAt?: string;
  lastMessage?: { id: string; content: string; createdAt: string; senderId: string } | null;
  otherUser: {
    id: string;
    profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
  };
};

export default function MessageRequestsScreen() {
  const router = useRouter();
  const { language } = useAppStore();
  const es = language === 'es';

  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await messagesApi.requests();
      setItems(r.data?.data ?? []);
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function removeLocal(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function accept(req: Request) {
    setBusyId(req.id);
    try {
      await messagesApi.acceptRequest(req.id);
      removeLocal(req.id);
      // Open the now-accepted thread immediately
      router.push(`/(app)/messages/${req.id}` as never);
    } catch {
      Alert.alert(es ? 'Error' : 'Error', es ? 'No se pudo aceptar' : "Couldn't accept");
    } finally {
      setBusyId(null);
    }
  }

  async function decline(req: Request) {
    setBusyId(req.id);
    try {
      await messagesApi.declineRequest(req.id);
      removeLocal(req.id);
    } catch {
      Alert.alert(es ? 'Error' : 'Error', es ? 'No se pudo rechazar' : "Couldn't decline");
    } finally {
      setBusyId(null);
    }
  }

  function confirmBlock(req: Request) {
    const name = nameOf(req);
    Alert.alert(
      es ? 'Bloquear a ' + name + '?' : 'Block ' + name + '?',
      es
        ? 'No podrá enviarte más mensajes.'
        : "They won't be able to send you any more messages.",
      [
        { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: es ? 'Bloquear' : 'Block',
          style: 'destructive',
          onPress: () => block(req),
        },
      ],
    );
  }

  async function block(req: Request) {
    setBusyId(req.id);
    try {
      await messagesApi.blockRequest(req.id);
      removeLocal(req.id);
    } catch {
      Alert.alert(es ? 'Error' : 'Error', es ? 'No se pudo bloquear' : "Couldn't block");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{es ? 'Solicitudes' : 'Requests'}</Text>
          {items.length > 0 ? (
            <Text style={styles.subtitle}>
              {items.length} {es ? 'pendientes' : 'pending'}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.disclaimer}>
        {es
          ? 'Estos mensajes son de personas que aún no apruebas. No verán que los leíste.'
          : "These are from people you haven't approved yet. They won't see you've read them."}
      </Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingBottom: Spacing[8] }}
          renderItem={({ item }) => (
            <RequestRow
              req={item}
              busy={busyId === item.id}
              es={es}
              onAccept={() => accept(item)}
              onDecline={() => decline(item)}
              onBlock={() => confirmBlock(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyRing}>
                <Feather name="inbox" size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{es ? 'Sin solicitudes' : 'No requests'}</Text>
              <Text style={styles.emptyBody}>
                {es
                  ? 'Cuando alguien que no sigues te escriba, aparecerá aquí primero.'
                  : "When someone you don't follow messages you, it'll show up here first."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function nameOf(req: Request) {
  const p = req.otherUser?.profile;
  return `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || 'Usuario';
}

function RequestRow({
  req,
  busy,
  es,
  onAccept,
  onDecline,
  onBlock,
}: {
  req: Request;
  busy: boolean;
  es: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onBlock: () => void;
}) {
  const name = nameOf(req);
  const initials = name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const avatar = req.otherUser?.profile?.avatarUrl;
  const preview = req.lastMessage?.content ?? '';

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colorFor(req.otherUser?.id || req.id) }]}>
            <Text style={styles.avatarText}>{initials || 'U'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.time}>{relTime(req.lastMessageAt)}</Text>
        </View>
        <Pressable onPress={onBlock} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Feather name="more-horizontal" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {preview ? (
        <Text style={styles.preview} numberOfLines={3}>{preview}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onAccept}
          disabled={busy}
          style={({ pressed }) => [styles.btn, styles.btnAccept, pressed && { opacity: 0.85 }]}
        >
          <Feather name="check" size={15} color={Colors.textInverse} />
          <Text style={styles.btnAcceptText}>{es ? 'Aceptar' : 'Accept'}</Text>
        </Pressable>
        <Pressable
          onPress={onDecline}
          disabled={busy}
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.btnGhostText}>{es ? 'Rechazar' : 'Decline'}</Text>
        </Pressable>
        <Pressable
          onPress={onBlock}
          disabled={busy}
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.btnGhostText, { color: Colors.accentDanger }]}>
            {es ? 'Bloquear' : 'Block'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
    gap: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: Typography.fontSize.lg,
    letterSpacing: Typography.letterSpacing.tight,
  },
  subtitle: {
    color: Colors.accentPrimary,
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  disclaimer: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    lineHeight: Typography.fontSize.sm * 1.45,
  },

  row: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
    gap: Spacing[2],
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  avatarText: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
  name: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: Typography.fontSize.base,
  },
  time: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.sans,
    fontSize: 11,
    marginTop: 2,
  },
  preview: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.snug,
    marginLeft: 44 + Spacing[3],
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginLeft: 44 + Spacing[3],
    marginTop: Spacing[1],
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing[3],
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  btnAccept: { backgroundColor: Colors.accentPrimary },
  btnAcceptText: {
    color: Colors.textInverse,
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: Typography.fontSize.sm,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  btnGhostText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
  },

  empty: {
    alignItems: 'center',
    paddingTop: Spacing[8],
    paddingHorizontal: Spacing[6],
    gap: Spacing[2],
  },
  emptyRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: Typography.fontSize.lg,
  },
  emptyBody: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.5,
    maxWidth: 280,
  },
});
