import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors } from '@/constants/tokens';

export default function CommunityAdmin() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // When selectMode is on, tapping a row toggles selection instead of opening detail.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
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
    } catch (err) { fb.error(); Alert.alert('Error', apiError(err)); }
  }

  function reject(id: string) {
    Alert.alert('Rechazar post', '¿Motivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Spam', onPress: () => doReject(id, 'Spam') },
      { text: 'Lenguaje ofensivo', onPress: () => doReject(id, 'Lenguaje ofensivo') },
      { text: 'Fuera de tema', onPress: () => doReject(id, 'Fuera de tema') },
    ]);
  }
  async function doReject(id: string, reason: string) {
    try {
      await adminApi.rejectPost(id, reason);
      setPosts((p) => p.filter((x) => x.id !== id));
      fb.success();
    } catch (err) { fb.error(); Alert.alert('Error', apiError(err)); }
  }

  async function bulkApprove() {
    if (selected.size === 0 || busy) return;
    Alert.alert(
      `Aprobar ${selected.size} post${selected.size > 1 ? 's' : ''}`,
      '¿Publicar todos los seleccionados?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setBusy(true);
            try {
              const ids = Array.from(selected);
              const r = await adminApi.bulkApprovePosts(ids);
              const data = r.data?.data ?? r.data;
              setPosts((p) => p.filter((x) => !selected.has(x.id)));
              exitSelectMode();
              fb.success();
              Alert.alert('Listo', `${data.processed ?? ids.length} aprobados${data.skipped ? ` · ${data.skipped} omitidos` : ''}.`);
            } catch (err) {
              fb.error();
              Alert.alert('Error', apiError(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  function bulkReject() {
    if (selected.size === 0 || busy) return;
    Alert.alert(
      `Rechazar ${selected.size} post${selected.size > 1 ? 's' : ''}`,
      '¿Motivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Spam', onPress: () => doBulkReject('Spam') },
        { text: 'Lenguaje ofensivo', onPress: () => doBulkReject('Lenguaje ofensivo') },
        { text: 'Fuera de tema', onPress: () => doBulkReject('Fuera de tema') },
      ],
    );
  }
  async function doBulkReject(reason: string) {
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const r = await adminApi.bulkRejectPosts(ids, reason);
      const data = r.data?.data ?? r.data;
      setPosts((p) => p.filter((x) => !selected.has(x.id)));
      exitSelectMode();
      fb.success();
      Alert.alert('Listo', `${data.processed ?? ids.length} rechazados${data.skipped ? ` · ${data.skipped} omitidos` : ''}.`);
    } catch (err) {
      fb.error();
      Alert.alert('Error', apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        {selectMode ? (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={exitSelectMode} hitSlop={10}>
              <Feather name="x" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>{selected.size} seleccionado{selected.size === 1 ? '' : 's'}</Text>
            <TouchableOpacity style={styles.backBtn} onPress={selectAll} hitSlop={10}>
              <Feather name="check-square" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
              <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Posts pendientes</Text>
            <View style={styles.counter}>
              <Text style={styles.counterText}>{posts.length}</Text>
            </View>
          </>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 20, paddingBottom: selectMode ? 120 : 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={48} color={Colors.accentSuccess} />
              <Text style={styles.emptyTitle}>Todo al día</Text>
              <Text style={styles.emptySub}>No hay posts pendientes de moderación.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const checked = selected.has(item.id);
            return (
              <View style={[styles.card, checked && styles.cardSelected]}>
                <TouchableOpacity
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
                  activeOpacity={0.85}
                  style={{ gap: 8 }}
                >
                  <View style={styles.cardHead}>
                    {selectMode ? (
                      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                        {checked ? <Feather name="check" size={14} color={Colors.textInverse} /> : null}
                      </View>
                    ) : null}
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(item.user?.profile?.firstName?.[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.authorName}>
                        {item.user?.profile?.firstName} {item.user?.profile?.lastName}
                      </Text>
                      <Text style={styles.meta}>
                        hace {relTime(item.createdAt)} · score: {item.moderationScore?.toFixed?.(2) ?? '—'}
                      </Text>
                    </View>
                  </View>
                  {item.content ? (
                    <Text style={styles.body} numberOfLines={3}>{item.content}</Text>
                  ) : null}
                  {item.imageUrl ? (
                    <View style={styles.imgBadge}>
                      <Feather name="image" size={12} color={Colors.textMuted} />
                      <Text style={styles.imgBadgeText}>Incluye imagen</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
                {!selectMode ? (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(item.id)} activeOpacity={0.85}>
                      <Feather name="x" size={16} color={Colors.accentDanger} />
                      <Text style={styles.rejectLbl}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item.id)} activeOpacity={0.85}>
                      <Feather name="check" size={16} color={Colors.textInverse} />
                      <Text style={styles.approveLbl}>Aprobar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {selectMode ? (
        <View style={styles.bulkBar}>
          <TouchableOpacity
            style={[styles.rejectBtn, styles.bulkBtn, selected.size === 0 && { opacity: 0.4 }]}
            onPress={bulkReject}
            disabled={selected.size === 0 || busy}
          >
            {busy
              ? <ActivityIndicator size="small" color={Colors.accentDanger} />
              : <>
                  <Feather name="x" size={16} color={Colors.accentDanger} />
                  <Text style={styles.rejectLbl}>Rechazar ({selected.size})</Text>
                </>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approveBtn, styles.bulkBtn, selected.size === 0 && { opacity: 0.4 }]}
            onPress={bulkApprove}
            disabled={selected.size === 0 || busy}
          >
            {busy
              ? <ActivityIndicator size="small" color={Colors.textInverse} />
              : <>
                  <Feather name="check" size={16} color={Colors.textInverse} />
                  <Text style={styles.approveLbl}>Aprobar ({selected.size})</Text>
                </>}
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  counter: {
    minWidth: 40, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(244,163,64,0.2)',
    paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  counterText: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptySub: { color: Colors.textMuted, fontSize: 13 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 12,
  },
  cardSelected: {
    borderColor: Colors.accentPrimary,
    backgroundColor: 'rgba(244,163,64,0.08)',
  },
  cardHead: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  checkboxOn: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 13 },
  authorName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  meta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  body: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  imgBadge: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  imgBadgeText: { color: Colors.textMuted, fontSize: 11 },

  actions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 40, borderRadius: 10,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  rejectLbl: { color: Colors.accentDanger, fontSize: 13, fontWeight: '700' },
  approveBtn: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 40, borderRadius: 10,
    backgroundColor: Colors.accentSuccess,
  },
  approveLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '800' },

  bulkBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bulkBtn: { height: 48, borderRadius: 12 },
});
