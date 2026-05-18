// ─────────────────────────────────────────────
//  Wallet — Editorial Premium
//
//  Magazine layout:
//   · Hero block: kicker (TUS PUNTOS) + huge serif Numeric balance +
//     level meta + progress hairline rule
//   · Two ghost CTAs as bordered tiles: REDIMIR · NIVELES
//   · Section HISTORIAL — editorial list of transactions with +/- amount
//     in serif Numeric and date as Caption
//   · Loading: SkeletonList. Empty: EmptyState. Error: ErrorState.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { walletApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Numeric,
  Pressy,
  SkeletonList,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

interface Tx {
  id: string;
  description?: string;
  reason?: string;
  amount?: number;
  points?: number;
  createdAt?: string;
}

export default function Wallet() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [wallet, setWallet] = useState<any>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      walletApi.wallet().then((r) => setWallet(r.data?.data)),
      walletApi.transactions({}).then((r) => setTxs(r.data?.data?.data ?? [])),
    ])
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const points = wallet?.points ?? user?.points ?? 0;
  const levelName = wallet?.currentLevel?.name || user?.profile?.loyaltyLevel?.name || (t ? 'Ámbar' : 'Amber');
  const nextLevel = wallet?.nextLevel;
  const delta = nextLevel ? Math.max(0, (nextLevel.minPoints ?? 0) - points) : 0;
  const progress = nextLevel ? Math.min(1, points / (nextLevel.minPoints || 1)) : 1;

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

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, gap: Spacing[6] }}>
          <SkeletonList count={1} itemHeight={200} />
          <SkeletonList count={5} itemHeight={64} />
        </View>
      ) : error && !wallet ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      ) : (
        <FlatList
          data={txs}
          keyExtractor={(tx) => tx.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing[12] }}
          ListHeaderComponent={
            <View>
              {/* ── Hero balance ── */}
              <FadeIn style={styles.hero}>
                <Kicker tone="muted">{t ? 'TUS PUNTOS' : 'YOUR POINTS'}</Kicker>
                <Numeric size="lg" style={{ marginTop: Spacing[3] }}>
                  {points.toLocaleString(language)}
                </Numeric>
                <Caption tone="champagne" style={{ marginTop: Spacing[2] }}>
                  {t ? `NIVEL ${levelName.toUpperCase()}` : `${levelName.toUpperCase()} TIER`}
                  {nextLevel
                    ? t
                      ? ` · ${delta} pts para ${nextLevel.name}`
                      : ` · ${delta} pts to ${nextLevel.name}`
                    : ''}
                </Caption>
                {nextLevel ? (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                ) : null}
              </FadeIn>

              {/* ── Actions ── */}
              <FadeIn delay={120} style={styles.actions}>
                <ActionTile
                  icon="gift"
                  label={t ? 'Canjear' : 'Redeem'}
                  onPress={() => router.push('/(app)/offers' as never)}
                />
                <ActionTile
                  icon="award"
                  label={t ? 'Niveles' : 'Levels'}
                  onPress={() => router.push('/(app)/profile/loyalty-levels' as never)}
                />
              </FadeIn>

              {/* ── History header ── */}
              <FadeIn delay={180} style={styles.historyHeader}>
                <Kicker tone="muted">{t ? 'HISTORIAL' : 'HISTORY'}</Kicker>
                <Heading size="sm" style={{ marginTop: Spacing[1] }}>
                  {t ? 'Movimientos' : 'Activity'}
                </Heading>
                <Hairline variant="subtle" style={{ marginTop: Spacing[4] }} />
              </FadeIn>
            </View>
          }
          renderItem={({ item }) => <TxRow tx={item} lang={language} t={t} />}
          ItemSeparatorComponent={() => (
            <View style={{ paddingHorizontal: EditorialSpacing.pageGutter }}>
              <Hairline variant="subtle" />
            </View>
          )}
          ListEmptyComponent={
            <View style={{ minHeight: 240 }}>
              <EmptyState
                icon="clock"
                title={t ? 'Aún no hay movimientos' : 'No transactions yet'}
                message={
                  t
                    ? 'Tus puntos ganados y canjeados aparecerán aquí.'
                    : 'Your earned and spent points will appear here.'
                }
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={label}
      style={styles.actionTile}
    >
      <Feather name={icon} size={18} color={Colors.textPrimary} />
      <Caption tone="primary" style={{ marginTop: Spacing[2] }}>
        {label}
      </Caption>
    </Pressy>
  );
}

function TxRow({ tx, lang, t }: { tx: Tx; lang: 'es' | 'en'; t: boolean }) {
  const amount = tx.amount ?? tx.points ?? 0;
  const isPositive = amount > 0;
  return (
    <View style={styles.txRow}>
      <View style={{ flex: 1 }}>
        <Body weight="semiBold" numberOfLines={1}>
          {tx.description || tx.reason || (t ? 'Transacción' : 'Transaction')}
        </Body>
        <Caption tone="muted" style={{ marginTop: 2 }}>
          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(lang) : ''}
        </Caption>
      </View>
      <Numeric
        size="sm"
        tone={isPositive ? 'success' : 'danger'}
        style={{ marginLeft: Spacing[3] }}
      >
        {isPositive ? '+' : ''}
        {amount}
      </Numeric>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[6],
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing[5],
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing[3],
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[2],
  },
  actionTile: {
    flex: 1,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[4],
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    backgroundColor: Colors.bgCard,
  },
  historyHeader: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[10],
    marginBottom: Spacing[2],
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
  },
});
