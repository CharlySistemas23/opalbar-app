// ─────────────────────────────────────────────
//  Wallet — OPALBAR · Premium Members Balance
//
//  Brief (2026-05-18):
//   · Balance hero gigante Fraunces (no fintech feel)
//   · Progress to next tier — barra elegante, tier-colored
//   · Timeline (NO tabla) — formato "+200 / Reservation / May 18"
//
//  Tier color propagates to progress bar and +/- accents.
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
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  FadeIn,
  Hairline,
  Kicker,
  Pressy,
  SkeletonList,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { resolveTier } from '@/constants/tiers';
import { Text } from 'react-native';

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
  const tierName = wallet?.currentLevel?.name || user?.profile?.loyaltyLevel?.name;
  const tier = resolveTier(tierName);
  const nextLevel = wallet?.nextLevel;
  const delta = nextLevel ? Math.max(0, (nextLevel.minPoints ?? 0) - points) : 0;
  const progress = nextLevel ? Math.min(1, points / (nextLevel.minPoints || 1)) : 1;

  // Group transactions by month for timeline-style display
  const grouped = groupByMonth(txs, language);

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
          <SkeletonList count={1} itemHeight={180} />
          <SkeletonList count={4} itemHeight={56} />
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
          data={grouped}
          keyExtractor={(g) => g.month}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing[12] }}
          ListHeaderComponent={
            <View>
              {/* ── Hero balance ── */}
              <FadeIn style={styles.hero}>
                <Kicker tone="muted">{t ? 'BALANCE DISPONIBLE' : 'AVAILABLE BALANCE'}</Kicker>
                <Text
                  style={[
                    TypePresets.hero,
                    { color: tier.text, marginTop: Spacing[3] },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {points.toLocaleString(language)}
                </Text>
                <Caption style={{ color: tier.base, marginTop: Spacing[2], letterSpacing: 1.4 }}>
                  {(tier.labelEn ?? '').toUpperCase()} {t ? 'PTS' : 'PTS'}
                </Caption>

                {nextLevel ? (
                  <View style={styles.progressBlock}>
                    <View style={styles.progressRow}>
                      <Caption tone="muted">
                        {t ? `${delta} pts para ${nextLevel.name}` : `${delta} pts to ${nextLevel.name}`}
                      </Caption>
                      <Caption tone="muted">{Math.round(progress * 100)}%</Caption>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${progress * 100}%`, backgroundColor: tier.base },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}
              </FadeIn>

              {/* ── Actions ── */}
              <FadeIn delay={100} style={styles.actions}>
                <ActionTile
                  icon="gift"
                  label={t ? 'Canjear' : 'Redeem'}
                  onPress={() => router.push('/(app)/offers' as never)}
                />
                <ActionTile
                  icon="award"
                  label={t ? 'Niveles' : 'Tiers'}
                  onPress={() => router.push('/(app)/profile/loyalty-levels' as never)}
                />
              </FadeIn>

              {/* ── Timeline header ── */}
              <FadeIn delay={160} style={styles.historyHeader}>
                <Kicker tone="muted">{t ? 'MOVIMIENTOS' : 'ACTIVITY'}</Kicker>
                <Hairline variant="subtle" style={{ marginTop: Spacing[2] }} />
              </FadeIn>
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeIn delay={50 * Math.min(index, 4)}>
              <MonthGroup group={item} tierAccent={tier.base} lang={language} t={t} />
            </FadeIn>
          )}
          ListEmptyComponent={
            <View style={{ minHeight: 240 }}>
              <EmptyState
                icon="clock"
                title={t ? 'Sin movimientos aún' : 'No activity yet'}
                message={
                  t
                    ? 'Tus puntos ganados y canjeados aparecerán aquí.'
                    : 'Earned and spent points will appear here.'
                }
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Action tile ──────────────────────────────
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

// ── Month group (timeline) ───────────────────
function MonthGroup({
  group,
  tierAccent,
  lang,
  t,
}: {
  group: MonthGrouped;
  tierAccent: string;
  lang: string;
  t: boolean;
}) {
  return (
    <View style={styles.monthGroup}>
      <Text
        style={[
          TypePresets.label,
          { color: Colors.textMuted, paddingHorizontal: EditorialSpacing.pageGutter },
        ]}
      >
        {group.month.toUpperCase()}
      </Text>
      <View style={{ marginTop: Spacing[2] }}>
        {group.txs.map((tx) => (
          <TxRow key={tx.id} tx={tx} tierAccent={tierAccent} lang={lang} t={t} />
        ))}
      </View>
    </View>
  );
}

// ── Tx row (timeline item) ───────────────────
function TxRow({
  tx,
  tierAccent,
  lang,
  t,
}: {
  tx: Tx;
  tierAccent: string;
  lang: string;
  t: boolean;
}) {
  const amount = tx.amount ?? tx.points ?? 0;
  const isPositive = amount > 0;
  const dateStr = tx.createdAt
    ? new Date(tx.createdAt).toLocaleDateString(lang, { day: 'numeric', month: 'short' })
    : '';
  const amountColor = isPositive ? tierAccent : Colors.accentDanger;
  const sign = isPositive ? '+' : '';

  return (
    <View style={styles.txRow}>
      <View style={styles.txDot} />
      <View style={{ flex: 1 }}>
        <Body size="sm" weight="medium" numberOfLines={1}>
          {tx.description || tx.reason || (t ? 'Movimiento' : 'Activity')}
        </Body>
        <Caption tone="muted" style={{ marginTop: 1 }}>
          {dateStr}
        </Caption>
      </View>
      <Text
        style={[
          TypePresets.headingSm,
          { color: amountColor, fontVariant: ['tabular-nums'] },
        ]}
      >
        {sign}
        {amount}
      </Text>
    </View>
  );
}

// ── Helpers ──────────────────────────────────
interface MonthGrouped {
  month: string;
  txs: Tx[];
}

function groupByMonth(txs: Tx[], lang: string): MonthGrouped[] {
  const map = new Map<string, Tx[]>();
  for (const tx of txs) {
    if (!tx.createdAt) continue;
    const d = new Date(tx.createdAt);
    const key = d.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
    const arr = map.get(key) ?? [];
    arr.push(tx);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([month, txs]) => ({ month, txs }));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[2],
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
  progressBlock: {
    marginTop: Spacing[6],
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing[2],
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing[3],
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[2],
  },
  actionTile: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    backgroundColor: Colors.bgCard,
  },
  historyHeader: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[8],
    marginBottom: Spacing[2],
  },
  monthGroup: {
    marginTop: Spacing[4],
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[3],
  },
  txDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
});
