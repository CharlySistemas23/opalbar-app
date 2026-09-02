// ─────────────────────────────────────────────
//  Bar — Editorial Premium
//
//  The venue's editorial hub. Full-bleed hero image, kicker overline,
//  serif Display title, restrained metadata, primary CTA. Horarios and
//  contact info read as ListItems; upcoming events and offers sit in
//  hairline-separated sections — no glassmorphism, no rounded pill noise.
// ─────────────────────────────────────────────
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { eventsApi, offersApi, reviewsApi, venueApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import {
  Colors,
  EditorialSpacing,
  Radius,
  Spacing,
} from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { playUiSound } from '@/hooks/useFeedback';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  ListItem,
  Pressy,
  Skeleton,
  SkeletonText,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { OpalbarRoutes } from '@/lib/website';
import { isOpenNow } from '@/utils/date';
import { shareVenue } from '@/utils/share';

const REVIEWS_PAGE_SIZE = 5;

// ── External actions ─────────────────────────
async function openDirections(
  venue: {
    lat?: number | string | null;
    lng?: number | string | null;
    address?: string | null;
    name?: string;
  },
  t: boolean,
) {
  const lat = venue.lat != null ? Number(venue.lat) : null;
  const lng = venue.lng != null ? Number(venue.lng) : null;
  const name = venue.name ?? 'OPAL BAR';
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!hasCoords && !venue.address) {
    Alert.alert(
      t ? 'Sin ubicación' : 'No location',
      t ? 'Este lugar aún no tiene ubicación registrada.' : "This venue doesn't have a location on file yet.",
    );
    return;
  }

  if (Platform.OS === 'ios') {
    const appleUrl = hasCoords
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`
      : `http://maps.apple.com/?q=${encodeURIComponent(`${name} ${venue.address ?? ''}`)}`;
    const canOpen = await Linking.canOpenURL(appleUrl).catch(() => false);
    if (canOpen) return Linking.openURL(appleUrl);
  }

  const query = hasCoords && venue.address
    ? `${name}, ${venue.address}`
    : hasCoords
      ? `${lat},${lng}(${name})`
      : `${name} ${venue.address}`;

  return Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  );
}

async function callVenue(phone?: string | null) {
  if (!phone) return;
  const url = `tel:${phone.replace(/[^+\d]/g, '')}`;
  const can = await Linking.canOpenURL(url).catch(() => false);
  if (can) Linking.openURL(url);
}

// ─────────────────────────────────────────────
//  Bar screen
// ─────────────────────────────────────────────
export default function BarTab() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [venue, setVenue] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState<number | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const listRes = await venueApi.list({ limit: 1 });
      const payload = listRes.data?.data;
      const first = Array.isArray(payload?.data)
        ? payload.data[0]
        : Array.isArray(payload)
          ? payload[0]
          : null;
      if (!first) {
        setVenue(null);
        setError(t ? 'Aún no hay información del bar.' : 'No bar info yet.');
        return;
      }
      const nowIso = new Date().toISOString();
      // A summary/offers/events/reviews hiccup must never blank the whole
      // screen — only the venue fetch itself is load-bearing.
      const [vRes, rRes, oRes, eRes, revRes] = await Promise.allSettled([
        venueApi.get(first.id),
        reviewsApi.venueSummary(first.id),
        offersApi.list({ limit: 3, venueId: first.id }),
        eventsApi.list({ limit: 4, venueId: first.id, startDate: nowIso }),
        reviewsApi.byVenue(first.id, { page: 1, limit: REVIEWS_PAGE_SIZE }),
      ]);

      if (vRes.status === 'fulfilled') {
        setVenue(vRes.value.data?.data ?? first);
      } else {
        setVenue(first);
      }
      setSummary(rRes.status === 'fulfilled' ? rRes.value.data?.data ?? null : null);
      setOffers(oRes.status === 'fulfilled' ? oRes.value.data?.data?.data ?? [] : []);
      setEvents(eRes.status === 'fulfilled' ? eRes.value.data?.data?.data ?? [] : []);
      if (revRes.status === 'fulfilled') {
        const rPayload = revRes.value.data?.data;
        setReviews(rPayload?.data ?? []);
        setReviewsTotal(rPayload?.meta?.total ?? rPayload?.data?.length ?? 0);
        setReviewsHasMore(!!rPayload?.meta?.hasNextPage);
        setReviewsPage(1);
      } else {
        setReviews([]);
        setReviewsTotal(null);
        setReviewsHasMore(false);
      }
    } catch (err: any) {
      setVenue(null);
      setError(err?.response?.data?.message || (t ? 'Error al cargar' : 'Load error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function loadMoreReviews() {
    if (!venue || reviewsLoadingMore || !reviewsHasMore) return;
    setReviewsLoadingMore(true);
    try {
      const nextPage = reviewsPage + 1;
      const r = await reviewsApi.byVenue(venue.id, { page: nextPage, limit: REVIEWS_PAGE_SIZE });
      const rPayload = r.data?.data;
      setReviews((prev) => [...prev, ...(rPayload?.data ?? [])]);
      setReviewsPage(nextPage);
      setReviewsHasMore(!!rPayload?.meta?.hasNextPage);
    } catch {
      // Keep what we have; the "cargar más" affordance simply stays put.
    } finally {
      setReviewsLoadingMore(false);
    }
  }

  async function handleShareVenue() {
    if (!venue) return;
    await shareVenue({
      id: venue.id,
      name: venue.name,
      description: venue.description,
      imageUrl: venue.coverUrl || venue.imageUrl,
      address: venue.address,
      rating: Number(venue.ratingAvg ?? summary?.average ?? 0),
      t,
    });
  }

  // ── Loading skeleton ───────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Skeleton width="100%" height={260} radius={0} />
        <View style={styles.content}>
          <Skeleton width={120} height={11} />
          <View style={{ height: Spacing[2] }} />
          <Skeleton width="80%" height={36} />
          <View style={{ height: Spacing[5] }} />
          <SkeletonText lines={3} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error / empty venue ─────────────────────
  if (!venue) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ErrorState
          message={error || (t ? 'Sin datos' : 'No data')}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      </SafeAreaView>
    );
  }

  const rating = Number(venue.ratingAvg ?? summary?.average ?? 0);
  const reviewCount = Number(venue.ratingCount ?? summary?.total ?? reviewsTotal ?? 0);
  const heroImage = venue.coverUrl || venue.imageUrl || null;
  const open = isOpenNow(venue.openTime, venue.closeTime);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              playUiSound('swoosh');
              setRefreshing(true);
              load();
            }}
            tintColor={Colors.accentPrimary}
          />
        }
      >
        {/* ── Hero image ─────────────────────── */}
        <FadeIn>
          <View style={styles.hero}>
            {heroImage ? (
              <Image source={{ uri: heroImage }} style={styles.heroImg} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImg, styles.heroPlaceholder]}>
                <Feather name="image" size={28} color={Colors.textMuted} />
              </View>
            )}
            <Pressy
              onPress={handleShareVenue}
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Compartir lugar' : 'Share venue'}
              hitSlop={HitSlop.expand}
              style={styles.shareOverlay}
            >
              <Feather name="share-2" size={18} color={Colors.textPrimary} />
            </Pressy>
          </View>
        </FadeIn>

        {/* ── Identity block ────────────────── */}
        <View style={styles.identity}>
          <FadeIn delay={120}>
            <Kicker tone="champagne">
              {open
                ? t ? 'ABIERTO AHORA' : 'OPEN NOW'
                : t ? 'CERRADO' : 'CLOSED'}
            </Kicker>
          </FadeIn>
          <FadeIn delay={200} style={{ marginTop: Spacing[3] }}>
            <Display size="md">{venue.name}</Display>
          </FadeIn>

          {reviewCount > 0 ? (
            <FadeIn delay={280} style={{ marginTop: Spacing[3] }}>
              <View style={styles.ratingRow}>
                <Feather name="star" size={14} color={Colors.accentChampagne} />
                <Body size="sm" tone="primary" weight="semiBold">
                  {rating.toFixed(1)}
                </Body>
                <Caption tone="muted">
                  · {reviewCount} {t ? 'reseñas' : 'reviews'}
                </Caption>
              </View>
            </FadeIn>
          ) : null}

          {venue.description ? (
            <FadeIn delay={360} style={{ marginTop: Spacing[4] }}>
              <Body size="md" tone="secondary">
                {venue.description}
              </Body>
            </FadeIn>
          ) : null}
        </View>

        {/* ── Primary reservation CTA ──────── */}
        <FadeIn delay={420}>
          <View style={styles.primaryCtaWrap}>
            <Button
              label={t ? 'Reservar mesa' : 'Reserve a table'}
              onPress={() =>
                router.push({
                  pathname: '/(app)/reservations/new',
                  params: { venueId: venue.id },
                } as never)
              }
              variant="primary"
              size="lg"
              fullWidth
              rightIcon={<Feather name="arrow-right" size={18} color={Colors.textInverse} />}
            />
          </View>
        </FadeIn>

        {/* ── Quick actions row ─────────────── */}
        <FadeIn delay={460}>
          <View style={styles.actionsRow}>
            <ActionTile
              icon="navigation"
              label={t ? 'Cómo llegar' : 'Directions'}
              onPress={() => openDirections(venue, t)}
            />
            {venue.phone ? (
              <ActionTile
                icon="phone"
                label={t ? 'Llamar' : 'Call'}
                onPress={() => callVenue(venue.phone)}
              />
            ) : null}
            <ActionTile
              icon="globe"
              label={t ? 'Sitio' : 'Website'}
              onPress={() => OpalbarRoutes.home()}
            />
          </View>
        </FadeIn>

        <Hairline style={styles.sectionDivider} />

        {/* ── Info ─────────────────────────── */}
        <Section title={t ? 'Información' : 'Information'}>
          <View style={styles.infoList}>
            {venue.address ? (
              <>
                <ListItem
                  title={venue.address}
                  subtitle={t ? 'Dirección' : 'Address'}
                  leftIcon={<Feather name="map-pin" size={18} color={Colors.textMuted} />}
                  onPress={() => openDirections(venue, t)}
                  accessibilityHint={t ? 'Abre en el mapa' : 'Opens in maps'}
                />
                <Hairline variant="subtle" />
              </>
            ) : null}

            {venue.openTime && venue.closeTime ? (
              <>
                <ListItem
                  title={`${venue.openTime} – ${venue.closeTime}`}
                  subtitle={t ? 'Horario' : 'Hours'}
                  leftIcon={<Feather name="clock" size={18} color={Colors.textMuted} />}
                />
                <Hairline variant="subtle" />
              </>
            ) : null}

            {venue.phone ? (
              <ListItem
                title={venue.phone}
                subtitle={t ? 'Teléfono' : 'Phone'}
                leftIcon={<Feather name="phone" size={18} color={Colors.textMuted} />}
                onPress={() => callVenue(venue.phone)}
                accessibilityHint={t ? 'Inicia una llamada' : 'Starts a call'}
              />
            ) : null}
          </View>
        </Section>

        <Hairline style={styles.sectionDivider} />

        {/* ── Carta del Club ──────────────── */}
        <Section title={t ? 'La carta' : 'The menu'}>
          <View style={styles.menuTiles}>
            <Pressy
              onPress={() => OpalbarRoutes.menu()}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Ver carta de cocteles' : 'View cocktails menu'}
              style={styles.menuTile}
            >
              <Feather name="droplet" size={20} color={Colors.accentChampagne} />
              <Body size="sm" weight="semiBold" style={{ marginTop: Spacing[2] }}>
                {t ? 'Cocteles' : 'Cocktails'}
              </Body>
              <Caption tone="muted" style={{ marginTop: 2 }}>
                {t ? 'Signature & clásicos' : 'Signature & classics'}
              </Caption>
            </Pressy>
            <Pressy
              onPress={() => OpalbarRoutes.menu()
              }
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Ver carta de cocina' : 'View kitchen menu'}
              style={styles.menuTile}
            >
              <Feather name="coffee" size={20} color={Colors.accentChampagne} />
              <Body size="sm" weight="semiBold" style={{ marginTop: Spacing[2] }}>
                {t ? 'Cocina' : 'Kitchen'}
              </Body>
              <Caption tone="muted" style={{ marginTop: 2 }}>
                {t ? 'Tapas, snacks, platos' : 'Tapas, snacks, plates'}
              </Caption>
            </Pressy>
          </View>
        </Section>

        <Hairline style={styles.sectionDivider} />

        {/* ── Upcoming events ───────────────── */}
        <Section
          title={t ? 'Próximos eventos' : 'Upcoming events'}
          actionLabel={events.length > 0 ? (t ? 'Ver todos' : 'See all') : undefined}
          onAction={() => router.push('/(tabs)/events' as never)}
        >
          {events.length === 0 ? (
            <Body size="sm" tone="muted">
              {t ? 'Sin eventos próximos.' : 'No upcoming events.'}
            </Body>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventsRow}
            >
              {events.map((e) => {
                const dt = e.startDate ? new Date(e.startDate) : null;
                const dateLabel = dt
                  ? dt.toLocaleDateString(t ? 'es-MX' : 'en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })
                  : '';
                const timeLabel = dt
                  ? dt.toLocaleTimeString(t ? 'es-MX' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';
                return (
                  <Pressy
                    key={e.id}
                    onPress={() => router.push(`/(app)/events/${e.id}` as never)}
                    accessibilityRole={Roles.button}
                    accessibilityLabel={e.title}
                    style={styles.eventCard}
                  >
                    {e.imageUrl ? (
                      <Image
                        source={{ uri: e.imageUrl }}
                        style={styles.eventImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.eventImg, styles.eventImgPlaceholder]}>
                        <Feather name="calendar" size={22} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.eventBody}>
                      {dateLabel ? (
                        <Kicker tone="champagne">
                          {dateLabel}
                          {timeLabel ? ` · ${timeLabel}` : ''}
                        </Kicker>
                      ) : null}
                      <Body
                        size="sm"
                        weight="semiBold"
                        numberOfLines={2}
                        style={styles.eventTitle}
                      >
                        {e.title}
                      </Body>
                    </View>
                  </Pressy>
                );
              })}
            </ScrollView>
          )}
        </Section>

        <Hairline style={styles.sectionDivider} />

        {/* ── Active offers ─────────────────── */}
        <Section
          title={t ? 'Ofertas activas' : 'Active offers'}
          actionLabel={offers.length > 0 ? (t ? 'Ver todas' : 'See all') : undefined}
          onAction={() => router.push('/(app)/offers' as never)}
        >
          {offers.length === 0 ? (
            <Body size="sm" tone="muted">
              {t ? 'Sin ofertas por ahora.' : 'No offers right now.'}
            </Body>
          ) : (
            <View style={styles.offersList}>
              {offers.map((o, idx) => (
                <View key={o.id}>
                  <ListItem
                    title={o.title}
                    subtitle={o.description ?? undefined}
                    leftIcon={
                      o.imageUrl ? (
                        <Image source={{ uri: o.imageUrl }} style={styles.offerImg} />
                      ) : (
                        <Feather name="tag" size={18} color={Colors.textMuted} />
                      )
                    }
                    onPress={() => router.push(`/(app)/offers/${o.id}` as never)}
                  />
                  {idx < offers.length - 1 ? <Hairline variant="subtle" /> : null}
                </View>
              ))}
            </View>
          )}
        </Section>

        <Hairline style={styles.sectionDivider} />

        {/* ── Reviews ────────────────────────── */}
        <Section
          title={t ? 'Reseñas' : 'Reviews'}
          actionLabel={t ? 'Escribir reseña' : 'Write a review'}
          onAction={() => router.push(`/(app)/venue/${venue.id}/review` as never)}
        >
          {reviews.length === 0 ? (
            <Body size="sm" tone="muted">
              {t ? 'Sé el primero en dejar una reseña.' : 'Be the first to leave a review.'}
            </Body>
          ) : (
            <View style={{ gap: Spacing[4] }}>
              {reviews.map((r, idx) => (
                <View key={r.id}>
                  <ReviewRow review={r} language={language} t={t} />
                  {idx < reviews.length - 1 ? <Hairline variant="subtle" style={{ marginTop: Spacing[4] }} /> : null}
                </View>
              ))}
              {reviewsHasMore ? (
                <Pressy
                  onPress={loadMoreReviews}
                  disabled={reviewsLoadingMore}
                  accessibilityRole={Roles.button}
                  accessibilityLabel={t ? 'Cargar más reseñas' : 'Load more reviews'}
                  haptic="select"
                  style={styles.loadMoreBtn}
                >
                  {reviewsLoadingMore ? (
                    <ActivityIndicator color={Colors.accentPrimary} />
                  ) : (
                    <Body size="sm" tone="accent" weight="semiBold">
                      {t ? 'Cargar más' : 'Load more'}
                    </Body>
                  )}
                </Pressy>
              ) : null}
            </View>
          )}
        </Section>

        <Hairline style={styles.sectionDivider} />

        {/* ── Primary actions ───────────────── */}
        <View style={styles.bottomActions}>
          <Button
            label={t ? 'Hacer reservación' : 'Make reservation'}
            onPress={() =>
              router.push({
                pathname: '/(app)/reservations/new',
                params: { venueId: venue.id },
              })
            }
            variant="primary"
            size="lg"
            fullWidth
            accessibilityHint={
              t ? 'Abre el formulario de reservación' : 'Opens the reservation form'
            }
          />
          <Pressy
            onPress={() => router.push(`/(app)/venue/${venue.id}/review` as never)}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Escribir una reseña' : 'Write a review'}
            haptic="select"
            style={styles.reviewBtn}
          >
            <Body size="sm" tone="accent" weight="semiBold">
              {t ? 'Escribir una reseña' : 'Write a review'}
            </Body>
          </Pressy>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  ReviewRow — rating stars + body + author + date
// ─────────────────────────────────────────────
function ReviewRow({
  review,
  language,
  t,
}: {
  review: any;
  language: 'es' | 'en';
  t: boolean;
}) {
  const author = review.user?.profile
    ? `${review.user.profile.firstName ?? ''} ${review.user.profile.lastName ?? ''}`.trim()
    : null;
  const dateLabel = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString(t ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' })
    : '';
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Feather
              key={n}
              name="star"
              size={12}
              color={n <= review.rating ? Colors.accentChampagne : Colors.border}
              style={{ marginRight: 1 }}
            />
          ))}
        </View>
        <Caption tone="muted">
          {[author, dateLabel].filter(Boolean).join(' · ')}
        </Caption>
      </View>
      {review.title ? (
        <Subhead style={{ marginTop: Spacing[2] }}>{review.title}</Subhead>
      ) : null}
      {review.body ? (
        <Body size="sm" tone="secondary" style={{ marginTop: Spacing[1] }}>
          {review.body}
        </Body>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────
//  Section header
// ─────────────────────────────────────────────
function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Kicker tone="muted">{title.toUpperCase()}</Kicker>
        {actionLabel && onAction ? (
          <Pressy
            onPress={onAction}
            accessibilityRole={Roles.link}
            accessibilityLabel={actionLabel}
            hitSlop={HitSlop.expand}
            haptic="select"
          >
            <Caption tone="accent">{actionLabel}</Caption>
          </Pressy>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ─────────────────────────────────────────────
//  ActionTile — equal-flex tile inside actionsRow
// ─────────────────────────────────────────────
function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressy
      onPress={onPress}
      accessibilityRole={Roles.button}
      accessibilityLabel={label}
      style={styles.actionTile}
    >
      <Feather name={icon} size={18} color={Colors.textPrimary} />
      <Caption tone="primary" style={styles.actionTileLabel}>
        {label}
      </Caption>
    </Pressy>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: Spacing[12] },

  // Hero
  hero: { width: '100%', height: 260, backgroundColor: Colors.bgCard },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  shareOverlay: {
    position: 'absolute',
    top: Spacing[2],
    right: EditorialSpacing.pageGutter,
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(8,7,6,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading skeleton content
  content: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[8],
  },

  // Identity block
  identity: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[8],
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },

  // Primary reservation CTA
  primaryCtaWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[6],
  },

  // Menu tiles
  menuTiles: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  menuTile: {
    flex: 1,
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    borderRadius: Radius.md,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[3],
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
  },

  // Actions row
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[3],
  },
  actionTile: {
    flex: 1,
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[1],
  },
  actionTileLabel: {
    textAlign: 'center',
  },

  // Sections
  sectionDivider: {
    marginVertical: Spacing[8],
  },
  section: {
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  sectionBody: {
    // child content
  },

  // Info list
  infoList: {
    marginHorizontal: -EditorialSpacing.pageGutter,
  },

  // Events horizontal row
  eventsRow: {
    gap: Spacing[3],
    paddingRight: Spacing[4],
  },
  eventCard: {
    width: 220,
    backgroundColor: Colors.bgPrimary,
  },
  eventImg: {
    width: '100%',
    height: 130,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
  },
  eventImgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: {
    paddingTop: Spacing[3],
    gap: Spacing[1],
  },
  eventTitle: {
    marginTop: Spacing[1],
  },

  // Offers list
  offersList: {
    marginHorizontal: -EditorialSpacing.pageGutter,
  },
  offerImg: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
  },

  // Reviews
  loadMoreBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom actions
  bottomActions: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    gap: Spacing[3],
  },
  reviewBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
