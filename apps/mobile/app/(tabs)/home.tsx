// ─────────────────────────────────────────────
//  Home — OPALBAR · Club Privado Exclusivo
//
//  Brief del usuario (2026-05-18):
//   · Hero superior 90% del viewport visual — solo OPALBAR + TIER + name
//   · NO mostrar perks primero — la EXPERIENCIA vale más que los beneficios
//   · Orden: Greeting → MembershipCard (flippable) → Tonight at OPALBAR
//     (foto grande) → Your privileges → Upcoming experiences → Community
//     highlights
//
//  Filosofía: "Estoy entrando a un club privado de lujo", no "Estoy
//  revisando una app de recompensas".
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
import { useAuthStore } from '@/stores/auth.store';
import {
  Body,
  Caption,
  FadeIn,
  Hairline,
  Kicker,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { MembershipCard } from '@/components/membership';
import { resolveTier } from '@/constants/tiers';

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
  validWhen?: string;
}

function toAbsoluteImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:image/')) return url;
  const api = process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1';
  const base = api.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatShortDate(d: string | undefined, language: string): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString(language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function formatTime(d: string | undefined, language: string): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleTimeString(language, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatValidThrough(createdAt?: string): string | undefined {
  if (!createdAt) return undefined;
  try {
    const created = new Date(createdAt);
    const expires = new Date(created.getFullYear() + 1, created.getMonth(), created.getDate());
    const mm = String(expires.getMonth() + 1).padStart(2, '0');
    const yy = String(expires.getFullYear()).slice(-2);
    return `${mm}/${yy}`;
  } catch {
    return undefined;
  }
}

function getGreeting(t: boolean): string {
  const h = new Date().getHours();
  if (h < 12) return t ? 'Buenos días' : 'Good morning';
  if (h < 19) return t ? 'Buenas tardes' : 'Good afternoon';
  return t ? 'Buenas noches' : 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const { language } = useAppStore();
  const { user } = useAuthStore();
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
        eventsApi.list({ limit: 5 }).catch(() => null),
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

  // Membership data
  const firstName = user?.profile?.firstName ?? '';
  const lastName = user?.profile?.lastName ?? '';
  const fullName =
    `${firstName} ${lastName}`.trim() || (user?.email?.split('@')[0] ?? 'Miembro');
  const tierName = user?.profile?.loyaltyLevel?.name;
  const tier = resolveTier(tierName);
  const points = user?.points ?? 0;
  const memberNumber = user?.id ? user.id.slice(-4) : undefined;
  const validThrough = formatValidThrough(user?.createdAt);

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
        {/* ── Greeting ── */}
        <FadeIn style={styles.greetingWrap}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Kicker tone="muted">OPALBAR</Kicker>
              <Body size="sm" tone="secondary" style={{ marginTop: 2 }}>
                {getGreeting(t)}, {firstName || 'Miembro'}
              </Body>
            </View>
            <Pressy
              onPress={() => router.push('/(app)/profile/notifications' as never)}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Notificaciones' : 'Notifications'}
              hitSlop={HitSlop.expand}
              style={styles.bellBtn}
            >
              <Feather name="bell" size={20} color={Colors.textPrimary} />
            </Pressy>
          </View>
        </FadeIn>

        {/* ── Membership Card (flippable) ── */}
        <FadeIn delay={80} style={styles.heroWrap}>
          <MembershipCard
            fullName={fullName}
            memberNumber={memberNumber}
            tierName={tierName}
            points={points}
            validThrough={validThrough}
            size="hero"
            flippable
          />
        </FadeIn>

        {errored && !loading ? (
          <View style={{ minHeight: 220, paddingHorizontal: EditorialSpacing.pageGutter }}>
            <ErrorState
              message={
                t
                  ? 'No pudimos cargar la información del club.'
                  : "We couldn't load the club's information."
              }
              onRetry={load}
            />
          </View>
        ) : (
          <>
            {/* ── Tonight at OPALBAR ── */}
            <Section
              kicker={t ? 'ESTA NOCHE EN OPALBAR' : 'TONIGHT AT OPALBAR'}
              delay={160}
            >
              {loading && events.length === 0 ? (
                <Skeleton height={220} radius={Radius.md} />
              ) : events.length === 0 ? (
                <View style={{ minHeight: 180 }}>
                  <EmptyState
                    icon="moon"
                    title={t ? 'Sin programa esta noche' : 'No program tonight'}
                    message={
                      t
                        ? 'El club siempre tiene algo para ti pronto.'
                        : 'The club always has something coming up.'
                    }
                  />
                </View>
              ) : (
                <TonightHero
                  event={events[0]}
                  onPress={() =>
                    events[0]?.id && router.push(`/(app)/events/${events[0].id}` as never)
                  }
                  t={t}
                  language={language}
                />
              )}
            </Section>

            {/* ── Your privileges (cortesías) ── */}
            <Section
              kicker={t ? 'TUS PRIVILEGIOS' : 'YOUR PRIVILEGES'}
              ctaLabel={t ? 'Ver todos' : 'See all'}
              onCtaPress={() => router.push('/(app)/offers' as never)}
              delay={240}
            >
              {loading && offers.length === 0 ? (
                <View style={{ gap: Spacing[2] }}>
                  {[0, 1].map((i) => (
                    <Skeleton key={i} height={56} radius={Radius.sm} />
                  ))}
                </View>
              ) : offers.length === 0 ? (
                <Body tone="muted" style={{ paddingVertical: Spacing[3] }}>
                  {t
                    ? 'Pronto habrá nuevas cortesías para ti.'
                    : 'New privileges will be available soon.'}
                </Body>
              ) : (
                offers.slice(0, 3).map((off, idx) => (
                  <FadeIn key={off.id ?? idx} delay={50 * idx}>
                    <PrivilegeRow
                      offer={off}
                      tierAccent={tier.base}
                      onPress={() => off.id && router.push(`/(app)/offers/${off.id}` as never)}
                    />
                  </FadeIn>
                ))
              )}
            </Section>

            {/* ── Upcoming experiences ── */}
            {events.length > 1 ? (
              <Section
                kicker={t ? 'PRÓXIMAS EXPERIENCIAS' : 'UPCOMING EXPERIENCES'}
                ctaLabel={t ? 'Ver todas' : 'See all'}
                onCtaPress={() => router.push('/(tabs)/events' as never)}
                delay={320}
              >
                {events.slice(1, 4).map((ev, idx) => (
                  <FadeIn key={ev.id ?? idx} delay={50 * idx}>
                    <ExperienceRow
                      event={ev}
                      onPress={() => ev.id && router.push(`/(app)/events/${ev.id}` as never)}
                      language={language}
                    />
                  </FadeIn>
                ))}
              </Section>
            ) : null}

            {/* ── Community highlights ── */}
            <Section
              kicker={t ? 'DEL CLUB' : 'FROM THE CLUB'}
              ctaLabel={t ? 'Ver más' : 'See more'}
              onCtaPress={() => router.push('/(tabs)/community' as never)}
              delay={400}
            >
              <Pressy
                onPress={() => router.push('/(tabs)/community' as never)}
                haptic="select"
                accessibilityRole={Roles.button}
                accessibilityLabel={t ? 'Ir a comunidad' : 'Go to community'}
                style={styles.communityCard}
              >
                <View style={{ flex: 1 }}>
                  <Subhead>{t ? 'Nuevos miembros esta semana' : 'New members this week'}</Subhead>
                  <Caption tone="muted" style={{ marginTop: 2 }}>
                    {t
                      ? 'Conoce a quienes se unieron al club'
                      : 'Meet who joined the club'}
                  </Caption>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.textMuted} />
              </Pressy>
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section ──────────────────────────────────
function Section({
  kicker,
  ctaLabel,
  onCtaPress,
  delay,
  children,
}: {
  kicker: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <FadeIn delay={delay}>
        <View style={styles.sectionHeader}>
          <Kicker tone="muted">{kicker}</Kicker>
          {ctaLabel && onCtaPress ? (
            <Pressy
              onPress={onCtaPress}
              haptic="select"
              accessibilityRole={Roles.link}
              accessibilityLabel={ctaLabel}
              hitSlop={HitSlop.expand}
            >
              <Caption tone="accent">{ctaLabel}</Caption>
            </Pressy>
          ) : null}
        </View>
        <Hairline variant="subtle" style={{ marginTop: Spacing[2], marginBottom: Spacing[3] }} />
      </FadeIn>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ── Tonight hero (experiential) ──────────────
function TonightHero({
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
  const time = formatTime(event.startDate, language);
  const cat = event.category?.name;

  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={`${title} ${time}`}
      style={styles.tonightCard}
    >
      <View style={styles.tonightImageWrap}>
        {event.imageUrl ? (
          <Image
            source={{ uri: toAbsoluteImageUrl(event.imageUrl) }}
            style={styles.tonightImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.tonightImage, { backgroundColor: Colors.bgElevated }]} />
        )}
      </View>
      <View style={styles.tonightText}>
        <Kicker tone="champagne">
          {[time, cat].filter(Boolean).join(' · ').toUpperCase()}
        </Kicker>
        <Subhead style={{ marginTop: Spacing[1] }} numberOfLines={2}>
          {title}
        </Subhead>
        {event.spotsLeft != null ? (
          <Caption tone="muted" style={{ marginTop: 2 }}>
            {t ? `${event.spotsLeft} plazas disponibles` : `${event.spotsLeft} spots available`}
          </Caption>
        ) : null}
      </View>
    </Pressy>
  );
}

// ── Privilege row (cortesía) ─────────────────
function PrivilegeRow({
  offer,
  tierAccent,
  onPress,
}: {
  offer: OfferItem;
  tierAccent: string;
  onPress: () => void;
}) {
  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={offer.title}
      style={styles.privilegeRow}
    >
      <View style={[styles.privilegeDot, { backgroundColor: tierAccent }]} />
      <View style={{ flex: 1 }}>
        <Subhead numberOfLines={1}>{offer.title}</Subhead>
        {offer.validWhen || offer.description ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {offer.validWhen || offer.description}
          </Caption>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
    </Pressy>
  );
}

// ── Experience row (compact event) ───────────
function ExperienceRow({
  event,
  onPress,
  language,
}: {
  event: EventItem;
  onPress: () => void;
  language: string;
}) {
  const title = event.title || event.name || '—';
  const date = formatShortDate(event.startDate, language);
  const time = formatTime(event.startDate, language);
  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={`${title} ${date} ${time}`}
      style={styles.experienceRow}
    >
      <View style={styles.experienceDateCol}>
        <Kicker tone="champagne">{date.split(' ')[0]?.toUpperCase()}</Kicker>
        <Subhead style={{ marginTop: 2 }}>{date.split(' ')[1] ?? ''}</Subhead>
      </View>
      <View style={{ flex: 1 }}>
        <Subhead numberOfLines={1}>{title}</Subhead>
        {time ? (
          <Caption tone="muted" style={{ marginTop: 2 }}>
            {time}
            {event.category?.name ? ` · ${event.category.name}` : ''}
          </Caption>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
    </Pressy>
  );
}

// ── Styles ───────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: Spacing[10] },

  greetingWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },

  heroWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
  },

  section: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[8],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionBody: {
    gap: Spacing[2],
  },

  tonightCard: {
    overflow: 'hidden',
    borderRadius: Radius.md,
  },
  tonightImageWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: Colors.bgElevated,
  },
  tonightImage: {
    width: '100%',
    height: '100%',
  },
  tonightText: {
    paddingTop: Spacing[3],
  },

  privilegeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  privilegeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
  },
  experienceDateCol: {
    width: 44,
    alignItems: 'flex-start',
  },

  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
