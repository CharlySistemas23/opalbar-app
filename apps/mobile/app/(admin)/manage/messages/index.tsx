import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Button,
  Caption,
  Input,
  Kicker,
  Sheet,
  Subhead,
} from '@/components/ui';
import { AdminHeader, StatusPill } from '@/components/admin';
import { UserPicker, type PickedUser } from '@/components/admin/UserPicker';

function userName(u: any) {
  if (!u) return 'Usuario';
  return `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.trim() || u.email || 'Usuario';
}
function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function MessagesModerationList() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Mensaje como plataforma
  const [composing, setComposing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<PickedUser | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!picked || !body.trim()) return;
    setSending(true);
    try {
      await adminApi.sendMessageAsAdmin({ userId: picked.id, content: body.trim() });
      Alert.alert('Mensaje enviado', `Llego como un DM tuyo a ${picked.email}.`);
      setComposing(false);
      setPicked(null);
      setBody('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  }

  const load = useCallback(async (q = '') => {
    try {
      const r = await adminApi.allThreads(q.trim() || undefined);
      setThreads(r.data?.data ?? r.data ?? []);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(appliedSearch); }, [load, appliedSearch]));

  function runSearch() {
    setLoading(true);
    setAppliedSearch(search);
    load(search);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Conversaciones"
        kicker={`${threads.length} hilos · moderacion`}
        onBack={goBack}
        right={
          <Pressable
            onPress={() => setComposing(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Mensaje como plataforma"
            style={({ pressed }) => [styles.composeBtn, pressed && styles.pressed]}
          >
            <Feather name="send" size={14} color={Colors.accentPrimary} />
          </Pressable>
        }
      />

      <View style={styles.searchWrap}>
        <Input
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={runSearch}
          placeholder="Buscar por usuario o email..."
          leftIcon={<Feather name="search" size={16} color={Colors.textMuted} />}
          rightIcon={
            search.length > 0 ? <Feather name="x" size={14} color={Colors.textMuted} /> : null
          }
          onRightIconPress={
            search.length > 0
              ? () => {
                  setSearch('');
                  setAppliedSearch('');
                  load('');
                }
              : undefined
          }
          rightIconLabel="Limpiar busqueda"
          returnKeyType="search"
        />
      </View>

      <View style={styles.warn}>
        <Feather name="shield" size={13} color={Colors.accentPrimary} />
        <Caption tone="secondary" size="sm" style={{ flex: 1 }}>
          Todas las acciones quedan registradas. Usa con criterio.
        </Caption>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: Spacing[4], paddingBottom: 120, gap: 6 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(appliedSearch); }}
              tintColor={Colors.accentPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-circle" size={32} color={Colors.textMuted} />
              <Caption tone="muted" align="center" style={{ marginTop: Spacing[2] }}>
                {appliedSearch
                  ? `Sin resultados para "${appliedSearch}".`
                  : 'Sin conversaciones todavia.'}
              </Caption>
            </View>
          }
          renderItem={({ item }) => {
            const a = item.userA;
            const b = item.userB;
            const nA = userName(a);
            const nB = userName(b);
            const last = item.lastMessage;
            const lastWasDeleted = !!last?.deletedAt;
            const anyBanned = a?.status === 'BANNED' || b?.status === 'BANNED';
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => router.push(`/(admin)/manage/messages/${item.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`Conversacion entre ${nA} y ${nB}`}
              >
                <View style={styles.avatars}>
                  <View style={styles.avatar}>
                    <Body weight="bold" tone="inverse">
                      {nA[0]?.toUpperCase() ?? '?'}
                    </Body>
                  </View>
                  <View style={[styles.avatar, styles.avatarBack]}>
                    <Body weight="bold" tone="inverse">
                      {nB[0]?.toUpperCase() ?? '?'}
                    </Body>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Subhead numberOfLines={1}>
                    {nA} <Caption tone="muted">↔</Caption> {nB}
                  </Subhead>
                  <Caption
                    tone={lastWasDeleted ? 'muted' : 'secondary'}
                    style={lastWasDeleted ? [{ marginTop: 2 }, styles.italic] : { marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {last
                      ? lastWasDeleted
                        ? '[mensaje eliminado]'
                        : last.content
                      : 'Sin mensajes'}
                  </Caption>
                  <View style={styles.metaRow}>
                    <Caption tone="muted" size="sm">{item.messageCount} msgs</Caption>
                    {item.lastMessageAt && (
                      <Caption tone="muted" size="sm">· {relTime(item.lastMessageAt)}</Caption>
                    )}
                    {anyBanned && <StatusPill label="USER BANEADO" tone="danger" />}
                  </View>
                </View>

                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </Pressable>
            );
          }}
        />
      )}

      <Sheet open={composing} onClose={() => setComposing(false)} title="Mensaje como plataforma">
        <View style={{ gap: Spacing[3] }}>
          <View>
            <Kicker style={{ marginBottom: 6 }}>Destinatario</Kicker>
            {picked ? (
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={styles.pickedRow}
                accessibilityRole="button"
                accessibilityLabel="Cambiar destinatario"
              >
                <Feather name="user" size={14} color={Colors.accentSuccess} />
                <Body size="sm" weight="semiBold" style={{ flex: 1 }} numberOfLines={1}>
                  {`${picked.profile?.firstName ?? ''} ${picked.profile?.lastName ?? ''}`.trim() ||
                    picked.email}
                </Body>
                <Caption tone="muted" size="sm">cambiar</Caption>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={styles.pickerBtn}
                accessibilityRole="button"
                accessibilityLabel="Buscar usuario"
              >
                <Feather name="search" size={14} color={Colors.textMuted} />
                <Caption tone="muted">Buscar usuario...</Caption>
              </Pressable>
            )}
          </View>

          <Input
            label="Mensaje"
            value={body}
            onChangeText={setBody}
            placeholder="Llega como un DM tuyo al usuario."
            multiline
            style={{ minHeight: 100 }}
            maxLength={2000}
            helper={`${body.length}/2000`}
          />

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button label="Cancelar" variant="secondary" onPress={() => setComposing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={sending ? 'Enviando...' : 'Enviar'}
                variant="primary"
                onPress={send}
                loading={sending}
                disabled={sending || !picked || !body.trim()}
                leftIcon={<Feather name="send" size={14} color={Colors.textInverse} />}
              />
            </View>
          </View>
        </View>
      </Sheet>

      <UserPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(u) => setPicked(u)}
        title="Destinatario"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  italic: { fontStyle: 'italic' },

  composeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,97,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchWrap: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2] },

  warn: {
    flexDirection: 'row',
    gap: Spacing[2],
    alignItems: 'center',
    marginHorizontal: Spacing[5],
    marginTop: Spacing[3],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    backgroundColor: 'rgba(201,169,97,0.06)',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,97,0.20)',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  avatars: { flexDirection: 'row', marginRight: 6 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgCard,
  },
  avatarBack: { marginLeft: -12, backgroundColor: Colors.accentChampagne },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },

  empty: { alignItems: 'center', paddingTop: 60 },

  // Sheet content
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    minHeight: 52,
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(111,168,138,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(111,168,138,0.30)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    minHeight: 52,
  },

  actions: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[3],
    paddingTop: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
