// ─────────────────────────────────────────────
//  Friend Requests — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header
//   · <Tabs> (underline) toggle Principales / Filtradas with count meta
//   · FlatList of editorial request rows: avatar + name + mutual line +
//     two inline editorial buttons (Confirm primary / Delete secondary)
//   · Optimistic accept/decline. Errors → toast.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { friendshipsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Button,
  Caption,
  FadeIn,
  Heading,
  Kicker,
  Pressy,
  SkeletonList,
  Subhead,
  Tabs,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

const AVATAR_COLORS = ['#E89F4A', '#85ADCE', '#A8966F', '#7BB594', '#D96A6A', '#D7BE94'];

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
    (which: Tab) => {
      setLoading(true);
      setError(null);
      Promise.all([friendshipsApi.requests(which, 50), friendshipsApi.requestsCounts()])
        .then(([list, counts]) => {
          setItems(list.data?.data ?? []);
          setCounts(counts.data?.data ?? { main: 0, filtered: 0 });
        })
        .catch((err) => setError(apiError(err)))
        .finally(() => setLoading(false));
    },
    [],
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
    const prevItems = items;
    setItems((p) => p.filter((r) => r.friendshipId !== row.friendshipId));
    try {
      await friendshipsApi.accept(row.friendshipId);
      fb.success();
      toast(t ? 'Ahora son amigos.' : "You're now friends.", 'success');
      friendshipsApi
        .requestsCounts()
        .then((r) => setCounts(r.data?.data ?? { main: 0, filtered: 0 }))
        .catch(() => {});
    } catch (err: any) {
      setItems(prevItems);
      fb.error();
      toast(apiError(err, t ? 'No se pudo aceptar.' : "Couldn't accept."), 'danger');
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
      toast(apiError(err, t ? 'No se pudo rechazar.' : "Couldn't decline."), 'danger');
    } finally {
      setBusy(row.friendshipId, false);
    }
  }

  const tabOptions = [
    {
      value: 'main' as const,
      label: counts.main > 0
        ? `${t ? 'Principales' : 'Main'} · ${counts.main > 99 ? '99+' : counts.main}`
        : (t ? 'Principales' : 'Main'),
    },
    {
      value: 'filtered' as const,
      label: counts.filtered > 0
        ? `${t ? 'Filtradas' : 'Filtered'} · ${counts.filtered > 99 ? '99+' : counts.filtered}`
        : (t ? 'Filtradas' : 'Filtered'),
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Atrás' : 'Back'}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <View style={styles.titleBlock}>
        <Kicker tone="muted">{t ? 'AMISTAD' : 'FRIENDSHIP'}</Kicker>
        <Heading size="md" style={{ marginTop: Spacing[2] }}>
          {t ? 'Solicitudes' : 'Requests'}
        </Heading>
      </View>

      <View style={styles.tabsWrap}>
        <Tabs value={tab} onChange={(v) => setTab(v)} options={tabOptions} />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, marginTop: Spacing[5] }}>
          <SkeletonList count={5} itemHeight={112} />
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
          contentContainerStyle={{
            paddingHorizontal: EditorialSpacing.pageGutter,
            paddingTop: Spacing[4],
            paddingBottom: Spacing[12],
            gap: Spacing[5],
          }}
          renderItem={({ item, index }) => (
            <FadeIn delay={50 * index}>
              <RequestRowItem
                row={item}
                t={t}
                busy={busyIds.has(item.friendshipId)}
                onPress={() => router.push(`/(app)/users/${item.user.id}` as never)}
                onAccept={() => accept(item)}
                onDecline={() => decline(item)}
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            <View style={{ minHeight: 320 }}>
              <EmptyState
                icon={tab === 'filtered' ? 'filter' : 'user-plus'}
                title={
                  tab === 'filtered'
                    ? t ? 'Sin solicitudes filtradas' : 'No filtered requests'
                    : t ? 'Sin solicitudes nuevas' : 'No new requests'
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
            </View>
          }
        />
      )}
    </SafeAreaView>
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
  const name = `${first} ${last}`.trim() || (t ? 'Usuario' : 'User');
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';

  return (
    <View style={styles.requestRow}>
      <Pressy
        onPress={onPress}
        haptic="select"
        accessibilityRole={Roles.button}
        accessibilityLabel={name}
        style={styles.requestRowHead}
      >
        {u.profile?.avatarUrl ? (
          <Image source={{ uri: u.profile.avatarUrl }} style={styles.rowAvatar} />
        ) : (
          <View style={[styles.rowAvatar, { backgroundColor: colorFor(u.id) }]}>
            <Subhead tone="inverse">{initials}</Subhead>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Subhead numberOfLines={1}>{name}</Subhead>
          {row.mutualCount > 0 ? (
            <Caption tone="muted" style={{ marginTop: 2 }}>
              {row.mutualCount}{' '}
              {t
                ? row.mutualCount === 1 ? 'amigo en común' : 'amigos en común'
                : row.mutualCount === 1 ? 'mutual friend' : 'mutual friends'}
            </Caption>
          ) : u.profile?.bio ? (
            <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {u.profile.bio}
            </Caption>
          ) : null}
        </View>
      </Pressy>

      <View style={styles.rowActions}>
        <View style={{ flex: 1 }}>
          <Button
            label={busy ? '' : (t ? 'Confirmar' : 'Confirm')}
            onPress={onAccept}
            variant="primary"
            size="sm"
            disabled={busy}
            loading={busy}
            fullWidth
            haptic="success"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t ? 'Eliminar' : 'Delete'}
            onPress={onDecline}
            variant="secondary"
            size="sm"
            disabled={busy}
            fullWidth
            haptic="select"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[5],
  },
  tabsWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  requestRow: {
    gap: Spacing[4],
    padding: Spacing[5],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  requestRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
  },
  rowAvatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
});
