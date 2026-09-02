// ─────────────────────────────────────────────
//  My Reservations — Editorial Premium
//
//  Magazine index: Display title + kicker, SegmentedControl for tables
//  vs. events, then hairline-style reservation rows. Tables split into
//  Próximas / Pasadas (server-side `scope`, paginated). Loading uses
//  SkeletonList. Add button moved into a quiet ghost in the header row.
// ─────────────────────────────────────────────
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Badge,
  Body,
  Caption,
  Card,
  Display,
  FadeIn,
  Kicker,
  Pressy,
  SegmentedControl,
  SkeletonList,
  Subhead,
  Tabs,
} from '@/components/ui';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { eventsApi, reservationsApi, type ReservationScope } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { formatDateOnly, formatTimeSlot, isPastDateOnly } from '@/utils/date';

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; es: string; en: string }> = {
  PENDING:   { variant: 'warning', es: 'Pendiente',  en: 'Pending'   },
  CONFIRMED: { variant: 'success', es: 'Confirmada', en: 'Confirmed' },
  SEATED:    { variant: 'info',    es: 'En mesa',    en: 'Seated'    },
  COMPLETED: { variant: 'default', es: 'Completada', en: 'Completed' },
  CANCELLED: { variant: 'danger',  es: 'Cancelada',  en: 'Cancelled' },
  NO_SHOW:   { variant: 'danger',  es: 'No asistió', en: 'No-show'   },
};

const PAGE_SIZE = 20;

type Tab = 'tables' | 'events';

export default function MyReservations() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tab, setTab] = useState<Tab>('tables');
  const [scope, setScope] = useState<ReservationScope>('upcoming');
  const [tables, setTables] = useState<any[]>([]);
  const [tablesTotal, setTablesTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const loadTables = useCallback(async (which: ReservationScope, pageNo: number, append: boolean) => {
    const r = await reservationsApi.my({ scope: which, page: pageNo, limit: PAGE_SIZE });
    // Stale response for another tab (user switched while in flight) → drop it.
    if (scopeRef.current !== which) return;
    const payload = r?.data?.data;
    const rows: any[] = Array.isArray(payload) ? payload : payload?.data ?? [];
    const meta = Array.isArray(payload) ? null : payload?.meta;
    setTables((prev) => (append ? [...prev, ...rows] : rows));
    setTablesTotal(meta?.total ?? rows.length);
    setHasMore(!!meta?.hasNextPage);
    setPage(pageNo);
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsError(null);
    try {
      const r = await eventsApi.my();
      const rows: any[] = r?.data?.data ?? [];
      // Only live registrations — cancelled/no-show rows are history, not an agenda.
      setEvents(rows.filter((row) => row.status === 'REGISTERED' || row.status === 'ATTENDED'));
    } catch (err) {
      setEventsError(apiError(err));
    }
  }, []);

  const load = useCallback(async (which: ReservationScope = scopeRef.current) => {
    setError(null);
    try {
      await Promise.all([loadTables(which, 1, false), loadEvents()]);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadTables, loadEvents]);

  // Reload whenever the screen regains focus (after creating / cancelling /
  // modifying a reservation the list must reflect it without a manual pull).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  async function changeScope(next: ReservationScope) {
    if (next === scope) return;
    setScope(next);
    scopeRef.current = next;
    setLoading(true);
    setTables([]);
    setError(null);
    try {
      await loadTables(next, 1, false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore || tab !== 'tables') return;
    setLoadingMore(true);
    try {
      await loadTables(scope, page + 1, true);
    } catch (err) {
      // Keep what we have; surface the failure without wiping the list.
      setError(apiError(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const data = tab === 'tables' ? tables : events;
  const activeError = tab === 'tables' ? error : eventsError;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressy
          onPress={() => router.back()}
          accessibilityLabel={t ? 'Volver' : 'Back'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          style={styles.iconBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
        <Pressy
          onPress={() => router.push('/(app)/reservations/new' as never)}
          accessibilityLabel={t ? 'Nueva reserva' : 'New reservation'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          haptic="select"
          style={styles.addBtn}
        >
          <Feather name="plus" size={18} color={Colors.accentPrimary} />
          <Caption tone="accent" style={{ marginLeft: Spacing[2], fontWeight: '600' }}>
            {t ? 'Nueva' : 'New'}
          </Caption>
        </Pressy>
      </View>

      <View style={styles.heroBlock}>
        <FadeIn>
          <Kicker tone="champagne">{t ? 'TU AGENDA' : 'YOUR AGENDA'}</Kicker>
        </FadeIn>
        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Display size="md">{t ? 'Reservas.' : 'Bookings.'}</Display>
        </FadeIn>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            {
              value: 'tables',
              label: t
                ? `Mesas${tablesTotal != null ? ` (${tablesTotal})` : ''}`
                : `Tables${tablesTotal != null ? ` (${tablesTotal})` : ''}`,
            },
            { value: 'events', label: t ? `Eventos (${events.length})` : `Events (${events.length})` },
          ]}
        />
      </View>

      {tab === 'tables' ? (
        <View style={styles.scopeWrap}>
          <Tabs<ReservationScope>
            value={scope}
            onChange={changeScope}
            options={[
              { value: 'upcoming', label: t ? 'Próximas' : 'Upcoming' },
              { value: 'past', label: t ? 'Pasadas' : 'Past' },
            ]}
          />
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[4] }}>
          <SkeletonList count={4} itemHeight={92} />
        </View>
      ) : activeError && data.length === 0 ? (
        <ErrorState
          message={activeError}
          title={t ? 'Algo no salió bien' : 'Something went wrong'}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id ?? String(i)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentPrimary} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item, index }) =>
            tab === 'tables' ? (
              <FadeIn delay={Math.min(index, 5) * 60}>
                <TableRow
                  item={item}
                  t={t}
                  language={language}
                  onPress={() => router.push(`/(app)/reservations/${item.id}` as never)}
                />
              </FadeIn>
            ) : (
              <FadeIn delay={Math.min(index, 5) * 60}>
                <EventRow
                  item={item}
                  t={t}
                  language={language}
                  onPress={() =>
                    router.push(`/(app)/events/${item.event?.id ?? item.eventId}` as never)
                  }
                />
              </FadeIn>
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing[3] }} />}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: Spacing[4] }}>
                <ActivityIndicator color={Colors.accentPrimary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'tables' ? 'calendar' : 'star'}
              title={
                tab === 'tables'
                  ? scope === 'upcoming'
                    ? t ? 'No tienes mesas próximas' : 'No upcoming tables'
                    : t ? 'Aún no tienes reservas pasadas' : 'No past bookings yet'
                  : t ? 'Aún no asistes a ningún evento' : 'Not attending any events yet'
              }
              message={
                tab === 'tables' && scope === 'upcoming'
                  ? t ? 'Reserva tu mesa y llega directo a disfrutar.' : 'Book a table and skip the wait.'
                  : undefined
              }
              actionLabel={
                tab === 'tables'
                  ? scope === 'upcoming'
                    ? t ? 'Reservar mesa' : 'Book a table'
                    : undefined
                  : t ? 'Explorar eventos' : 'Explore events'
              }
              onAction={() =>
                router.push(
                  tab === 'tables' ? ('/(app)/reservations/new' as never) : ('/(tabs)/events' as never),
                )
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function TableRow({
  item,
  t,
  language,
  onPress,
}: {
  item: any;
  t: boolean;
  language: 'es' | 'en';
  onPress: () => void;
}) {
  const status = STATUS_BADGE[item.status] ?? STATUS_BADGE.PENDING;
  // `item.date` is UTC midnight — never `new Date(iso).toLocaleDateString`,
  // that renders the previous day on any device west of UTC.
  const dateStr = formatDateOnly(item.date, language, { month: 'short' });
  const timeStr = formatTimeSlot(item.timeSlot, language);
  const faded = isPastDateOnly(item.date) || item.status === 'CANCELLED' || item.status === 'NO_SHOW';
  return (
    <Card
      onPress={onPress}
      padding={Spacing[4]}
      accessibilityLabel={`${item.venue?.name || (t ? 'Reserva' : 'Booking')}, ${dateStr} ${timeStr}, ${status[language]}`}
    >
      <View style={[styles.cardHead, faded && { opacity: 0.72 }]}>
        <View style={{ flex: 1 }}>
          <Kicker tone="muted">
            {dateStr}
            {timeStr ? ` · ${timeStr}` : ''}
          </Kicker>
          <View style={{ marginTop: Spacing[2] }}>
            <Subhead numberOfLines={1}>{item.venue?.name || (t ? 'Reserva' : 'Booking')}</Subhead>
          </View>
          <Caption tone="muted" style={{ marginTop: Spacing[1] }}>
            {item.partySize ?? 2} {t ? 'personas' : 'guests'}
            {item.event?.title ? ` · ${language === 'es' ? item.event.title : item.event.titleEn || item.event.title}` : ''}
          </Caption>
        </View>
        <Badge label={status[language]} variant={status.variant} size="sm" />
      </View>
      {item.specialRequests ? (
        <Body size="sm" tone="muted" style={{ marginTop: Spacing[3] }} numberOfLines={2}>
          {item.specialRequests}
        </Body>
      ) : null}
    </Card>
  );
}

function EventRow({
  item,
  t,
  language,
  onPress,
}: {
  item: any;
  t: boolean;
  language: 'es' | 'en';
  onPress: () => void;
}) {
  const ev = item.event ?? item;
  const title = language === 'es' ? ev.title : ev.titleEn || ev.title;
  // Events carry a real instant (startDate), not a date-only value.
  const start = ev.startDate ? new Date(ev.startDate) : null;
  const dateStr = start && !Number.isNaN(start.getTime())
    ? start.toLocaleDateString(language === 'es' ? 'es-MX' : 'en-US', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
  const venue = ev.venue?.name;
  const attended = item.status === 'ATTENDED';
  const past = !!start && start.getTime() < Date.now() && !attended;
  return (
    <Card onPress={onPress} padding={Spacing[4]} accessibilityLabel={title}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Kicker tone="muted">
            {dateStr}
            {venue ? ` · ${venue}` : ''}
          </Kicker>
          <View style={{ marginTop: Spacing[2] }}>
            <Subhead numberOfLines={1}>{title}</Subhead>
          </View>
        </View>
        <Badge
          label={attended ? (t ? 'Asististe' : 'Attended') : past ? (t ? 'Pasado' : 'Past') : (t ? 'Asistiré' : 'Attending')}
          variant={attended ? 'info' : past ? 'default' : 'success'}
          size="sm"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },
  addBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
  },

  heroBlock: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
  },
  tabsWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[3],
  },
  scopeWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[2],
  },

  listContent: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[3],
    paddingBottom: Spacing[10],
    flexGrow: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
  },
});
