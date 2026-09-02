// ─────────────────────────────────────────────
//  Venue Detail — Editorial Premium
//
//  Full-bleed hero 16:10. Kicker (status) + Display (venue name).
//  Rating in serif numeric, lead description, hairline-divided info
//  rows (address, hours, phone), then secondary action ghosts +
//  primary CTA in a sticky footer.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Badge,
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Kicker,
  Numeric,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { reviewsApi, venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { sanitizePublicUrl } from '@/lib/website';
import { useAppStore } from '@/stores/app.store';
import { ErrorState } from '@/components/ErrorState';
import { isOpenNow } from '@/utils/date';
import { shareVenue } from '@/utils/share';

const HERO_RATIO = 16 / 10;
const REVIEWS_PAGE_SIZE = 5;

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
  const name = venue.name ?? 'OPALBAR';
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

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return Linking.openURL(url);
}

async function callVenue(phone?: string | null) {
  if (!phone) return;
  const url = `tel:${phone.replace(/[^+\d]/g, '')}`;
  const can = await Linking.canOpenURL(url).catch(() => false);
  if (can) Linking.openURL(url);
}

export default function VenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const insets = useSafeAreaInsets();
  const [venue, setVenue] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState<number | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      // A reviews-summary or reviews-list hiccup must not blank the whole
      // screen — only the venue fetch itself is load-bearing.
      const [vRes, rRes, revRes] = await Promise.allSettled([
        venueApi.get(id),
        reviewsApi.venueSummary(id),
        reviewsApi.byVenue(id, { page: 1, limit: REVIEWS_PAGE_SIZE }),
      ]);

      if (vRes.status === 'fulfilled') {
        setVenue(vRes.value.data.data);
      } else {
        setVenue(null);
        setLoadError(apiError(vRes.reason));
      }
      setSummary(rRes.status === 'fulfilled' ? rRes.value.data.data : null);
      if (revRes.status === 'fulfilled') {
        const payload = revRes.value.data?.data;
        setReviews(payload?.data ?? []);
        setReviewsTotal(payload?.meta?.total ?? payload?.data?.length ?? 0);
        setReviewsHasMore(!!payload?.meta?.hasNextPage);
        setReviewsPage(1);
      } else {
        setReviews([]);
        setReviewsTotal(null);
        setReviewsHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function loadMoreReviews() {
    if (reviewsLoadingMore || !reviewsHasMore) return;
    setReviewsLoadingMore(true);
    try {
      const nextPage = reviewsPage + 1;
      const r = await reviewsApi.byVenue(id, { page: nextPage, limit: REVIEWS_PAGE_SIZE });
      const payload = r.data?.data;
      setReviews((prev) => [...prev, ...(payload?.data ?? [])]);
      setReviewsPage(nextPage);
      setReviewsHasMore(!!payload?.meta?.hasNextPage);
    } catch {
      // Keep what we have.
    } finally {
      setReviewsLoadingMore(false);
    }
  }

  async function handleShare() {
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

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.headerBar}>
          <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} />
        </View>
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, gap: Spacing[5], marginTop: Spacing[5] }}>
          <Skeleton width="100%" height={220} radius={Radius.lg} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="80%" height={36} />
          <Skeleton width="100%" height={18} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError && !venue) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ErrorState
          message={loadError}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      </SafeAreaView>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
        <Body tone="secondary">{t ? 'Venue no encontrado' : 'Venue not found'}</Body>
      </SafeAreaView>
    );
  }

  const rating = Number(venue.ratingAvg ?? summary?.average ?? 0);
  const reviewCount = Number(venue.ratingCount ?? summary?.total ?? reviewsTotal ?? 0);
  const open = isOpenNow(venue.openTime, venue.closeTime);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 180 + insets.bottom }}
      >
        {/* Hero ────────────────────────── */}
        <View style={styles.heroWrap}>
          {venue.coverUrl || venue.imageUrl ? (
            <Image
              source={{ uri: venue.coverUrl || venue.imageUrl }}
              style={styles.heroImg}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.heroImg, styles.heroFallback]}>
              <Feather name="image" size={40} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.heroHeader}>
            <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} overlay />
            <Pressy
              onPress={handleShare}
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Compartir' : 'Share'}
              hitSlop={HitSlop.expand}
              style={styles.backBtnOverlay}
            >
              <Feather name="share-2" size={18} color={Colors.textPrimary} />
            </Pressy>
          </View>
        </View>

        {/* Body ─────────────────────────── */}
        <View style={styles.body}>
          <FadeIn>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
              <Kicker tone="champagne">{t ? 'VENUE' : 'VENUE'}</Kicker>
              <Badge
                label={open ? (t ? 'ABIERTO' : 'OPEN') : t ? 'CERRADO' : 'CLOSED'}
                variant={open ? 'success' : 'default'}
                size="sm"
              />
            </View>
          </FadeIn>

          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">{venue.name}</Display>
          </FadeIn>

          {/* Rating row */}
          {reviewCount > 0 ? (
            <FadeIn delay={160} style={styles.ratingRow}>
              <Numeric size="sm">{rating.toFixed(1)}</Numeric>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
                <Feather name="star" size={14} color={Colors.accentWarning} />
                <Caption tone="muted">
                  {`${reviewCount} ${t ? 'reseñas' : 'reviews'}`}
                </Caption>
              </View>
            </FadeIn>
          ) : null}

          {venue.description ? (
            <FadeIn delay={240} style={{ marginTop: Spacing[5] }}>
              <Body size="lg" tone="secondary">
                {venue.description}
              </Body>
            </FadeIn>
          ) : null}

          {/* Info rows ─────────────────── */}
          <FadeIn delay={320} style={{ marginTop: Spacing[8] }}>
            <Hairline variant="normal" />
            {venue.address ? (
              <>
                <InfoRow
                  icon="map-pin"
                  kicker={t ? 'DIRECCIÓN' : 'ADDRESS'}
                  value={venue.address}
                  onPress={() => openDirections(venue, t)}
                />
                <Hairline variant="subtle" />
              </>
            ) : null}
            {venue.openTime && venue.closeTime ? (
              <>
                <InfoRow
                  icon="clock"
                  kicker={t ? 'HORARIO' : 'HOURS'}
                  value={`${venue.openTime}–${venue.closeTime}`}
                />
                <Hairline variant="subtle" />
              </>
            ) : null}
            {venue.phone ? (
              <>
                <InfoRow
                  icon="phone"
                  kicker={t ? 'TELÉFONO' : 'PHONE'}
                  value={venue.phone}
                  onPress={() => callVenue(venue.phone)}
                />
                <Hairline variant="subtle" />
              </>
            ) : null}
            {venue.website ? (
              <>
                <InfoRow
                  icon="globe"
                  kicker={t ? 'SITIO' : 'WEBSITE'}
                  value={venue.website}
                  onPress={() => {
                    const safe = sanitizePublicUrl(venue.website);
                    Linking.openURL(safe).catch(() => {});
                  }}
                />
                <Hairline variant="subtle" />
              </>
            ) : null}
            <Hairline variant="normal" />
          </FadeIn>

          {/* Reviews ─────────────────────── */}
          <FadeIn delay={380} style={{ marginTop: Spacing[8] }}>
            <View style={styles.sectionHeader}>
              <Kicker tone="muted">{t ? 'RESEÑAS' : 'REVIEWS'}</Kicker>
              <Pressy
                onPress={() => router.push(`/(app)/venue/${id}/review`)}
                accessibilityRole={Roles.link}
                accessibilityLabel={t ? 'Escribir reseña' : 'Write a review'}
                hitSlop={HitSlop.expand}
                haptic="select"
              >
                <Caption tone="accent">{t ? 'Escribir reseña' : 'Write a review'}</Caption>
              </Pressy>
            </View>
            {reviews.length === 0 ? (
              <Body size="sm" tone="muted" style={{ marginTop: Spacing[2] }}>
                {t ? 'Sé el primero en dejar una reseña.' : 'Be the first to leave a review.'}
              </Body>
            ) : (
              <View style={{ marginTop: Spacing[3], gap: Spacing[4] }}>
                {reviews.map((r, idx) => (
                  <View key={r.id}>
                    <ReviewRow review={r} t={t} />
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
          </FadeIn>
        </View>
      </ScrollView>

      {/* Sticky CTA ─────────────────── */}
      <View style={[styles.ctaWrap, { paddingBottom: Spacing[4] + insets.bottom }]}>
        <Hairline variant="subtle" />
        <View style={styles.ctaInner}>
          <Button
            label={t ? 'Hacer reservación' : 'Make reservation'}
            onPress={() => router.push({ pathname: '/(app)/reservations/new', params: { venueId: id } })}
            variant="primary"
            size="lg"
            fullWidth
          />
          <Pressy
            onPress={() => router.push(`/(app)/venue/${id}/review`)}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Escribir reseña' : 'Write a review'}
            hitSlop={HitSlop.expand}
            haptic="select"
            style={styles.reviewBtn}
          >
            <Subhead tone="accent">{t ? 'Escribir reseña' : 'Write a review'}</Subhead>
          </Pressy>
        </View>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  kicker,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  kicker: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={16} color={Colors.accentChampagne} />
      </View>
      <View style={{ flex: 1 }}>
        <Kicker tone="muted">{kicker}</Kicker>
        <Body
          tone="primary"
          style={{ marginTop: Spacing[1] }}
          numberOfLines={2}
        >
          {value}
        </Body>
      </View>
      {onPress ? (
        <Feather name="chevron-right" size={16} color={Colors.textMuted} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressy
        onPress={onPress}
        accessibilityRole={Roles.button}
        accessibilityLabel={`${kicker}: ${value}`}
        haptic="select"
      >
        {content}
      </Pressy>
    );
  }
  return content;
}

function ReviewRow({ review, t }: { review: any; t: boolean }) {
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

function BackBtn({
  onPress,
  label,
  overlay,
}: {
  onPress: () => void;
  label: string;
  overlay?: boolean;
}) {
  return (
    <Pressy
      onPress={onPress}
      accessibilityRole={Roles.button}
      accessibilityLabel={label}
      hitSlop={HitSlop.expand}
      style={[styles.backBtn, overlay && styles.backBtnOverlay]}
    >
      <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
    </Pressy>
  );
}

const screenWidth = Dimensions.get('window').width;
const heroHeight = Math.round(screenWidth / HERO_RATIO);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },

  heroWrap: { width: '100%' },
  heroImg: { width: '100%', height: heroHeight, backgroundColor: Colors.bgCard },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroHeader: {
    position: 'absolute',
    top: Spacing[2],
    left: EditorialSpacing.pageGutter,
    right: EditorialSpacing.pageGutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },
  backBtnOverlay: {
    backgroundColor: 'rgba(8,7,6,0.45)',
    borderRadius: Radius.full,
    width: 40,
    height: 40,
    marginLeft: 0,
  },

  body: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[8],
  },

  ratingRow: {
    marginTop: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[4],
    gap: Spacing[4],
  },
  infoIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadMoreBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bgPrimary,
  },
  ctaInner: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    gap: Spacing[3],
  },
  reviewBtn: {
    alignItems: 'center',
    paddingVertical: Spacing[2],
  },
});
