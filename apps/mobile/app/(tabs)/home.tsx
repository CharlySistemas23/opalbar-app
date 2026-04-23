import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, ImageBackground, Image, RefreshControl } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { eventsApi, offersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { Pressy, FadeIn } from '@/components/ui';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface EventItem {
  id: string;
  name?: string;
  title?: string;
  startDate?: string;
  imageUrl?: string;
  category?: string;
  spotsLeft?: number;
  isLive?: boolean;
  badge?: string;
  badgeColor?: string;
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
  badge?: string;
  badgeColor?: string;
  icon?: FeatherIcon;
}

function toAbsoluteImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:image/')) return url;

  const api = process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1';
  const base = api.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function Home() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [events, setEvents] = useState<EventItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [er, or] = await Promise.all([
        eventsApi.list({ limit: 3 }).catch(() => null),
        offersApi.list({ limit: 3 }).catch(() => null),
      ]);
      setEvents(er?.data?.data?.data ?? []);
      setOffers(or?.data?.data?.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hero = events[0];
  const upcomingCandidates = hero ? events.filter((e) => e.id !== hero.id) : events;
  const evRow = [
    ...upcomingCandidates.filter((e) => !!e.imageUrl),
    ...upcomingCandidates.filter((e) => !e.imageUrl),
  ].slice(0, 2);
  const featured = offers[0];

  // Fallbacks — match Pencil mock data
  const heroTitle = hero?.title || hero?.name || (t ? 'Noche de Jazz & Cocktails' : 'Jazz & Cocktails Night');
  const heroDate = hero?.startDate
    ? new Date(hero.startDate).toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : (t ? 'Vie 18 Abr • 21:00' : 'Fri Apr 18 • 21:00');
  const heroSpots = hero?.spotsLeft ?? 12;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <View style={styles.logoDot} />
            <Text style={styles.brand}>OPALBAR</Text>
          </View>
          <TouchableOpacity
            style={styles.bellBox}
            onPress={() => router.push('/(app)/profile/notifications')}
            hitSlop={8}
          >
            <Feather name="bell" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Hero Card — solo si hay evento real */}
        {hero ? (
          <TouchableOpacity
            style={styles.heroCard}
            activeOpacity={0.9}
            onPress={() => router.push(`/(app)/events/${hero.id}`)}
          >
            {hero.imageUrl ? (
              <ImageBackground
                source={{ uri: toAbsoluteImageUrl(hero.imageUrl) }}
                style={styles.heroBg}
                imageStyle={{ borderRadius: 20 }}
              >
                <HeroOverlay title={heroTitle} date={heroDate} spots={heroSpots} t={t} category={hero?.category} />
              </ImageBackground>
            ) : (
              <View style={styles.heroBgPlaceholder}>
                <HeroOverlay title={heroTitle} date={heroDate} spots={heroSpots} t={t} category={hero?.category} />
              </View>
            )}
          </TouchableOpacity>
        ) : !loading ? (
          <View style={[styles.heroBgPlaceholder, { marginHorizontal: 20, borderRadius: 20, height: 200, alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="calendar" size={32} color={Colors.textMuted} />
            <Text style={[styles.emptySmall, { marginTop: 8 }]}>
              {t ? 'Sin eventos por ahora.' : 'No events yet.'}
            </Text>
          </View>
        ) : null}

        {loading && (
          <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 24 }} />
        )}

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t ? 'Próximos Eventos' : 'Upcoming Events'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/events')}>
              <Text style={styles.seeAll}>{t ? 'Ver todos' : 'See all'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.evRow}>
            {evRow.length === 0 && !loading ? (
              <Text style={styles.emptySmall}>
                {t ? 'Sin eventos próximos.' : 'No upcoming events.'}
              </Text>
            ) : null}
            {evRow.map((ev, idx) => {
              const cat = (ev as any).category;
              const catName = cat?.name ?? ev.badge;
              const catColor = cat?.color ?? ev.badgeColor ?? Colors.accentPrimary;
              return (
              <FadeIn key={ev.id || idx} delay={idx * 60} fromX={20} from={0}>
              <Pressy
                style={styles.evCard}
                onPress={() => ev.id && router.push(`/(app)/events/${ev.id}`)}
              >
                {ev.imageUrl ? (
                  <ImageBackground
                    source={{ uri: toAbsoluteImageUrl(ev.imageUrl) }}
                    style={styles.evImg}
                    imageStyle={{ borderRadius: 10 }}
                  />
                ) : (
                  <View style={styles.evImg} />
                )}
                {catName ? (
                  <View style={[styles.evBadge, { backgroundColor: catColor + '20' }]}>
                    <Text style={[styles.evBadgeText, { color: catColor }]}>
                      {String(catName).toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.evTitle} numberOfLines={1}>
                  {ev.title || ev.name || '—'}
                </Text>
                <View style={styles.metaRow}>
                  <Feather name="calendar" size={11} color={Colors.textMuted} />
                  <Text style={styles.evMeta}>
                    {ev.startDate
                      ? new Date(ev.startDate).toLocaleDateString(language, {
                          weekday: 'short', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : t ? 'Sáb 19 Abr • 23:00' : 'Sat Apr 19 • 23:00'}
                  </Text>
                </View>
              </Pressy>
              </FadeIn>
              );
            })}
          </View>
        </View>

        {/* Current Offers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t ? 'Ofertas Vigentes' : 'Current Offers'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(app)/offers' as never)}>
              <Text style={styles.seeAll}>{t ? 'Ver todas' : 'See all'}</Text>
            </TouchableOpacity>
          </View>

          {!featured && !loading ? (
            <Text style={styles.emptySmall}>
              {t ? 'Sin ofertas vigentes.' : 'No current offers.'}
            </Text>
          ) : featured ? (
          <OfferCard
            offer={featured}
            onPress={() => featured && router.push(`/(app)/offers/${featured.id}`)}
            t={t}
          />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Hero overlay ───────────────────────────────────────────
function HeroOverlay({
  title, date, spots, t, category,
}: { title: string; date: string; spots: number; t: boolean; category?: { name?: string; color?: string } }) {
  return (
    <View style={styles.heroOverlay}>
      <View style={styles.badgeRow}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>{t ? 'HOY' : 'TODAY'}</Text>
        </View>
        {category?.name ? (
          <View style={[styles.catBadge, category.color && { backgroundColor: category.color + 'CC' }]}>
            <Text style={styles.catBadgeText}>{String(category.name).toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
      <View style={styles.heroMetaRow}>
        <View style={styles.heroMetaItem}>
          <Feather name="calendar" size={12} color={Colors.textPrimary} />
          <Text style={styles.heroMetaText}>{date}</Text>
        </View>
        <View style={styles.heroMetaItem}>
          <Feather name="users" size={12} color={Colors.accentPrimary} />
          <Text style={[styles.heroMetaText, { color: Colors.accentPrimary }]}>
            {t ? `${spots} plazas libres` : `${spots} spots left`}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Offer card ─────────────────────────────────────────────
function OfferCard({
  offer, onPress, t,
}: { offer: OfferItem; onPress: () => void; t: boolean }) {
  const usesLeft = offer.usesLeft ?? (
    offer.maxRedemptions != null
      ? Math.max(0, offer.maxRedemptions - (offer.currentRedemptions ?? 0))
      : null
  );
  return (
    <Pressy style={styles.ofCard} onPress={onPress}>
      <View style={styles.ofImgBox}>
        {offer.imageUrl ? (
          <Image source={{ uri: offer.imageUrl }} style={styles.ofImgPreview} resizeMode="cover" />
        ) : (
          <Feather name={offer.icon || 'tag'} size={28} color={Colors.accentPrimary} />
        )}
      </View>
      <View style={styles.ofInfo}>
        <View style={styles.ofTopRow}>
          <Text style={styles.ofTitle} numberOfLines={2}>
            {offer.title}
          </Text>
          {offer.badge && (
            <View style={[styles.ofBadge, { backgroundColor: (offer.badgeColor || Colors.accentDanger) + '20' }]}>
              <Text style={[styles.ofBadgeText, { color: offer.badgeColor || Colors.accentDanger }]}>
                {offer.badge}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.ofValid} numberOfLines={2}>
          {offer.validWhen || offer.description || ''}
        </Text>
        <View style={styles.ofFooter}>
          <Text style={styles.ofLeft}>
            {usesLeft != null
              ? (t ? `Quedan ${usesLeft} usos` : `${usesLeft} uses left`)
              : ''}
          </Text>
          <View style={styles.ofBtn}>
            <Text style={styles.ofBtnLabel}>{t ? 'Canjear' : 'Redeem'}</Text>
          </View>
        </View>
      </View>
    </Pressy>
  );
}

// ─── Sample data (Pencil mock) ──────────────────────────────
function sampleEvents(t: boolean): EventItem[] {
  return [
    {
      id: 's1',
      title: 'Bass Night Vol.4',
      startDate: '',
      badge: t ? 'ELECTRÓNICA' : 'ELECTRONIC',
      badgeColor: Colors.accentPrimary,
    },
    {
      id: 's2',
      title: t ? 'Copa de Bienvenida' : 'Welcome Drink',
      startDate: '',
      badge: t ? 'ESPECIAL' : 'SPECIAL',
      badgeColor: Colors.accentSuccess,
    },
  ];
}

function sampleOffer(t: boolean): OfferItem {
  return {
    id: 's-offer',
    title: t ? '2×1 en Cocteles Premium' : '2×1 Premium Cocktails',
    validWhen: t ? 'Válido vie-sáb • Hasta las 23:00' : 'Valid Fri-Sat • Until 23:00',
    usesLeft: 8,
    badge: t ? 'LIMITADO' : 'LIMITED',
    badgeColor: Colors.accentDanger,
    icon: 'tag',
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentPrimary,
  },
  brand: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  bellBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Hero
  heroCard: {
    marginHorizontal: 20,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroBg: { flex: 1 },
  heroBgPlaceholder: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: 20,
  },
  heroOverlay: {
    flex: 1,
    padding: 18,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    gap: 10,
  },
  badgeRow: { flexDirection: 'row', gap: 8 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accentDanger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  catBadge: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  catBadgeText: { color: Colors.textPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  heroMetaRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { color: Colors.textPrimary, fontSize: 12 },

  // Section
  section: {
    paddingHorizontal: 20,
    marginTop: 22,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  seeAll: { color: Colors.accentPrimary, fontSize: 13 },

  // Events row
  evRow: { flexDirection: 'row', gap: 12 },
  emptySmall: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20, width: '100%' },
  evCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: 12,
    gap: 6,
  },
  evImg: {
    height: 88,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
  },
  evBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  evBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  evTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  evMeta: { color: Colors.textSecondary, fontSize: 11 },

  // Offer card
  ofCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: 14,
  },
  ofImgBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ofImgPreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  ofInfo: { flex: 1, gap: 4 },
  ofTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  ofTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  ofBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  ofBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  ofValid: { color: Colors.textSecondary, fontSize: 12 },
  ofFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  ofLeft: { color: Colors.accentSuccess, fontSize: 12, fontWeight: '600' },
  ofBtn: {
    backgroundColor: Colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.button,
  },
  ofBtnLabel: { color: Colors.textInverse, fontSize: 12, fontWeight: '700' },
});
