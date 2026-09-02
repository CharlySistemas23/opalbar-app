// ─────────────────────────────────────────────
//  Home — Full rebuild matching Figma node 12:23 (2026-06-08)
//
//  Estructura exacta:
//   1. Greeting row 24/12 padding — Kicker "OPALBAR" + Body Small
//      "Buenas noches, Carlos" + 40×40 bell
//   2. Card wrap 24/8 padding → MembershipCard 200pt hero (gold)
//   3. Sección "ESTA NOCHE EN OPALBAR" pt:32 px:24 gap:12
//        kicker + hairline + TonightCard (image 180pt + text 12/4 gap)
//   4. Sección "TUS PRIVILEGIOS" pt:24 px:24 gap:12
//        kicker + hairline + 2 PrivilegeRows
//   5. Spacer 80pt + tab bar
//
//  Colors: bgPrimary #100e0c, bgCard #171411, bgElevated #1f1b17,
//          textPrimary #f6f1e7, textMuted #827c71, textSecondary #b8b1a2,
//          accent gold #c9a961.
// ─────────────────────────────────────────────
import { useCallback, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { playUiSound } from '@/hooks/useFeedback';
import { eventsApi, offersApi, toAbsoluteImageUrl } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { FadeIn, Pressy, Skeleton } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { MembershipCard } from '@/components/membership';

interface EventItem {
  id: string;
  name?: string;
  title?: string;
  startDate?: string;
  imageUrl?: string;
  category?: { name?: string; color?: string };
  maxCapacity?: number | null;
  currentCapacity?: number;
}

interface OfferItem {
  id: string;
  title: string;
  description?: string;
  daysOfWeek?: number[];
  startTime?: string | null;
  endTime?: string | null;
}

/** Real schedule ("Vie, Sáb · 20:00–02:00") — falls back to the description. */
function offerSchedule(offer: OfferItem, t: boolean): string | undefined {
  const DAY_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const labels = t ? DAY_ES : DAY_EN;
  const days = offer.daysOfWeek;
  let dayStr: string | undefined;
  if (days && days.length > 0 && days.length < 7) {
    dayStr = [...days].sort((a, b) => a - b).map((d) => labels[d]).join(', ');
  } else if (days && days.length === 7) {
    dayStr = t ? 'Todos los días' : 'Every day';
  }
  const timeStr = offer.startTime && offer.endTime
    ? `${offer.startTime}–${offer.endTime}`
    : offer.startTime || offer.endTime || undefined;
  if (dayStr && timeStr) return `${dayStr} · ${timeStr}`;
  return dayStr || timeStr || offer.description;
}

function formatTime(d: string | undefined, language: string): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
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
        // "Esta noche" must never lead with a past event.
        eventsApi.list({ limit: 5, startDate: new Date().toISOString() }).catch(() => null),
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const firstName = user?.profile?.firstName ?? '';
  const lastName = user?.profile?.lastName ?? '';
  const fullName =
    `${firstName} ${lastName}`.trim() || (user?.email?.split('@')[0] ?? 'Miembro');
  const tierName = user?.profile?.loyaltyLevel?.name;
  const points = user?.points ?? 0;
  const memberNumber = user?.id ? user.id.slice(-4) : undefined;
  const validThrough = formatValidThrough(user?.createdAt);

  const hero = events[0];
  const heroSpotsLeft = hero?.maxCapacity != null ? Math.max(0, hero.maxCapacity - (hero.currentCapacity ?? 0)) : null;
  const privileges = offers.slice(0, 2);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { playUiSound('swoosh'); setRefreshing(true); load(); }}
            tintColor={Colors.accentPrimary}
          />
        }
      >
        {/* ── 1. Greeting ── */}
        <View style={styles.greeting}>
          <View style={styles.greetText}>
            <Text style={[TypePresets.kicker, { color: Colors.textMuted }]}>OPALBAR</Text>
            <Text style={[TypePresets.bodySm, { color: Colors.textSecondary }]}>
              {getGreeting(t)}, {firstName || 'Miembro'}
            </Text>
          </View>
          <Pressy
            onPress={() => router.push('/(app)/profile/notifications' as never)}
            haptic="select"
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Notificaciones' : 'Notifications'}
            hitSlop={HitSlop.expand}
            style={styles.bell}
          >
            <Feather name="bell" size={20} color={Colors.textPrimary} />
          </Pressy>
        </View>

        {/* ── 2. MembershipCard hero ── */}
        <FadeIn style={styles.cardWrap}>
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
              message={t ? 'No pudimos cargar la información del club.' : "We couldn't load the club's information."}
              onRetry={load}
            />
          </View>
        ) : (
          <>
            {/* ── 3. ESTA NOCHE EN OPALBAR ── */}
            <View style={[styles.section, { paddingTop: 8 }]}>
              <FadeIn delay={140}>
                <Text style={[TypePresets.kicker, { color: Colors.textMuted }]}>
                  {t ? 'ESTA NOCHE EN OPALBAR' : 'TONIGHT AT OPALBAR'}
                </Text>
                <View style={styles.hairline} />
              </FadeIn>

              {loading && !hero ? (
                <Skeleton height={240} radius={Radius.md} />
              ) : !hero ? (
                <View style={{ minHeight: 180 }}>
                  <EmptyState
                    icon="moon"
                    title={t ? 'Sin programa esta noche' : 'No program tonight'}
                    message={t ? 'El club siempre tiene algo para ti.' : 'The club always has something coming up.'}
                  />
                </View>
              ) : (
                <Pressy
                  onPress={() => hero.id && router.push(`/(app)/events/${hero.id}` as never)}
                  haptic="select"
                  accessibilityRole={Roles.button}
                  accessibilityLabel={hero.title || hero.name || ''}
                  style={styles.tonightCard}
                >
                  <View style={styles.tonightImage}>
                    {hero.imageUrl ? (
                      <Image
                        source={{ uri: toAbsoluteImageUrl(hero.imageUrl) }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <Feather name="image" size={22} color={Colors.textMuted} />
                    )}
                  </View>
                  <View style={styles.tonightText}>
                    <Text style={[TypePresets.kicker, { color: Colors.accentPrimary }]}>
                      {[formatTime(hero.startDate, language), hero.category?.name].filter(Boolean).join(' · ').toUpperCase()}
                    </Text>
                    <Text style={[TypePresets.subhead, { color: Colors.textPrimary }]} numberOfLines={2}>
                      {hero.title || hero.name || (t ? 'Sin título' : 'Untitled')}
                    </Text>
                    {heroSpotsLeft != null ? (
                      <Text style={[TypePresets.caption, { color: Colors.textMuted }]}>
                        {t ? `${heroSpotsLeft} plazas disponibles` : `${heroSpotsLeft} spots available`}
                      </Text>
                    ) : null}
                  </View>
                </Pressy>
              )}
            </View>

            {/* ── 4. TUS PRIVILEGIOS ── */}
            <View style={[styles.section, { paddingTop: 8 }]}>
              <FadeIn delay={220}>
                <Text style={[TypePresets.kicker, { color: Colors.textMuted }]}>
                  {t ? 'TUS PRIVILEGIOS' : 'YOUR PRIVILEGES'}
                </Text>
                <View style={styles.hairline} />
              </FadeIn>

              {loading && privileges.length === 0 ? (
                <>
                  <Skeleton height={56} radius={Radius.md} />
                  <Skeleton height={56} radius={Radius.md} />
                </>
              ) : privileges.length === 0 ? (
                <Text style={[TypePresets.body, { color: Colors.textMuted, paddingVertical: Spacing[3] }]}>
                  {t ? 'Pronto habrá nuevas cortesías para ti.' : 'New privileges coming soon.'}
                </Text>
              ) : (
                privileges.map((off, idx) => {
                  const schedule = offerSchedule(off, t);
                  return (
                    <FadeIn key={off.id ?? idx} delay={60 * idx}>
                      <Pressy
                        onPress={() => off.id && router.push(`/(app)/offers/${off.id}` as never)}
                        haptic="select"
                        accessibilityRole={Roles.button}
                        accessibilityLabel={off.title}
                        style={styles.privilegeRow}
                      >
                        <View style={styles.privilegeDot} />
                        <View style={styles.privilegeText}>
                          <Text style={[TypePresets.subhead, { color: Colors.textPrimary }]} numberOfLines={1}>
                            {off.title}
                          </Text>
                          {schedule ? (
                            <Text style={[TypePresets.caption, { color: Colors.textMuted }]} numberOfLines={1}>
                              {schedule}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[TypePresets.body, { color: Colors.textMuted }]}>›</Text>
                      </Pressy>
                    </FadeIn>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* Spacer for tab bar */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: 0 },

  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  greetText: {
    gap: 2,
  },
  bell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardWrap: {
    paddingHorizontal: 24,
    paddingVertical: 4,
  },

  section: {
    paddingHorizontal: 24,
    gap: 8,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(246,241,231,0.06)',
    marginTop: 4,
  },

  // Tonight card
  tonightCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  tonightImage: {
    height: 180,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 4,
  },
  tonightText: {
    paddingTop: 12,
    gap: 4,
  },

  // Privilege row
  privilegeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,241,231,0.06)',
  },
  privilegeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentPrimary,
  },
  privilegeText: {
    flex: 1,
    gap: 2,
  },
});
