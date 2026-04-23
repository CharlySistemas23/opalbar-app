import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Pressable } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { notificationsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

function iconForType(type: string): { icon: FeatherIcon; color: string } {
  const t = type?.toUpperCase() ?? '';
  if (t.includes('FOLLOW')) return { icon: 'user-plus', color: Colors.accentSuccess };
  if (t.includes('LIKE') || t.includes('REACTION')) return { icon: 'heart', color: Colors.accentDanger };
  if (t.includes('COMMENT') || t.includes('MESSAGE')) return { icon: 'message-circle', color: '#60A5FA' };
  if (t.includes('RESERVATION') || t.includes('BOOKING')) return { icon: 'calendar', color: Colors.accentPrimary };
  if (t.includes('EVENT')) return { icon: 'music', color: '#A855F7' };
  if (t.includes('OFFER')) return { icon: 'tag', color: Colors.accentPrimary };
  if (t.includes('POINTS') || t.includes('WALLET')) return { icon: 'star', color: Colors.accentPrimary };
  if (t.includes('SYSTEM')) return { icon: 'info', color: Colors.textSecondary };
  return { icon: 'bell', color: Colors.accentPrimary };
}

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

export default function Notifications() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await notificationsApi.list();
      const rows = r.data?.data?.data ?? r.data?.data?.items ?? r.data?.data ?? [];
      setItems(rows);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Backend returns `read`; older clients/stubs used `isRead`. Normalize.
  const isRead = (n: any) => !!(n.read ?? n.isRead);

  async function markAll() {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
    } catch {}
  }

  async function markReadLocal(id: string) {
    try { await notificationsApi.markRead(id); } catch {}
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true, isRead: true } : x)));
  }

  async function openNotif(n: any) {
    if (!isRead(n)) await markReadLocal(n.id);

    const type = (n.type || '').toUpperCase();
    const d = n.data || {};
    const postId = d.postId;
    const target = n.targetId || d.targetId || d.eventId || postId;

    if (type.includes('REACTION') || type.includes('REPLY') || type.includes('MENTION') || type.includes('COMMENT') || type.includes('POST')) {
      if (postId) return router.push(`/(app)/community/posts/${postId}` as never);
    }
    if (type.includes('EVENT') && target) return router.push(`/(app)/events/${target}` as never);
    if (type.includes('OFFER') && target) return router.push(`/(app)/offers/${target}` as never);
    if ((type.includes('FOLLOW') || type.includes('MESSAGE')) && target) {
      return router.push(`/(app)/users/${target}` as never);
    }
  }

  async function openActor(n: any) {
    const actorId = n.data?.actorId;
    if (!actorId) return;
    if (!isRead(n)) await markReadLocal(n.id);
    router.push(`/(app)/users/${actorId}` as never);
  }

  const unreadCount = items.filter((n) => !isRead(n)).length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {t ? 'Notificaciones' : 'Notifications'}
          {unreadCount > 0 && <Text style={styles.unread}> · {unreadCount}</Text>}
        </Text>
        <TouchableOpacity onPress={markAll} style={styles.iconBtn} hitSlop={10} disabled={unreadCount === 0}>
          <Feather name="check-circle" size={18} color={unreadCount > 0 ? Colors.accentPrimary : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const { icon, color } = iconForType(item.type || '');
            const unread = !isRead(item);
            const actorId = item.data?.actorId;
            const actorAvatar = item.data?.actorAvatarUrl;
            return (
              <TouchableOpacity
                style={[styles.row, unread && styles.rowUnread]}
                onPress={() => openNotif(item)}
                activeOpacity={0.85}
              >
                {actorId ? (
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); openActor(item); }}
                    hitSlop={6}
                    style={({ pressed }) => [styles.actorWrap, pressed && { opacity: 0.8 }]}
                  >
                    {actorAvatar ? (
                      <Image source={{ uri: actorAvatar }} style={styles.actorAvatar} />
                    ) : (
                      <View style={[styles.actorAvatar, { backgroundColor: color + '30', alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="user" size={16} color={color} />
                      </View>
                    )}
                    <View style={[styles.actorBadge, { backgroundColor: color }]}>
                      <Feather name={icon} size={10} color="#fff" />
                    </View>
                  </Pressable>
                ) : (
                  <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                    <Feather name={icon} size={18} color={color} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, unread && { fontWeight: '800' }]} numberOfLines={2}>
                    {item.title || item.type || 'Notificación'}
                  </Text>
                  {item.body || item.message ? (
                    <Text style={styles.rowBody} numberOfLines={2}>{item.body || item.message}</Text>
                  ) : null}
                  <Text style={styles.rowTime}>{relTime(item.createdAt)}</Text>
                </View>
                {unread && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="bell-off" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {t ? 'Sin notificaciones' : 'No notifications'}
              </Text>
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  unread: { color: Colors.accentPrimary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgCard,
  },
  rowUnread: { backgroundColor: 'rgba(244, 163, 64, 0.05)' },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actorWrap: { width: 44, height: 44, position: 'relative' },
  actorAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bgElevated,
  },
  actorBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgPrimary,
  },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowBody: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 },
  rowTime: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.accentPrimary,
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
