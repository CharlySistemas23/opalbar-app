// ─────────────────────────────────────────────
//  Redemptions — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header
//   · <Tabs> (underline) for ACTIVOS / CANJEADOS / EXPIRADOS, each tab
//     label shows the count meta
//   · Bordered editorial cards: thumb + serif sub-heading + venue caption
//     + status caption with tone + code in label caps
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { offersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  FadeIn,
  Heading,
  Kicker,
  Pressy,
  SkeletonList,
  Subhead,
  Tabs,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

type Tab = 'ACTIVE' | 'USED' | 'EXPIRED';

interface Redemption {
  id: string;
  code: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  pointsSpent?: number;
  expiresAt?: string;
  usedAt?: string;
  createdAt: string;
  offer: {
    id: string;
    title: string;
    imageUrl?: string;
    pointsCost?: number;
    venue?: { name?: string };
  };
}

export default function Redemptions() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tab, setTab] = useState<Tab>('ACTIVE');
  const [items, setItems] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await offersApi.myRedemptions();
      setItems(r.data?.data?.data ?? r.data?.data ?? []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === 'EXPIRED') {
      return items.filter((x) => x.status === 'EXPIRED' || x.status === 'CANCELLED');
    }
    return items.filter((x) => x.status === tab);
  }, [items, tab]);

  const counts = useMemo(
    () => ({
      ACTIVE: items.filter((x) => x.status === 'ACTIVE').length,
      USED: items.filter((x) => x.status === 'USED').length,
      EXPIRED: items.filter((x) => x.status === 'EXPIRED' || x.status === 'CANCELLED').length,
    }),
    [items],
  );

  const tabOptions = [
    { value: 'ACTIVE' as const, label: t ? `Activos · ${counts.ACTIVE}` : `Active · ${counts.ACTIVE}` },
    { value: 'USED' as const, label: t ? `Canjeados · ${counts.USED}` : `Used · ${counts.USED}` },
    { value: 'EXPIRED' as const, label: t ? `Expirados · ${counts.EXPIRED}` : `Expired · ${counts.EXPIRED}` },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Atrás' : 'Back'}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <View style={styles.titleBlock}>
        <Kicker tone="muted">{t ? 'CANJES' : 'REDEMPTIONS'}</Kicker>
        <Heading size="md">{t ? 'Historial' : 'History'}</Heading>
      </View>

      <View style={styles.tabsWrap}>
        <Tabs value={tab} onChange={(v) => setTab(v)} options={tabOptions} />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[5] }}>
          <SkeletonList count={4} itemHeight={104} />
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, minHeight: 320 }}>
          <EmptyState
            icon="gift"
            title={
              tab === 'ACTIVE'
                ? t ? 'No tienes canjes activos' : 'No active redemptions'
                : tab === 'USED'
                  ? t ? 'Aún no has canjeado nada' : 'Nothing redeemed yet'
                  : t ? 'Sin canjes expirados' : 'No expired redemptions'
            }
            actionLabel={tab === 'ACTIVE' ? (t ? 'Ver ofertas' : 'See offers') : undefined}
            onAction={tab === 'ACTIVE' ? () => router.push('/(app)/offers' as never) : undefined}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{
            paddingHorizontal: EditorialSpacing.pageGutter,
            paddingTop: Spacing[5],
            paddingBottom: Spacing[12],
            gap: Spacing[3],
          }}
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
          renderItem={({ item, index }) => (
            <FadeIn delay={40 * index}>
              <RedemptionCard
                item={item}
                t={t}
                onPress={() => router.push(`/(app)/offers/${item.offer.id}` as never)}
              />
            </FadeIn>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function RedemptionCard({
  item,
  t,
  onPress,
}: {
  item: Redemption;
  t: boolean;
  onPress: () => void;
}) {
  const statusTone =
    item.status === 'ACTIVE' ? 'success' : item.status === 'USED' ? 'champagne' : 'muted';
  const statusIcon: React.ComponentProps<typeof Feather>['name'] =
    item.status === 'ACTIVE' ? 'clock' : item.status === 'USED' ? 'check-circle' : 'x-circle';
  const statusLabel =
    item.status === 'ACTIVE'
      ? t ? 'Listo para canjear' : 'Ready to redeem'
      : item.status === 'USED'
        ? t ? 'Canjeado' : 'Used'
        : item.status === 'EXPIRED'
          ? t ? 'Expirado' : 'Expired'
          : t ? 'Cancelado' : 'Cancelled';

  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={item.offer.title}
      style={styles.card}
    >
      {item.offer.imageUrl ? (
        <Image source={{ uri: item.offer.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Feather name="tag" size={22} color={Colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Subhead numberOfLines={2}>{item.offer.title}</Subhead>
        {item.offer.venue?.name ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {item.offer.venue.name}
          </Caption>
        ) : null}
        <View style={styles.metaRow}>
          <Feather
            name={statusIcon}
            size={12}
            color={
              item.status === 'ACTIVE'
                ? Colors.accentSuccess
                : item.status === 'USED'
                  ? Colors.accentChampagne
                  : Colors.textMuted
            }
          />
          <Caption tone={statusTone}>{statusLabel}</Caption>
          {item.pointsSpent ? (
            <>
              <Caption tone="muted">·</Caption>
              <Caption tone="muted">{item.pointsSpent} pts</Caption>
            </>
          ) : null}
        </View>
        <Body size="sm" tone="muted" style={{ marginTop: Spacing[2] }}>
          {t ? 'Código ' : 'Code '}
          <Body size="sm" tone="primary" weight="semiBold" style={styles.code}>
            {item.code}
          </Body>
        </Body>
      </View>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  tabsWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  card: {
    flexDirection: 'row',
    gap: Spacing[4],
    padding: Spacing[4],
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    marginTop: Spacing[2],
  },
  code: {
    letterSpacing: 1,
  },
});
