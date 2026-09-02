// ─────────────────────────────────────────────
//  Offers — Lista · Editorial Premium
//
//  Magazine-style index: kicker + Display title, a points "stat block"
//  rendered with editorial numerics, then the offers as full-bleed
//  hairline cards (no chunky icon boxes). Loading → SkeletonList.
// ─────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
  Hairline,
  Heading,
  Kicker,
  Numeric,
  Pressy,
  SkeletonList,
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { playUiSound } from '@/hooks/useFeedback';
import { offersApi, walletApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface OfferItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  maxRedemptions?: number;
  currentRedemptions?: number;
  daysOfWeek?: number[];
  startTime?: string | null;
  endTime?: string | null;
  usesLeft?: number;
  badge?: string;
  badgeColor?: string;
  icon?: FeatherIcon;
  iconColor?: string;
}

interface LoyaltyLevelLite {
  id: string;
  name: string;
  nameEn?: string | null;
  minPoints: number;
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

const OFFERS_INITIAL_LIMIT = 20;

export default function OffersList() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const { user } = useAuthStore();
  const [items, setItems] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loyalty, setLoyalty] = useState<{
    points: number;
    current: LoyaltyLevelLite | null;
    next: LoyaltyLevelLite | null;
  } | null>(null);

  const points = loyalty?.points ?? user?.points ?? 0;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [offersRes, walletRes, levelsRes] = await Promise.allSettled([
        offersApi.list({ limit: OFFERS_INITIAL_LIMIT }),
        walletApi.wallet(),
        walletApi.levels(),
      ]);

      if (offersRes.status === 'fulfilled') {
        setItems(offersRes.value.data?.data?.data ?? []);
      } else {
        setItems([]);
        setError(apiError(offersRes.reason));
      }

      if (walletRes.status === 'fulfilled') {
        const w = walletRes.value.data?.data;
        const pts = w?.points ?? 0;
        const levelsPayload = levelsRes.status === 'fulfilled' ? levelsRes.value.data?.data : null;
        const allLevels: LoyaltyLevelLite[] = (
          Array.isArray(levelsPayload) ? levelsPayload : levelsPayload?.data ?? []
        )
          .slice()
          .sort((a: LoyaltyLevelLite, b: LoyaltyLevelLite) => (a.minPoints ?? 0) - (b.minPoints ?? 0));

        let current: LoyaltyLevelLite | null = w?.profile?.loyaltyLevel ?? null;
        let next: LoyaltyLevelLite | null = w?.nextLevel ?? null;
        if (allLevels.length > 0) {
          current = null;
          for (const lvl of allLevels) {
            if (pts >= (lvl.minPoints ?? 0)) current = lvl;
          }
          next = allLevels.find((lvl) => (lvl.minPoints ?? 0) > pts) ?? null;
        }
        setLoyalty({ points: pts, current, next });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressy
          onPress={() => router.back()}
          accessibilityLabel={t ? 'Volver' : 'Back'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
      </View>

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
        {/* Hero ─────────────────────────────── */}
        <FadeIn>
          <Kicker tone="champagne">{t ? 'COLECCIÓN ACTUAL' : 'CURRENT COLLECTION'}</Kicker>
        </FadeIn>
        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Display>{t ? 'Ofertas.' : 'Offers.'}</Display>
        </FadeIn>
        <FadeIn delay={160} style={{ marginTop: Spacing[3] }}>
          <Body tone="secondary" size="lg">
            {t
              ? 'Beneficios curados para miembros. Canjea con un toque.'
              : 'Curated benefits for members. Redeem with a tap.'}
          </Body>
        </FadeIn>

        {/* Points stat ─────────────────────── */}
        <FadeIn delay={240} style={styles.statBlock}>
          <View style={styles.statRow}>
            <View style={{ flex: 1 }}>
              <Kicker tone="muted">{t ? 'TUS PUNTOS OPAL' : 'YOUR OPAL POINTS'}</Kicker>
              <View style={{ marginTop: Spacing[2] }}>
                <Numeric size="md" tone="accent">
                  {points.toLocaleString(language)}
                </Numeric>
              </View>
              <Caption tone="muted" style={{ marginTop: Spacing[1] }}>
                {loyalty?.current
                  ? t
                    ? `Nivel ${loyalty.current.name}${
                        loyalty.next
                          ? ` · ${Math.max(0, (loyalty.next.minPoints ?? 0) - points)} para ${loyalty.next.name}`
                          : ' · Nivel máximo'
                      }`
                    : `${loyalty.current.nameEn || loyalty.current.name} level${
                        loyalty.next
                          ? ` · ${Math.max(0, (loyalty.next.minPoints ?? 0) - points)} to ${loyalty.next.nameEn || loyalty.next.name}`
                          : ' · Top tier'
                      }`
                  : t
                    ? 'Cargando nivel…'
                    : 'Loading tier…'}
              </Caption>
            </View>
          </View>
          <Hairline variant="subtle" style={{ marginTop: Spacing[4] }} />
        </FadeIn>

        {/* List ────────────────────────────── */}
        <View style={styles.list}>
          {loading ? (
            <SkeletonList count={4} itemHeight={120} />
          ) : error && items.length === 0 ? (
            <ErrorState
              title={t ? 'No se pudieron cargar' : 'Could not load'}
              message={error}
              retryLabel={t ? 'Reintentar' : 'Retry'}
              onRetry={() => { setLoading(true); load(); }}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="tag"
              title={t ? 'Sin ofertas por ahora' : 'No offers yet'}
              message={
                t
                  ? 'Vuelve pronto. Las nuevas ediciones aparecerán aquí.'
                  : 'Check back soon. New editions land here.'
              }
            />
          ) : (
            items.map((offer, idx) => (
              <FadeIn key={offer.id} delay={Math.min(idx, 6) * 70}>
                <OfferRow
                  offer={offer}
                  t={t}
                  onPress={() => router.push(`/(app)/offers/${offer.id}`)}
                />
              </FadeIn>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OfferRow({
  offer,
  t,
  onPress,
}: {
  offer: OfferItem;
  t: boolean;
  onPress: () => void;
}) {
  const usesLeft =
    offer.usesLeft ??
    (offer.maxRedemptions != null
      ? Math.max(0, offer.maxRedemptions - (offer.currentRedemptions ?? 0))
      : null);
  const schedule = offerSchedule(offer, t);

  return (
    <Card
      onPress={onPress}
      padding={Spacing[4]}
      accessibilityLabel={offer.title}
      accessibilityHint={t ? 'Abrir oferta' : 'Open offer'}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowMedia}>
          {offer.imageUrl ? (
            <Image
              source={{ uri: offer.imageUrl }}
              style={styles.rowImg}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.rowMediaFallback}>
              <Feather
                name={offer.icon || 'tag'}
                size={26}
                color={offer.iconColor || Colors.accentChampagne}
              />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          {offer.badge ? (
            <View style={{ marginBottom: Spacing[2], alignSelf: 'flex-start' }}>
              <Badge label={offer.badge} variant="accent" size="sm" />
            </View>
          ) : null}
          <Subhead numberOfLines={2}>{offer.title}</Subhead>
          {schedule ? (
            <Caption tone="muted" style={{ marginTop: Spacing[1] }} numberOfLines={2}>
              {schedule}
            </Caption>
          ) : null}
          <View style={styles.rowFooter}>
            {usesLeft != null ? (
              <Caption tone="success">
                {t ? `${usesLeft} disponibles` : `${usesLeft} left`}
              </Caption>
            ) : (
              <View />
            )}
            <View style={styles.cta}>
              <Body size="sm" tone="inverse" weight="semiBold">
                {t ? 'Canjear' : 'Redeem'}
              </Body>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[10],
    paddingTop: Spacing[6],
  },
  headerRow: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },

  statBlock: {
    marginTop: Spacing[8],
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  list: {
    marginTop: Spacing[8],
    gap: Spacing[3],
  },

  rowBody: {
    flexDirection: 'row',
    gap: Spacing[4],
  },
  rowMedia: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
  },
  rowImg: { width: '100%', height: '100%' },
  rowMediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowFooter: {
    marginTop: Spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cta: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.button,
    backgroundColor: Colors.accentPrimary,
  },
});

// Heading is exported but not used directly (kept for future).
void Heading;
