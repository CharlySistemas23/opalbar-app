import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
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
function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
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

  const load = useCallback(async (q = '') => {
    try {
      const r = await adminApi.allThreads(q.trim() || undefined);
      setThreads(r.data?.data ?? r.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(appliedSearch); }, [load, appliedSearch]));

  function runSearch() {
    setLoading(true);
    setAppliedSearch(search);
    load(search);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Conversaciones</Text>
          <Text style={styles.subtitle}>{threads.length} hilos · moderación</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={runSearch}
          placeholder="Buscar por usuario o email..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); setAppliedSearch(''); load(''); }} hitSlop={6}>
            <Feather name="x" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.warn}>
        <Feather name="shield" size={14} color={Colors.accentPrimary} />
        <Text style={styles.warnText}>
          Todas las acciones quedan registradas. Usa con criterio.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 6 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(appliedSearch); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-circle" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {appliedSearch ? `Sin resultados para "${appliedSearch}".` : 'Sin conversaciones todavía.'}
              </Text>
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
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/(admin)/manage/messages/${item.id}` as never)}
              >
                <View style={styles.avatars}>
                  <View style={[styles.avatar, { backgroundColor: colorFor(a?.id ?? '') }]}>
                    <Text style={styles.avatarText}>{nA[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={[styles.avatar, styles.avatarBack, { backgroundColor: colorFor(b?.id ?? '') }]}>
                    <Text style={styles.avatarText}>{nB[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.pair} numberOfLines={1}>
                    {nA} <Text style={styles.pairSep}>↔</Text> {nB}
                  </Text>
                  <Text style={[styles.preview, lastWasDeleted && styles.previewDeleted]} numberOfLines={1}>
                    {last
                      ? (lastWasDeleted ? '[mensaje eliminado]' : last.content)
                      : 'Sin mensajes'}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{item.messageCount} msgs</Text>
                    {item.lastMessageAt && <Text style={styles.metaText}>· {relTime(item.lastMessageAt)}</Text>}
                    {anyBanned && (
                      <View style={styles.bannedBadge}>
                        <Text style={styles.bannedText}>USER BANEADO</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  subtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 6,
    paddingHorizontal: 14, height: 40,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 13, padding: 0 },

  warn: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    marginHorizontal: 20, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(244,163,64,0.1)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(244,163,64,0.3)',
  },
  warnText: { color: Colors.textSecondary, fontSize: 11, flex: 1 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatars: { flexDirection: 'row', marginRight: 6 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgCard,
  },
  avatarBack: { marginLeft: -14 },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 13 },

  pair: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  pairSep: { color: Colors.textMuted, fontWeight: '600' },
  preview: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  previewDeleted: { color: Colors.textMuted, fontStyle: 'italic' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  metaText: { color: Colors.textMuted, fontSize: 10 },
  bannedBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(228,88,88,0.15)',
  },
  bannedText: { color: Colors.accentDanger, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
});
