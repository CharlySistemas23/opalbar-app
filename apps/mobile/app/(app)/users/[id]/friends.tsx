import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { friendshipsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, Spacing, Typography } from '@/constants/tokens';

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function Friends() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Backend currently exposes friends.list for the authenticated user only.
  // Visiting another user's /friends route falls back to "no data" until a
  // public friends endpoint is added — keep the UI gracefully empty.
  const isMe = me?.id === id;

  useEffect(() => {
    if (!isMe) {
      setItems([]);
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    friendshipsApi
      .list(200)
      .then((r) => setItems(r.data?.data ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [id, isMe]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => {
      const name = `${u?.profile?.firstName ?? ''} ${u?.profile?.lastName ?? ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [items, query]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {t ? 'Amigos' : 'Friends'}
          {items.length > 0 ? ` · ${items.length}` : ''}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isMe && items.length > 0 && (
        <View style={styles.searchWrap}>
          <Feather name="search" size={14} color={Colors.textMuted} />
          <Pressable
            style={({ pressed }) => [styles.searchInput, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(app)/search' as never)}
          >
            <Text style={styles.searchPlaceholder}>{t ? 'Buscar amigos' : 'Search friends'}</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            friendshipsApi
              .list(200)
              .then((r) => setItems(r.data?.data ?? []))
              .catch((err) => setError(apiError(err)))
              .finally(() => setLoading(false));
          }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingBottom: 32 }}
          renderItem={({ item }) => (
            <FriendRow u={item} onPress={() => router.push(`/(app)/users/${item.id}` as never)} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={
                isMe
                  ? t
                    ? 'Sin amigos aún'
                    : 'No friends yet'
                  : t
                    ? 'Lista privada'
                    : 'Private list'
              }
              message={
                isMe
                  ? t
                    ? 'Cuando aceptes solicitudes, los amigos aparecerán aquí.'
                    : 'Once you accept requests, friends will appear here.'
                  : t
                    ? 'Solo tú puedes ver tus amigos por ahora.'
                    : 'Only you can see your friends list for now.'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function FriendRow({ u, onPress }: { u: any; onPress: () => void }) {
  const first = u?.profile?.firstName ?? '';
  const last = u?.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || 'Usuario';
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      {u?.profile?.avatarUrl ? (
        <Image source={{ uri: u.profile.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colorFor(u.id) }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}
      <Text style={styles.name}>{name}</Text>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[4],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[3],
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, justifyContent: 'center', height: '100%' },
  searchPlaceholder: { color: Colors.textMuted, fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
  name: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
});
