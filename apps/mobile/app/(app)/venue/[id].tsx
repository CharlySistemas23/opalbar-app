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
import { useAppStore } from '@/stores/app.store';
import { ErrorState } from '@/components/ErrorState';

const HERO_RATIO = 16 / 10;

async function openDirections(venue: {
  lat?: number | string | null;
  lng?: number | string | null;
  address?: string | null;
  name?: string;
}) {
  const lat = venue.lat != null ? Number(venue.lat) : null;
  const lng = venue.lng != null ? Number(venue.lng) : null;
  const name = venue.name ?? 'OPALBAR';
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!hasCoords && !venue.address) {
    Alert.alert('Sin ubicación', 'Este lugar aún no tiene ubicación registrada.');
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    Promise.all([venueApi.get(id), reviewsApi.venueSummary(id)])
      .then(([vRes, rRes]) => {
        setVenue(vRes.data.data);
        setSummary(rRes.data.data);
      })
      .catch((err) => setLoadError(apiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

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

  const rating = Number(venue.ratingAvg ?? summary?.averageRating ?? 0);
  const reviewCount = Number(venue.ratingCount ?? summary?.totalReviews ?? 0);
  const open = !!venue.isActive;

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
                  onPress={() => openDirections(venue)}
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
                  onPress={() => Linking.openURL(venue.website).catch(() => {})}
                />
                <Hairline variant="subtle" />
              </>
            ) : null}
            <Hairline variant="normal" />
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
