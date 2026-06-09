import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useFeedback } from '@/hooks/useFeedback';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Button, Caption, ConfirmDialog, Sheet, Subhead } from '@/components/ui';
import { AdminHeader } from '@/components/admin';

const REJECT_REASONS = ['Spam', 'Lenguaje ofensivo', 'Fuera de tema'];

export default function CommunityAdmin() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [confirmBulkApprove, setConfirmBulkApprove] = useState(false);
  const fb = useFeedback();

  const load = useCallback(async () => {
    try {
      const r = await adminApi.pendingPosts({ limit: 100 });
      setPosts(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    fb.tap();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    fb.tap();
    setSelected(new Set(posts.map((p) => p.id)));
  }

  async function approve(id: string) {
    try {
      await adminApi.approvePost(id);
      setPosts((p) => p.filter((x) => x.id !== id));
      fb.success();
    } catch (err) {
      fb.error();
      Alert.alert('Error', apiError(err));
    }
  }

  async function doReject(id: string, reason: string) {
    try {
      await adminApi.rejectPost(id, reason);
      setPosts((p) => p.filter((x) => x.id !== id));
      fb.success();
    } catch (err) {
      fb.error();
      Alert.alert('Error', apiError(err));
    }
  }

  async function performBulkApprove() {
    setConfirmBulkApprove(false);
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const r = await adminApi.bulkApprovePosts(ids);
      const data = r.data?.data ?? r.data;
      setPosts((p) => p.filter((x) => !selected.has(x.id)));
      exitSelectMode();
      fb.success();
      Alert.alert(
        'Listo',
        `${data.processed ?? ids.length} aprobados${data.skipped ? ` · ${data.skipped} omitidos` : ''}.`,
      );
    } catch (err) {
      fb.error();
      Alert.alert('Error', apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function doBulkReject(reason: string) {
    setBulkRejectOpen(false);
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const r = await adminApi.bulkRejectPosts(ids, reason);
      const data = r.data?.data ?? r.data;
      setPosts((p) => p.filter((x) => !selected.has(x.id)));
      exitSelectMode();
      fb.success();
      Alert.alert(
        'Listo',
        `${data.processed ?? ids.length} rechazados${data.skipped ? ` · ${data.skipped} omitidos` : ''}.`,
      );
    } catch (err) {
      fb.error();
      Alert.alert('Error', apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {selectMode ? (
        <AdminHeader
          title={`${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`}
          kicker="Moderacion"
          onBack={exitSelectMode}
          right={
            <Pressable
              onPress={selectAll}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Seleccionar todo"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Feather name="check-square" size={16} color={Colors.textPrimary} />
            </Pressable>
          }
        />
      ) : (
        <AdminHeader
          title="Posts pendientes"
          kicker="Moderacion"
          onBack={goBack}
          right={
            <View style={styles.counter}>
              <Caption tone="accent" style={{ fontWeight: '700' }}>
                {posts.length}
              </Caption>
            </View>
          }
        />
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{
            padding: Spacing[5],
            paddingBottom: selectMode ? 120 : 40,
            gap: Spacing[2],
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={Colors.accentPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={36} color={Colors.accentSuccess} />
              <Subhead style={{ marginTop: Spacing[2] }}>Todo al dia</Subhead>
              <Caption tone="muted">No hay posts pendientes de moderacion.</Caption>
            </View>
          }
          renderItem={({ item }) => {
            const checked = selected.has(item.id);
            return (
              <View style={[styles.card, checked && styles.cardSelected]}>
                <Pressable
                  onPress={() => {
                    if (selectMode) toggleSelect(item.id);
                    else router.push(`/(admin)/manage/community/${item.id}` as never);
                  }}
                  onLongPress={() => {
                    if (!selectMode) {
                      fb.select();
                      setSelectMode(true);
                      setSelected(new Set([item.id]));
                    }
                  }}
                  delayLongPress={250}
                  accessibilityRole="button"
                  accessibilityLabel={`Post de ${item.user?.profile?.firstName ?? 'usuario'}`}
                  style={{ gap: Spacing[2] }}
                >
                  <View style={styles.cardHead}>
                    {selectMode ? (
                      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                        {checked ? (
                          <Feather name="check" size={14} color={Colors.textInverse} />
                        ) : null}
                      </View>
                    ) : null}
                    <View style={styles.avatar}>
                      <Body tone="inverse" weight="bold">
                        {(item.user?.profile?.firstName?.[0] ?? '?').toUpperCase()}
                      </Body>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Subhead>
                        {item.user?.profile?.firstName} {item.user?.profile?.lastName}
                      </Subhead>
                      <Caption tone="muted" style={{ marginTop: 2 }}>
                        hace {relTime(item.createdAt)} · score:{' '}
                        {item.moderationScore?.toFixed?.(2) ?? '—'}
                      </Caption>
                    </View>
                  </View>
                  {item.content ? (
                    <Body size="sm" numberOfLines={3}>
                      {item.content}
                    </Body>
                  ) : null}
                  {item.imageUrl ? (
                    <View style={styles.imgBadge}>
                      <Feather name="image" size={12} color={Colors.textMuted} />
                      <Caption tone="muted" size="sm">Incluye imagen</Caption>
                    </View>
                  ) : null}
                </Pressable>
                {!selectMode ? (
                  <View style={styles.actions}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Rechazar"
                        variant="danger"
                        size="sm"
                        onPress={() => setRejectId(item.id)}
                        leftIcon={<Feather name="x" size={14} color={Colors.accentDanger} />}
                      />
                    </View>
                    <View style={{ flex: 1.3 }}>
                      <Button
                        label="Aprobar"
                        variant="primary"
                        size="sm"
                        onPress={() => approve(item.id)}
                        leftIcon={<Feather name="check" size={14} color={Colors.textInverse} />}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {selectMode ? (
        <View style={styles.bulkBar}>
          <View style={{ flex: 1 }}>
            <Button
              label={`Rechazar (${selected.size})`}
              variant="danger"
              onPress={() => setBulkRejectOpen(true)}
              disabled={selected.size === 0 || busy}
              loading={busy}
              leftIcon={<Feather name="x" size={14} color={Colors.accentDanger} />}
            />
          </View>
          <View style={{ flex: 1.3 }}>
            <Button
              label={`Aprobar (${selected.size})`}
              variant="primary"
              onPress={() => setConfirmBulkApprove(true)}
              disabled={selected.size === 0 || busy}
              loading={busy}
              leftIcon={<Feather name="check" size={14} color={Colors.textInverse} />}
            />
          </View>
        </View>
      ) : null}

      {/* Single reject sheet */}
      <Sheet
        open={!!rejectId}
        onClose={() => setRejectId(null)}
        title="Motivo de rechazo"
      >
        <View style={{ gap: Spacing[2] }}>
          {REJECT_REASONS.map((r) => (
            <Button
              key={r}
              label={r}
              variant="secondary"
              onPress={() => {
                const id = rejectId!;
                setRejectId(null);
                doReject(id, r);
              }}
            />
          ))}
        </View>
      </Sheet>

      <Sheet
        open={bulkRejectOpen}
        onClose={() => setBulkRejectOpen(false)}
        title={`Rechazar ${selected.size} post${selected.size > 1 ? 's' : ''}`}
      >
        <View style={{ gap: Spacing[2] }}>
          {REJECT_REASONS.map((r) => (
            <Button
              key={r}
              label={r}
              variant="secondary"
              onPress={() => doBulkReject(r)}
            />
          ))}
        </View>
      </Sheet>

      <ConfirmDialog
        open={confirmBulkApprove}
        onClose={() => setConfirmBulkApprove(false)}
        onConfirm={performBulkApprove}
        title={`Aprobar ${selected.size} post${selected.size > 1 ? 's' : ''}`}
        description="Publicar todos los seleccionados?"
        confirmLabel="Aprobar"
      />
    </SafeAreaView>
  );
}

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    minWidth: 40,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(201,169,97,0.14)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: 4 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing[3],
  },
  cardSelected: {
    borderColor: Colors.accentPrimary,
    backgroundColor: 'rgba(201,169,97,0.06)',
  },
  cardHead: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  checkboxOn: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  imgBadge: { flexDirection: 'row', gap: 6, alignItems: 'center' },

  actions: { flexDirection: 'row', gap: Spacing[2], paddingTop: 4 },

  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing[2],
    padding: Spacing[4],
    paddingBottom: Spacing[6],
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
