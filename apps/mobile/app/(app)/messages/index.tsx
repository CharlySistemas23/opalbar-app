import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, TextInput } from 'react-native';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { messagesApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { Colors, Radius, Shadows, Typography } from '@/constants/tokens';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#6FB892', '#E06868', '#EC4899'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function relTime(d?: string, t?: boolean) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return t ? 'ahora' : 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  const dt = new Date(d);
  return dt.toLocaleDateString(t ? 'es' : 'en', { day: 'numeric', month: 'short' });
}

export default function MessagesList() {
  const router = useRouter();
  const { language } = useAppStore();
  const { user: me } = useAuthStore();
  const t = language === 'es';

  const [threads, setThreads] = useState<any[]>([]);
  const [requestsCount, setRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [threadsRes, reqRes] = await Promise.all([
        messagesApi.threads(),
        messagesApi.requestsCount().catch(() => null),
      ]);
      setThreads(threadsRes.data?.data ?? []);
      setRequestsCount(reqRes?.data?.data?.count ?? 0);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filter — premium UIs always give a search bar on lists.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thr) => {
      const o = thr.otherUser;
      const name = `${o?.profile?.firstName ?? ''} ${o?.profile?.lastName ?? ''}`.toLowerCase();
      const preview = (thr.lastMessage?.content ?? '').toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [threads, query]);

  const totalUnread = useMemo(
    () => threads.reduce((s, thr) => s + (thr.unreadCount || 0), 0),
    [threads],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={styles.title}>{t ? 'Mensajes' : 'Messages'}</Text>
          {totalUnread > 0 && (
            <View style={styles.titleBadge}>
              <Text style={styles.titleBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.iconBtn} hitSlop={10} onPress={() => router.push('/(app)/search' as never)}>
          <Feather name="edit" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      {threads.length > 0 && (
        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t ? 'Buscar' : 'Search'}
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error && threads.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            requestsCount > 0 && query.length === 0 ? (
              <TouchableOpacity
                style={styles.requestsRow}
                onPress={() => router.push('/(app)/messages/requests' as never)}
                activeOpacity={0.85}
              >
                <View style={styles.requestsIcon}>
                  <Feather name="user-plus" size={18} color={Colors.accentPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestsTitle}>{t ? 'Solicitudes' : 'Requests'}</Text>
                  <Text style={styles.requestsBody}>
                    {requestsCount}{' '}
                    {t
                      ? requestsCount === 1 ? 'persona quiere chatear contigo' : 'personas quieren chatear contigo'
                      : requestsCount === 1 ? 'person wants to chat' : 'people want to chat'}
                  </Text>
                </View>
                <View style={styles.requestsBadge}>
                  <Text style={styles.requestsBadgeText}>{requestsCount > 99 ? '99+' : requestsCount}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => {
            const other = item.otherUser;
            const first = other?.profile?.firstName ?? '';
            const last = other?.profile?.lastName ?? '';
            const name = `${first} ${last}`.trim() || 'Usuario';
            const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
            const lastMsg = item.lastMessage;
            const isMine = !!lastMsg && lastMsg.senderId === me?.id;
            const hasUnread = item.unreadCount > 0;
            const previewBody = lastMsg?.stickerKey
              ? `${lastMsg.stickerKey}  ${t ? 'Sticker' : 'Sticker'}`
              : lastMsg?.imageUrl
                ? (t ? '📷 Foto' : '📷 Photo')
                : (lastMsg?.content ?? '');
            const preview = isMine && previewBody
              ? `${t ? 'Tú' : 'You'}: ${previewBody}`
              : previewBody;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(`/(app)/messages/${item.id}` as never)}
                activeOpacity={0.75}
              >
                <View style={styles.avatarWrap}>
                  {other?.profile?.avatarUrl
                    ? <Image source={{ uri: other.profile.avatarUrl }} style={styles.avatar} />
                    : <View style={[styles.avatar, { backgroundColor: colorFor(other?.id || item.id) }]}>
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>}
                  {hasUnread && <View style={styles.unreadRing} pointerEvents="none" />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text
                      style={[styles.name, hasUnread && styles.nameUnread]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text style={[styles.time, hasUnread && { color: Colors.accentPrimary, fontWeight: '700' }]}>
                      {relTime(item.lastMessageAt, t)}
                    </Text>
                  </View>
                  <View style={styles.rowBottom}>
                    {isMine && lastMsg && (
                      <Feather
                        name={lastMsg.isRead ? 'check-circle' : 'check'}
                        size={12}
                        color={lastMsg.isRead ? Colors.accentPrimary : Colors.textMuted}
                        style={{ marginRight: 5 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.preview,
                        hasUnread && styles.previewUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {preview || (t ? 'Empieza a conversar' : 'Start the conversation')}
                    </Text>
                    {hasUnread && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            query.length > 0 ? (
              <View style={styles.emptySearch}>
                <Feather name="search" size={20} color={Colors.textMuted} />
                <Text style={styles.emptySearchText}>
                  {t ? 'Sin resultados para ' : 'No results for '}
                  <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>"{query}"</Text>
                </Text>
              </View>
            ) : (
              <EmptyState
                icon="message-circle"
                title={t ? 'Aún no hay mensajes' : 'No messages yet'}
                actionLabel={t ? 'Buscar personas' : 'Find people'}
                onAction={() => router.push('/(app)/search' as never)}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  titleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.serifSemiBold,
    letterSpacing: Typography.letterSpacing.tighter,
  },
  titleBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadgeText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sansBold,
  },

  // Search bar
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.sans,
    padding: 0,
  },

  // Rows
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
    marginLeft: 84,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarWrap: {
    position: 'relative',
    padding: 2,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textInverse,
    fontSize: 18,
    fontFamily: Typography.fontFamily.sansBold,
  },
  unreadRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: Colors.accentPrimary,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  name: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.sansSemiBold,
    flex: 1,
    letterSpacing: Typography.letterSpacing.tight,
  },
  nameUnread: { fontFamily: Typography.fontFamily.sansBold },
  time: {
    color: Colors.textMuted,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sansMedium,
    marginLeft: 8,
  },
  preview: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.sans,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.snug,
  },
  previewUnread: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sansSemiBold,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    marginLeft: 8,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sansBold,
  },

  emptySearch: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptySearchText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.sans,
  },

  // Requests entry row
  requestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(244, 163, 64, 0.07)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(244, 163, 64, 0.18)',
    ...Shadows.sm,
  },
  requestsIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(244, 163, 64, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244, 163, 64, 0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  requestsTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.serifSemiBold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  requestsBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.sans,
    marginTop: 2,
  },
  requestsBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  requestsBadgeText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.sansBold,
  },
});
