// ─────────────────────────────────────────────
//  Friend Requests — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header
//   · <SegmentedControl> Recibidas / Enviadas
//   · Recibidas → <Tabs> (underline) Principales / Filtradas with count meta
//     rows: avatar + name + mutual line + Confirm / Delete buttons
//   · Enviadas → pending outgoing requests with "Cancelar"
//   · Optimistic accept/decline/cancel with revert + toast.
//   · Realtime: friendship events refresh the visible list silently.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { friendshipsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { useRealtime } from '@/hooks/useRealtime';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Button,
  Caption,
  FadeIn,
  Heading,
  Kicker,
  Pressy,
  SegmentedControl,
  SkeletonList,
  Subhead,
  Tabs,
} from '@/components/ui';
import type { SegmentOption } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

const AVATAR_COLORS = ['#E89F4A', '#85ADCE', '#A8966F', '#7BB594', '#D96A6A', '#D7BE94'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type Direction = 'received' | 'sent';
type Tab = 'main' | 'filtered';

type RequestRow = {
  friendshipId: string;
  createdAt: string;
  filtered?: boolean;
  mutualCount?: number;
  user: {
    id: string;
    profile?: { firstName?: string; lastName?: string; avatarUrl?: string | null; bio?: string };
  };
};

type Counts = { main: number; filtered: number; total: number };
const ZERO_COUNTS: Counts = { main: 0, filtered: 0, total: 0 };

export default function FriendRequests() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [direction, setDirection] = useState<Direction>('received');
  const [tab, setTab] = useState<Tab>('main');
  const [items, setItems] = useState<RequestRow[]>([]);
  const [outgoing, setOutgoing] = useState<RequestRow[]>([]);
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Stale-response guard: only the most recent load may commit state.
  const reqRef = useRef(0);

  const refreshCounts = useCallback(() => {
    friendshipsApi
      .requestsCounts()
      .then((r) => setCounts(r.data?.data ?? ZERO_COUNTS))
      .catch((err) => toast(apiError(err), 'danger'));
  }, []);

  const load = useCallback(
    async (dir: Direction, which: Tab, silent = false) => {
      const reqId = ++reqRef.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        if (dir === 'received') {
          const [list, c] = await Promise.all([
            friendshipsApi.requests(which, 50),
            friendshipsApi.requestsCounts(),
          ]);
          if (reqId !== reqRef.current) return;
          setItems(list.data?.data ?? []);
          setCounts(c.data?.data ?? ZERO_COUNTS);
        } else {
          const [list, c] = await Promise.all([
            friendshipsApi.outgoing(50),
            friendshipsApi.requestsCounts(),
          ]);
          if (reqId !== reqRef.current) return;
          setOutgoing(list.data?.data ?? []);
          setCounts(c.data?.data ?? ZERO_COUNTS);
        }
        setError(null);
      } catch (err) {
        if (reqId !== reqRef.current) return;
        if (!silent) setError(apiError(err));
        else toast(apiError(err), 'danger');
      } finally {
        if (reqId === reqRef.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(direction, tab);
  }, [direction, tab, load]);

  // Any friendship event involving me → silent refresh of the visible list.
  useRealtime('user', (env) => {
    const d: any = env?.data ?? {};
    if (!d?.friendship) return;
    void load(direction, tab, true);
  });

  function setBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function accept(row: RequestRow) {
    if (busyIds.has(row.friendshipId)) return;
    setBusy(row.friendshipId, true);
    const prevItems = items;
    const prevCounts = counts;
    setItems((p) => p.filter((r) => r.friendshipId !== row.friendshipId));
    setCounts((c) => bumpCounts(c, row.filtered ? 'filtered' : 'main'));
    try {
      await friendshipsApi.accept(row.friendshipId);
      fb.success();
      toast(t ? 'Ahora son amigos.' : "You're now friends.", 'success');
      refreshCounts();
    } catch (err) {
      setItems(prevItems);
      setCounts(prevCounts);
      fb.error();
      toast(apiError(err, t ? 'No se pudo aceptar.' : "Couldn't accept."), 'danger');
    } finally {
      setBusy(row.friendshipId, false);
    }
  }

  async function decline(row: RequestRow) {
    if (busyIds.has(row.friendshipId)) return;
    setBusy(row.friendshipId, true);
    const prevItems = items;
    const prevCounts = counts;
    setItems((p) => p.filter((r) => r.friendshipId !== row.friendshipId));
    setCounts((c) => bumpCounts(c, row.filtered ? 'filtered' : 'main'));
    try {
      await friendshipsApi.decline(row.friendshipId);
      fb.tap();
      toast(t ? 'Solicitud eliminada.' : 'Request removed.', 'info');
      refreshCounts();
    } catch (err) {
      setItems(prevItems);
      setCounts(prevCounts);
      fb.error();
      toast(apiError(err, t ? 'No se pudo rechazar.' : "Couldn't decline."), 'danger');
    } finally {
      setBusy(row.friendshipId, false);
    }
  }

  async function cancelOutgoing(row: RequestRow) {
    if (busyIds.has(row.friendshipId)) return;
    setBusy(row.friendshipId, true);
    const prev = outgoing;
    setOutgoing((p) => p.filter((r) => r.friendshipId !== row.friendshipId));
    try {
      await friendshipsApi.cancel(row.user.id);
      fb.tap();
      toast(t ? 'Solicitud cancelada.' : 'Request cancelled.', 'info');
    } catch (err) {
      setOutgoing(prev);
      fb.error();
      toast(apiError(err, t ? 'No se pudo cancelar.' : "Couldn't cancel."), 'danger');
    } finally {
      setBusy(row.friendshipId, false);
    }
  }

  const directionOptions: SegmentOption<Direction>[] = [
    {
      value: 'received',
      label:
        counts.total > 0
          ? `${t ? 'Recibidas' : 'Received'} · ${counts.total > 99 ? '99+' : counts.total}`
          : t ? 'Recibidas' : 'Received',
    },
    { value: 'sent', label: t ? 'Enviadas' : 'Sent' },
  ];

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

  const visible = direction === 'received' ? items : outgoing;

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
        <Heading size="md">{t ? 'Solicitudes' : 'Requests'}</Heading>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl value={direction} onChange={setDirection} options={directionOptions} fullWidth />
      </View>

      {direction === 'received' ? (
        <View style={styles.tabsWrap}>
          <Tabs value={tab} onChange={(v) => setTab(v)} options={tabOptions} />
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, marginTop: Spacing[5] }}>
          <SkeletonList count={5} itemHeight={112} />
        </View>
      ) : error && visible.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => load(direction, tab)}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(x) => x.friendshipId}
          contentContainerStyle={{
            paddingHorizontal: EditorialSpacing.pageGutter,
            paddingTop: Spacing[4],
            paddingBottom: Spacing[12],
            gap: Spacing[5],
          }}
          renderItem={({ item, index }) => (
            <FadeIn delay={50 * index}>
              {direction === 'received' ? (
                <RequestRowItem
                  row={item}
                  t={t}
                  busy={busyIds.has(item.friendshipId)}
                  onPress={() => router.push(`/(app)/users/${item.user.id}` as never)}
                  onAccept={() => accept(item)}
                  onDecline={() => decline(item)}
                />
              ) : (
                <OutgoingRowItem
                  row={item}
                  t={t}
                  busy={busyIds.has(item.friendshipId)}
                  onPress={() => router.push(`/(app)/users/${item.user.id}` as never)}
                  onCancel={() => cancelOutgoing(item)}
                />
              )}
            </FadeIn>
          )}
          ListEmptyComponent={
            <View style={{ minHeight: 320 }}>
              {direction === 'sent' ? (
                <EmptyState
                  icon="send"
                  title={t ? 'Sin solicitudes enviadas' : 'No sent requests'}
                  message={
                    t
                      ? 'Las solicitudes que envíes y sigan pendientes aparecerán aquí.'
                      : 'Requests you send that are still pending will appear here.'
                  }
                  actionLabel={t ? 'Buscar personas' : 'Find people'}
                  onAction={() => router.push('/(app)/search' as never)}
                />
              ) : (
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
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function bumpCounts(c: Counts, bucket: 'main' | 'filtered'): Counts {
  const next = { ...c, [bucket]: Math.max(0, c[bucket] - 1) } as Counts;
  next.total = next.main + next.filtered;
  return next;
}

function RowHead({ row, t, onPress, subtitle }: { row: RequestRow; t: boolean; onPress: () => void; subtitle?: string }) {
  const u = row.user;
  const first = u.profile?.firstName ?? '';
  const last = u.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || (t ? 'Usuario' : 'User');
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';

  return (
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
        {subtitle ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Caption>
        ) : null}
      </View>
    </Pressy>
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
  const mutual = row.mutualCount ?? 0;
  const subtitle =
    mutual > 0
      ? `${mutual} ${
          t
            ? mutual === 1 ? 'amigo en común' : 'amigos en común'
            : mutual === 1 ? 'mutual friend' : 'mutual friends'
        }`
      : row.user.profile?.bio || undefined;

  return (
    <View style={styles.requestRow}>
      <RowHead row={row} t={t} onPress={onPress} subtitle={subtitle} />

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

function OutgoingRowItem({
  row,
  t,
  busy,
  onPress,
  onCancel,
}: {
  row: RequestRow;
  t: boolean;
  busy: boolean;
  onPress: () => void;
  onCancel: () => void;
}) {
  const sent = formatSent(row.createdAt, t);
  return (
    <View style={styles.requestRow}>
      <RowHead
        row={row}
        t={t}
        onPress={onPress}
        subtitle={sent ? `${t ? 'Enviada el' : 'Sent'} ${sent}` : t ? 'Pendiente' : 'Pending'}
      />
      <View style={styles.rowActions}>
        <View style={{ flex: 1 }}>
          <Button
            label={t ? 'Cancelar solicitud' : 'Cancel request'}
            onPress={onCancel}
            variant="secondary"
            size="sm"
            disabled={busy}
            loading={busy}
            fullWidth
            haptic="select"
          />
        </View>
      </View>
    </View>
  );
}

function formatSent(iso: string, es: boolean) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(es ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' });
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
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  segmentWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[3],
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
