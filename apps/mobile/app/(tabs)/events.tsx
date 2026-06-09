// ─────────────────────────────────────────────
//  Events — Editorial Premium
//
//  Magazine-style listing. Each card: 16:10 image (sharp, no shadow),
//  small Kicker overline (date), serif Heading (title), Body for venue +
//  capacity meta. No pill tags pressed into hero space — category lives
//  as a Kicker label above the title.
// ─────────────────────────────────────────────
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { playUiSound } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  SkeletonList,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

interface EventItem {
  id: string;
  title?: string;
  name?: string;
  startDate?: string;
  imageUrl?: string;
  category?: { name?: string; color?: string } | null;
  spotsLeft?: number;
  attendees?: number;
  badge?: string;
  badgeColor?: string;
  tagLabel?: string;
  tagColor?: string;
  isFree?: boolean;
  venue?: { name?: string } | null;
  venueName?: string;
}

const PAGE_SIZE = 20;

export default function Events() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqIdRef = useRef(0);

  const load = useCallback(
    async (mode: 'fresh' | 'more' = 'fresh') => {
      const nextPage = mode === 'more' ? page + 1 : 1;
      if (mode === 'more' && (loadingMore || !hasMore)) return;
      if (mode === 'more') setLoadingMore(true);
      else setError(null);
      const id = ++reqIdRef.current;
      try {
        const r = await eventsApi.list({ page: nextPage, limit: PAGE_SIZE });
        if (reqIdRef.current !== id) return;
        const payload = r.data?.data;
        const rows: EventItem[] = payload?.data ?? [];
        const meta = payload?.meta;
        setItems((prev) => (mode === 'more' ? [...prev, ...rows] : rows));
        setPage(nextPage);
        setHasMore(meta ? !!meta.hasNextPage : rows.length === PAGE_SIZE);
      } catch (err) {
        if (reqIdRef.current !== id) return;
        if (mode === 'fresh') setItems([]);
        setError(apiError(err));
      } finally {
        if (reqIdRef.current === id) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [page, loadingMore, hasMore],
  );

  useFocusEffect(
    useCallback(() => {
      load('fresh');
    }, []),
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Editorial masthead. Kicker overline + serif Heading. */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Kicker tone="champagne">{t ? 'AGENDA' : 'AGENDA'}</Kicker>
          <Heading style={styles.title}>{t ? 'Eventos' : 'Events'}</Heading>
        </View>
        <Pressy
          onPress={() => router.push('/(app)/search' as never)}
          hitSlop={HitSlop.expand}
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Buscar eventos' : 'Search events'}
          style={styles.searchBtn}
        >
          <Feather name="search" size={18} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <Hairline variant="subtle" />

      {loading && items.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <SkeletonList count={4} itemHeight={280} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState
          title={t ? 'No se pudieron cargar' : 'Could not load'}
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load('fresh');
          }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(ev, idx) => ev.id ?? `ev-${idx}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing[8] }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                playUiSound('swoosh');
                setRefreshing(true);
                load('fresh');
              }}
              tintColor={Colors.accentPrimary}
            />
          }
          renderItem={({ item, index }) =>
            index < 8 ? (
              <FadeIn delay={index * 70}>
                <EventCard
                  ev={item}
                  t={t}
                  lang={language}
                  onPress={() => router.push(`/(app)/events/${item.id}` as never)}
                />
              </FadeIn>
            ) : (
              <EventCard
                ev={item}
                t={t}
                lang={language}
                onPress={() => router.push(`/(app)/events/${item.id}` as never)}
              />
            )
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => load('more')}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={Colors.textMuted}
                style={{ paddingVertical: Spacing[6] }}
              />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar"
              title={t ? 'Sin eventos por ahora' : 'No events yet'}
              message={
                t
                  ? 'Pronto habrá nuevos eventos. Desliza hacia abajo para refrescar.'
                  : 'New events coming soon. Pull down to refresh.'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  EventCard — editorial layout
//  · 16:10 image, no shadow, sharp top-corners
//  · Kicker overline (date) sits above the title
//  · Heading (serif) for the title
//  · Body for venue + capacity
// ─────────────────────────────────────────────
function EventCard({
  ev,
  t,
  lang,
  onPress,
}: {
  ev: EventItem;
  t: boolean;
  lang: 'es' | 'en';
  onPress: () => void;
}) {
  const dateObj = ev.startDate ? new Date(ev.startDate) : null;
  const dateLabel = dateObj
    ? dateObj.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : t
      ? 'Fecha por confirmar'
      : 'Date to be announced';

  const category = ev.category?.name ?? ev.tagLabel ?? null;
  const venue = ev.venue?.name ?? ev.venueName ?? null;

  const a11yLabel = [
    ev.title || ev.name,
    category,
    dateLabel,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressy
      onPress={onPress}
      accessibilityRole={Roles.button}
      accessibilityLabel={a11yLabel}
      accessibilityHint={t ? 'Abre los detalles del evento' : 'Opens event details'}
      style={styles.card}
    >
      {ev.imageUrl ? (
        <Image source={{ uri: ev.imageUrl }} style={styles.cardImg} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImg, styles.cardImgPlaceholder]}>
          <Feather name="calendar" size={28} color={Colors.textMuted} />
        </View>
      )}

      <View style={styles.cardBody}>
        <Kicker tone={category ? 'champagne' : 'muted'}>
          {category ? String(category).toUpperCase() : dateLabel}
        </Kicker>

        <Heading size="sm" style={styles.cardTitle}>
          {ev.title || ev.name}
        </Heading>

        <View style={styles.metaRow}>
          {category ? (
            <Body size="sm" tone="secondary">
              {dateLabel}
            </Body>
          ) : null}
          {venue ? (
            <>
              {category ? (
                <Caption tone="muted" style={styles.metaDot}>
                  ·
                </Caption>
              ) : null}
              <Body size="sm" tone="secondary">
                {venue}
              </Body>
            </>
          ) : null}
        </View>

        {ev.spotsLeft != null || ev.attendees != null || ev.isFree ? (
          <View style={styles.footerRow}>
            {ev.isFree ? (
              <Body size="sm" tone="success" weight="semiBold">
                {t ? 'Entrada libre' : 'Free entry'}
              </Body>
            ) : ev.spotsLeft != null ? (
              <Body size="sm" tone="accent" weight="semiBold">
                {t
                  ? `${ev.spotsLeft} plazas libres`
                  : `${ev.spotsLeft} spots left`}
              </Body>
            ) : null}
            {ev.attendees != null ? (
              <Caption tone="muted">
                {t
                  ? `${ev.attendees} confirmados`
                  : `${ev.attendees} confirmed`}
              </Caption>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[5],
    gap: Spacing[3],
  },
  title: {
    marginTop: Spacing[1],
  },
  searchBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },

  skeletonWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    gap: Spacing[8],
  },

  list: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[10],
  },

  card: {
    backgroundColor: Colors.bgPrimary,
  },
  cardImg: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
  },
  cardImgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingTop: Spacing[4],
    gap: Spacing[2],
  },
  cardTitle: {
    marginTop: Spacing[1],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  metaDot: {
    paddingHorizontal: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing[3],
  },
});
