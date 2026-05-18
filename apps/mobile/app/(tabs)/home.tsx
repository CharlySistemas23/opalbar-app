// ─────────────────────────────────────────────
//  Home — Editorial Premium
//
//  Magazine layout:
//   · Top bar: brand wordmark (left), notifications glyph (right)
//   · Section 1 — ESTA NOCHE (hero event). Full-bleed 16:10 image
//     followed by a kicker + display title beneath. No overlay text on
//     the image; the headline lives on bg, like a real magazine.
//   · Section 2 — PRÓXIMOS (upcoming events). Vertical stack of cards,
//     each with image (16:10), kicker (categoria · fecha), heading (title).
//   · Section 3 — OFERTAS (current offers). Editorial ListItem-style.
//
//  Loading: SkeletonList. Empty: EmptyState. Error: ErrorState.
//  Pull-to-refresh enabled. Each section enters with stagger.
// ─────────────────────────────────────────────
import { useCallback, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { eventsApi, offersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import {
  Body,
  Card,
  Caption,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  Skeleton,
  SkeletonList,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface EventItem {
  id: string;
  name?: string;
  title?: string;
  startDate?: string;
  imageUrl?: string;
  category?: { name?: string; color?: string };
  spotsLeft?: number;
}

interface OfferItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  maxRedemptions?: number;
  currentRedemptions?: number;
  validWhen?: string;
  usesLeft?: number;
  icon?: FeatherIcon;
}

function toAbsoluteImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:image/')) return url;
  const api = process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1';
  const base = api.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatLongDate(d: string | undefined, language: string): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString(language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
}

export default function Home() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [events, setEvents] = useState<EventItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  const load = useCallback(async () => {
    setErrored(false);
    try {
      const [er, or] = await Promise.all([
        eventsApi.list({ limit: 4 }).catch(() => null),
        offersApi.list({ limit: 3 }).catch(() => null),
      ]);
      const evs = er?.data?.data?.data ?? [];
      const ofs = or?.data?.data?.data ?? [];
      if (er === null && or === null) setErrored(true);
      setEvents(evs);
      setOffers(ofs);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hero = events[0];
  const upcoming = (hero ? events.slice(1) : events).slice(0, 3);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={Colors.textMuted}
          />
        }
      >
        <Header onBellPress={() => router.push('/(app)/profile/notifications' as never)} />

        {errored && !loading ? (
          <View style={{ minHeight: 280 }}>
            <ErrorState
              message={
                t
                  ? 'No pudimos cargar los eventos y ofertas. Inténtalo de nuevo.'
                  : "We couldn't load events and offers. Try again."
              }
              onRetry={load}
            />
          </View>
        ) : (
          <>
            <HeroBlock
              event={hero}
              loading={loading}
              t={t}
              language={language}
              onPress={(id) => router.push(`/(app)/events/${id}` as never)}
            />

            <Section
              kicker={t ? 'PRÓXIMOS' : 'COMING UP'}
              title={t ? 'Próximos eventos' : 'Upcoming events'}
              ctaLabel={t ? 'Ver todos' : 'See all'}
              onCtaPress={() => router.push('/(tabs)/events' as never)}
              delay={140}
            >
              {loading && upcoming.length === 0 ? (
                <SkeletonList count={2} itemHeight={200} />
              ) : upcoming.length === 0 ? (
                <View style={{ minHeight: 220 }}>
                  <EmptyState
                    icon="calendar"
                    title={t ? 'Sin próximos eventos' : 'No upcoming events'}
                    message={
                      t
                        ? 'Estamos preparando algo. Vuelve pronto.'
                        : 'Something is in the works. Come back soon.'
                    }
                  />
                </View>
              ) : (
                upcoming.map((ev, idx) => (
                  <FadeIn key={ev.id ?? idx} delay={70 * idx}>
                    <UpcomingCard
                      event={ev}
                      onPress={() => ev.id && router.push(`/(app)/events/${ev.id}` as never)}
                      t={t}
                      language={language}
                    />
                  </FadeIn>
                ))
              )}
            </Section>

            <Section
              kicker={t ? 'OFERTAS' : 'OFFERS'}
              title={t ? 'Ofertas vigentes' : 'Current offers'}
              ctaLabel={t ? 'Ver todas' : 'See all'}
              onCtaPress={() => router.push('/(app)/offers' as never)}
              delay={220}
            >
              {loading && offers.length === 0 ? (
                <SkeletonList count={2} itemHeight={88} />
              ) : offers.length === 0 ? (
                <View style={{ minHeight: 200 }}>
                  <EmptyState
                    icon="tag"
                    title={t ? 'Sin ofertas vigentes' : 'No current offers'}
                  />
                </View>
              ) : (
                offers.map((off, idx) => (
                  <FadeIn key={off.id ?? idx} delay={70 * idx}>
                    <OfferRow
                      offer={off}
                      onPress={() => off.id && router.push(`/(app)/offers/${off.id}` as never)}
                      t={t}
                    />
                  </FadeIn>
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Header ───────────────────────────────────
function Header({ onBellPress }: { onBellPress: () => void }) {
  return (
    <View style={styles.header}>
      <View>
        <Kicker tone="muted">OPALBAR</Kicker>
      </View>
      <Pressy
        onPress={onBellPress}
        haptic="select"
        accessibilityRole={Roles.button}
        accessibilityLabel="Notificaciones"
        hitSlop={HitSlop.expand}
        style={styles.bellBtn}
      >
        <Feather name="bell" size={20} color={Colors.textPrimary} />
      </Pressy>
    </View>
  );
}

// ── Hero block ───────────────────────────────
function HeroBlock({
  event,
  loading,
  t,
  language,
  onPress,
}: {
  event?: EventItem;
  loading: boolean;
  t: boolean;
  language: string;
  onPress: (id: string) => void;
}) {
  if (loading && !event) {
    return (
      <FadeIn style={styles.heroWrap}>
        <Skeleton height={240} radius={Radius.card} />
        <View style={{ marginTop: Spacing[5] }}>
          <Skeleton height={14} width={120} />
          <View style={{ height: Spacing[3] }} />
          <Skeleton height={36} width="80%" />
        </View>
      </FadeIn>
    );
  }

  if (!event) {
    return (
      <View style={[styles.heroWrap, { minHeight: 280 }]}>
        <EmptyState
          icon="calendar"
          title={t ? 'Sin eventos esta noche' : 'No events tonight'}
          message={
            t
              ? 'Vuelve mañana — siempre hay algo nuevo.'
              : 'Come back tomorrow — there is always something new.'
          }
        />
      </View>
    );
  }

  const title = event.title || event.name || (t ? 'Sin título' : 'Untitled');
  const dateLabel = formatLongDate(event.startDate, language).toUpperCase();
  const venueLabel = event.category?.name?.toUpperCase();
  const overline = [t ? 'ESTA NOCHE' : 'TONIGHT', dateLabel, venueLabel]
    .filter(Boolean)
    .join(' · ');

  return (
    <FadeIn style={styles.heroWrap}>
      <Pressy
        onPress={() => onPress(event.id)}
        haptic="select"
        accessibilityRole={Roles.button}
        accessibilityLabel={`${title}. ${dateLabel}.`}
        style={styles.heroPress}
      >
        <View style={styles.heroImageWrap}>
          {event.imageUrl ? (
            <Image
              source={{ uri: toAbsoluteImageUrl(event.imageUrl) }}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.heroImage, styles.heroImagePlaceholder]} />
          )}
        </View>
        <View style={styles.heroText}>
          <Kicker tone="champagne">{overline}</Kicker>
          <Heading size="lg" style={{ marginTop: Spacing[2] }}>
            {title}
          </Heading>
          {event.spotsLeft != null ? (
            <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
              {t ? `${event.spotsLeft} plazas disponibles` : `${event.spotsLeft} spots available`}
            </Caption>
          ) : null}
        </View>
      </Pressy>
    </FadeIn>
  );
}

// ── Section header ───────────────────────────
function Section({
  kicker,
  title,
  ctaLabel,
  onCtaPress,
  delay,
  children,
}: {
  kicker: string;
  title: string;
  ctaLabel: string;
  onCtaPress: () => void;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <FadeIn delay={delay}>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Kicker tone="muted">{kicker}</Kicker>
            <Heading size="sm" style={{ marginTop: Spacing[1] }}>
              {title}
            </Heading>
          </View>
          <Pressy
            onPress={onCtaPress}
            haptic="select"
            accessibilityRole={Roles.link}
            accessibilityLabel={ctaLabel}
            hitSlop={HitSlop.expand}
          >
            <Body size="sm" tone="accent" weight="semiBold">
              {ctaLabel}
            </Body>
          </Pressy>
        </View>
        <Hairline variant="subtle" style={{ marginTop: Spacing[4], marginBottom: Spacing[4] }} />
      </FadeIn>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ── Upcoming card ────────────────────────────
function UpcomingCard({
  event,
  onPress,
  t,
  language,
}: {
  event: EventItem;
  onPress: () => void;
  t: boolean;
  language: string;
}) {
  const title = event.title || event.name || (t ? 'Sin título' : 'Untitled');
  const date = formatLongDate(event.startDate, language).toUpperCase();
  const cat = event.category?.name?.toUpperCase();
  const overline = [cat, date].filter(Boolean).join(' · ');

  return (
    <Card
      onPress={onPress}
      padding={0}
      variant="flat"
      radius="card"
      accessibilityLabel={`${title}. ${date}.`}
    >
      <View>
        <View style={styles.upcomingImageWrap}>
          {event.imageUrl ? (
            <Image
              source={{ uri: toAbsoluteImageUrl(event.imageUrl) }}
              style={styles.upcomingImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.upcomingImage, styles.heroImagePlaceholder]} />
          )}
        </View>
        <View style={styles.upcomingText}>
          {overline ? <Kicker tone="champagne">{overline}</Kicker> : null}
          <Heading size="sm" style={{ marginTop: Spacing[2] }}>
            {title}
          </Heading>
        </View>
      </View>
    </Card>
  );
}

// ── Offer row ────────────────────────────────
function OfferRow({
  offer,
  onPress,
  t,
}: {
  offer: OfferItem;
  onPress: () => void;
  t: boolean;
}) {
  const usesLeft =
    offer.usesLeft ??
    (offer.maxRedemptions != null
      ? Math.max(0, offer.maxRedemptions - (offer.currentRedemptions ?? 0))
      : null);

  return (
    <Card onPress={onPress} variant="flat" padding={Spacing[4]} accessibilityLabel={offer.title}>
      <View style={styles.offerRow}>
        <View style={styles.offerIconBox}>
          {offer.imageUrl ? (
            <Image source={{ uri: offer.imageUrl }} style={styles.offerIconImg} resizeMode="cover" />
          ) : (
            <Feather name={offer.icon || 'tag'} size={20} color={Colors.accentChampagne} />
          )}
        </View>
        <View style={styles.offerInfo}>
          <Heading size="sm" numberOfLines={2}>
            {offer.title}
          </Heading>
          {offer.validWhen || offer.description ? (
            <Caption tone="muted" style={{ marginTop: 2 }} numberOfLines={2}>
              {offer.validWhen || offer.description}
            </Caption>
          ) : null}
          {usesLeft != null ? (
            <Caption tone="champagne" style={{ marginTop: Spacing[1] }}>
              {t ? `${usesLeft} usos restantes` : `${usesLeft} uses left`}
            </Caption>
          ) : null}
        </View>
        <Feather name="chevron-right" size={20} color={Colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: Spacing[10] },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[6],
  },
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },

  // Hero block
  heroWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  heroPress: {
    gap: 0,
  },
  heroImageWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImagePlaceholder: {
    backgroundColor: Colors.bgElevated,
  },
  heroText: {
    marginTop: Spacing[5],
  },

  // Sections
  section: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[8],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing[3],
  },
  sectionBody: {
    gap: Spacing[3],
  },

  // Upcoming
  upcomingImageWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: Colors.bgElevated,
  },
  upcomingImage: {
    width: '100%',
    height: '100%',
  },
  upcomingText: {
    padding: Spacing[5],
  },

  // Offer
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
  },
  offerIconBox: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  offerIconImg: {
    width: 56,
    height: 56,
  },
  offerInfo: {
    flex: 1,
  },
});
