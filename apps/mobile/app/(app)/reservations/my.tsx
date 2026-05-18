// ─────────────────────────────────────────────
//  My Reservations — Editorial Premium
//
//  Magazine index: Display title + kicker, SegmentedControl for tables
//  vs. events, then hairline-style reservation rows. Loading uses
//  SkeletonList. Add button moved into a quiet ghost in the header row.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
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
} from '@/components/ui';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { eventsApi, reservationsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; es: string; en: string }> = {
  CONFIRMED: { variant: 'success', es: 'Confirmada', en: 'Confirmed' },
  PENDING:   { variant: 'warning', es: 'Pendiente',  en: 'Pending'   },
  CANCELLED: { variant: 'danger',  es: 'Cancelada',  en: 'Cancelled' },
  COMPLETED: { variant: 'default', es: 'Completada', en: 'Completed' },
};

type Tab = 'tables' | 'events';

export default function MyReservations() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tab, setTab] = useState<Tab>('tables');
  const [tables, setTables] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tRes, eRes] = await Promise.all([reservationsApi.my(), eventsApi.my()]);
      setTables(tRes?.data?.data?.data ?? tRes?.data?.data ?? []);
      setEvents(eRes?.data?.data ?? []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  const data = tab === 'tables' ? tables : events;

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
            { value: 'tables', label: t ? `Mesas (${tables.length})` : `Tables (${tables.length})` },
            { value: 'events', label: t ? `Eventos (${events.length})` : `Events (${events.length})` },
          ]}
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[4] }}>
          <SkeletonList count={4} itemHeight={92} />
        </View>
      ) : error && data.length === 0 ? (
        <ErrorState
          message={error}
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
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'tables' ? 'calendar' : 'star'}
              title={
                tab === 'tables'
                  ? t ? 'Aún no tienes mesas reservadas' : 'No tables booked yet'
                  : t ? 'Aún no asistes a ningún evento' : 'Not attending any events yet'
              }
              actionLabel={
                tab === 'tables'
                  ? t ? 'Reservar mesa' : 'Book a table'
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
  const dateStr = item.date
    ? new Date(item.date).toLocaleDateString(language, { day: 'numeric', month: 'short' })
    : '';
  const timeStr = item.timeSlot ?? '';
  return (
    <Card
      onPress={onPress}
      padding={Spacing[4]}
      accessibilityLabel={item.venue?.name || (t ? 'Reserva' : 'Booking')}
    >
      <View style={styles.cardHead}>
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
  const dateStr = ev.date
    ? new Date(ev.date).toLocaleDateString(language, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
  const venue = ev.venue?.name;
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
        <Badge label={t ? 'Asistiré' : 'Attending'} variant="success" size="sm" />
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

  listContent: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[3],
    paddingBottom: Spacing[10],
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
  },
});
