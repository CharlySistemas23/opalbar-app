import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { friendshipsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { toast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, Spacing, Typography, Radius } from '@/constants/tokens';

// ─────────────────────────────────────────────
//  Friend Requests Inbox — IG/FB hybrid
//  · Tab "Principales" (main): high-trust requests, push-notified
//  · Tab "Filtradas" (filtered): low-trust requests, silent badge
//  · Per-row: Confirmar / Eliminar with optimistic update
// ─────────────────────────────────────────────

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type Tab = 'main' | 'filtered';

type RequestRow = {
  friendshipId: string;
  createdAt: string;
  filtered: boolean;
  mutualCount: number;
  user: {
    id: string;
    profile?: { firstName?: string; lastName?: string; avatarUrl?: string; bio?: string };
    _count?: { followers?: number };
  };
};

export default function FriendRequests() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [tab, setTab] = useState<Tab>('main');
  const [items, setItems] = useState<RequestRow[]>([]);
  const [counts, setCounts] = useState<{ main: number; filtered: number }>({ main: 0, filtered: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(
    (which: Tab = tab, opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
      setError(null);
      Promise.all([friendshipsApi.requests(which, 50), friendshipsApi.requestsCounts()])
        .then(([list, counts]) => {
          setItems(list.data?.data ?? []);
          setCounts(counts.data?.data ?? { main: 0, filtered: 0 });
        })
        .catch((err) => setError(apiError(err)))
        .finally(() => setLoading(false));
    },
    [tab],
  );

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  function setBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function accept(row: RequestRow) {
    setBusy(row.friendshipId, true);
    // Optimistic remove from list — counts will refresh after.
    const prevItems = items;
    setItems((p) => p.filter((r) => r.friendshipId !== row.friendshipId));
    try {
      await friendshipsApi.accept(row.friendshipId);
      fb.success();
      toast(t ? 'Ahora son amigos.' : "You're now friends.", 'success');
      // Refresh badge counts in the background.
      friendshipsApi
        .requestsCounts()
        .then((r) => setCounts(r.data?.data ?? { main: 0, filtered: 0 }))
        .catch(() => {});
    } catch (err: any) {
      setItems(prevItems);
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setBusy(row.friendshipId, false);
    }
  }

  async function decline(row: RequestRow) {
    setBusy(row.friendshipId, true);
    const prevItems = items;
    setItems((p) => p.filter((r) => r.friendshipId !== row.friendshipId));
    try {
      await friendshipsApi.decline(row.friendshipId);
      fb.tap();
      friendshipsApi
        .requestsCounts()
        .then((r) => setCounts(r.data?.data ?? { main: 0, filtered: 0 }))
        .catch(() => {});
    } catch (err: any) {
      setItems(prevItems);
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setBusy(row.friendshipId, false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Solicitudes' : 'Requests'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <TabButton
          label={t ? 'Principales' : 'Main'}
          count={counts.main}
          active={tab === 'main'}
          onPress={() => setTab('main')}
        />
        <TabButton
          label={t ? 'Filtradas' : 'Filtered'}
          count={counts.filtered}
          active={tab === 'filtered'}
          onPress={() => setTab('filtered')}
          muted
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => load(tab)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.friendshipId}
          contentContainerStyle={{ paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], paddingBottom: 32 }}
          renderItem={({ item }) => (
            <RequestRowItem
              row={item}
              t={t}
              busy={busyIds.has(item.friendshipId)}
              onPress={() => router.push(`/(app)/users/${item.user.id}` as never)}
              onAccept={() => accept(item)}
              onDecline={() => decline(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'filtered' ? 'filter' : 'user-plus'}
              title={
                tab === 'filtered'
                  ? t
                    ? 'Sin solicitudes filtradas'
                    : 'No filtered requests'
                  : t
                    ? 'Sin solicitudes nuevas'
                    : 'No new requests'
              }
              message={
                tab === 'filtered'
                  ? t
                    ? 'Las solicitudes con baja confianza aparecerán aquí.'
                    : 'Low-trust requests will appear here.'
                  : t
                    ? 'Cuando alguien te envíe una solicitud, aparecerá aquí.'
                    : 'When someone sends you a request, it will appear here.'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function TabButton({
  label,
  count,
  active,
  onPress,
  muted,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.tabInner}>
        <Text
          style={[
            styles.tabLabel,
            active && styles.tabLabelActive,
            muted && !active && { color: Colors.textMuted },
          ]}
        >
          {label}
        </Text>
        {count > 0 && (
          <View style={[styles.tabBadge, muted && !active && styles.tabBadgeMuted]}>
            <Text style={styles.tabBadgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
      {active && <View style={styles.tabUnderline} />}
    </Pressable>
  );
}

function RequestRowItem({
  row,
  t,
  busy,
  onPress,
  onAccept,
  onDecline,
}: {
  row: RequestRow;
  t: boolean;
  busy: boolean;
  onPress: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const u = row.user;
  const first = u.profile?.firstName ?? '';
  const last = u.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || 'Usuario';
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.requestRow, pressed && { opacity: 0.85 }]}
    >
      {u.profile?.avatarUrl ? (
        <Image source={{ uri: u.profile.avatarUrl }} style={styles.rowAvatar} />
      ) : (
        <View style={[styles.rowAvatar, { backgroundColor: colorFor(u.id) }]}>
          <Text style={styles.rowAvatarText}>{initials}</Text>
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        {row.mutualCount > 0 ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {row.mutualCount}{' '}
            {t
              ? row.mutualCount === 1
                ? 'amigo en común'
                : 'amigos en común'
              : row.mutualCount === 1
                ? 'mutual friend'
                : 'mutual friends'}
          </Text>
        ) : u.profile?.bio ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {u.profile.bio}
          </Text>
        ) : null}
        <View style={styles.rowActions}>
          <Pressable
            onPress={onAccept}
            disabled={busy}
            style={({ pressed }) => [
              styles.confirmBtn,
              (busy || pressed) && { opacity: 0.85 },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={styles.confirmLabel}>{t ? 'Confirmar' : 'Confirm'}</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onDecline}
            disabled={busy}
            style={({ pressed }) => [
              styles.declineBtn,
              (busy || pressed) && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.declineLabel}>{t ? 'Eliminar' : 'Delete'}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
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

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeMuted: {
    backgroundColor: Colors.bgElevated,
  },
  tabBadgeText: {
    color: Colors.textInverse,
    fontSize: 11,
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accentPrimary,
  },

  requestRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  rowAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: { color: Colors.textInverse, fontSize: 18, fontWeight: '800' },
  rowBody: { flex: 1, gap: 6, justifyContent: 'center' },
  rowName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: Colors.textMuted, fontSize: 12 },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  confirmBtn: {
    flex: 1,
    height: 36,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
  declineBtn: {
    flex: 1,
    height: 36,
    backgroundColor: Colors.bgElevated,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
});
