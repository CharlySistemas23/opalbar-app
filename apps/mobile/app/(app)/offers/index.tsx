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
import { offersApi } from '@/api/client';
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
  validWhen?: string;
  usesLeft?: number;
  badge?: string;
  badgeColor?: string;
  icon?: FeatherIcon;
  iconColor?: string;
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

  const points = user?.points ?? 0;

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await offersApi.list({ limit: OFFERS_INITIAL_LIMIT });
      setItems(r.data?.data?.data ?? []);
    } catch (err) {
      setItems([]);
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const nextLevelDelta = Math.max(0, 1500 - points);

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
                {t
                  ? `Nivel Ámbar · ${nextLevelDelta} para Platino`
                  : `Amber level · ${nextLevelDelta} to Platinum`}
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
          {offer.validWhen || offer.description ? (
            <Caption tone="muted" style={{ marginTop: Spacing[1] }} numberOfLines={2}>
              {offer.validWhen || offer.description}
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
