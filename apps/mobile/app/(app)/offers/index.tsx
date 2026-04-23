import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { Pressy, FadeIn } from '@/components/ui';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { offersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Ofertas' : 'Offers'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
      >
        <View style={styles.ptsCard}>
          <View style={styles.ptsStarBox}>
            <Feather name="star" size={22} color={Colors.textInverse} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ptsLabel}>{t ? 'Tus puntos OPAL' : 'Your OPAL points'}</Text>
            <Text style={styles.ptsValue}>{points.toLocaleString(language)} pts</Text>
            <Text style={styles.ptsLevel}>
              {t
                ? `Nivel Ámbar • ${nextLevelDelta} pts para Platino`
                : `Amber Level • ${nextLevelDelta} pts to Platinum`}
            </Text>
          </View>
        </View>

        {loading && <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 24 }} />}

        <View style={styles.list}>
          {!loading && error && items.length === 0 ? (
            <ErrorState
              title={t ? 'No se pudieron cargar' : 'Could not load'}
              message={error}
              retryLabel={t ? 'Reintentar' : 'Retry'}
              onRetry={() => { setLoading(true); load(); }}
            />
          ) : !loading && items.length === 0 ? (
            <EmptyState
              icon="tag"
              title={t ? 'Sin ofertas por ahora' : 'No offers yet'}
              message={t ? 'Revisa más tarde. Las nuevas ofertas aparecerán aquí.' : 'Check back later for new offers.'}
            />
          ) : items.map((offer, idx) => (
            <FadeIn key={offer.id} delay={idx * 70} from={24}>
              <OfferCard
                offer={offer}
                t={t}
                onPress={() => router.push(`/(app)/offers/${offer.id}`)}
              />
            </FadeIn>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OfferCard({
  offer, t, onPress,
}: { offer: OfferItem; t: boolean; onPress: () => void }) {
  const usesLeft = offer.usesLeft ?? (
    offer.maxRedemptions != null
      ? Math.max(0, offer.maxRedemptions - (offer.currentRedemptions ?? 0))
      : null
  );
  return (
    <Pressy style={styles.card} onPress={onPress}>
      <View style={styles.cardIconBox}>
        {offer.imageUrl ? (
          <Image source={{ uri: offer.imageUrl }} style={styles.cardImgPreview} resizeMode="cover" />
        ) : (
          <Feather
            name={offer.icon || 'tag'}
            size={32}
            color={offer.iconColor || Colors.accentPrimary}
          />
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>{offer.title}</Text>
          {offer.badge && (
            <View style={[styles.badgePill, { backgroundColor: (offer.badgeColor || Colors.accentDanger) + '20' }]}>
              <Text style={[styles.badgePillText, { color: offer.badgeColor || Colors.accentDanger }]}>
                {offer.badge}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.cardValid} numberOfLines={2}>{offer.validWhen || offer.description || ''}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardLeft}>
            {usesLeft != null
              ? (t ? `${usesLeft} quedan` : `${usesLeft} left`)
              : ''}
          </Text>
          <View style={styles.redeemBtn}>
            <Text style={styles.redeemBtnLabel}>{t ? 'Canjear' : 'Redeem'}</Text>
          </View>
        </View>
      </View>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },

  ptsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(244, 163, 64, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 163, 64, 0.25)',
  },
  ptsStarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  ptsLabel: { color: Colors.textSecondary, fontSize: 12 },
  ptsValue: { color: Colors.accentPrimary, fontSize: 22, fontWeight: '800', marginTop: 2 },
  ptsLevel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: 16,
  },
  cardIconBox: {
    width: 72, height: 72, borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  cardImgPreview: {
    width: 72, height: 72, borderRadius: 12,
  },
  cardInfo: { flex: 1, gap: 6 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgePillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardValid: { color: Colors.textSecondary, fontSize: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardLeft: { color: Colors.accentSuccess, fontSize: 12, fontWeight: '600' },
  redeemBtn: {
    backgroundColor: Colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.button,
  },
  redeemBtnLabel: { color: Colors.textInverse, fontSize: 12, fontWeight: '700' },
});
