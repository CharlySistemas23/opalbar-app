// ─────────────────────────────────────────────
//  Wallet — Full rebuild matching Figma node 14:2 (2026-06-08)
//
//  Estructura:
//   1. Status bar (SafeArea)
//   2. Header con back (16/12 padding)
//   3. Hero (24 padX, 16 padY, gap 12):
//        Kicker BALANCE DISPONIBLE
//        Text Fraunces 40/42 #f6f1e7 "1,820"
//        Label "GOLD · 1,180 PTS A DIAMOND" en accent
//   4. ProgWrap (24 padX, 12 padY):
//        Row: gold 205pt + muted 137pt (2pt height)
//   5. Actions (24 padX, 12 padY, gap 12):
//        2 tiles bgCard radius 8 padding 16, flex 1 cada
//   6. Timeline header (24 padding):
//        Kicker MOVIMIENTOS + hairline
//   7. Month groups (24 padX, 8 padY, gap 8):
//        Label MAYO/ABRIL @0.6
//        Rows: 4×4 dot + text col + Numeric SM
//   8. Spacer 40pt
// ─────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { walletApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { FadeIn, Pressy, SkeletonList } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { resolveTier } from '@/constants/tiers';

interface Tx {
  id: string;
  description?: string;
  reason?: string;
  amount?: number;
  points?: number;
  createdAt?: string;
}

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const points = wallet?.points ?? user?.points ?? 0;
  const currentLevel = wallet?.profile?.loyaltyLevel ?? user?.profile?.loyaltyLevel;
  const tierName = currentLevel?.name;
  const tier = resolveTier(tierName);
  const nextLevel = wallet?.nextLevel;
  const delta = nextLevel ? Math.max(0, (nextLevel.minPoints ?? 0) - points) : 0;
  // Progress within the CURRENT tier band, not from zero — a member at
  // 1,200/1,000-1,500 should see the bar ~40% full, not ~80%.
  const floor = currentLevel?.minPoints ?? 0;
  const span = nextLevel ? Math.max(1, (nextLevel.minPoints ?? 0) - floor) : 1;
  const progress = nextLevel ? Math.min(1, Math.max(0, (points - floor) / span)) : 1;
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
        <View style={{ width: 40, height: 40 }} />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 24, gap: 24 }}>
          <SkeletonList count={1} itemHeight={140} />
          <SkeletonList count={4} itemHeight={56} />
        </View>
      ) : error && !wallet ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(g) => g.month}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              {/* Hero */}
              <FadeIn style={styles.hero}>
                <Text style={[TypePresets.kicker, { color: Colors.textMuted }]}>
                  {t ? 'BALANCE DISPONIBLE' : 'AVAILABLE BALANCE'}
                </Text>
                <Text style={[styles.heroNumber]} numberOfLines={1} adjustsFontSizeToFit>
                  {points.toLocaleString(language)}
                </Text>
                <Text style={[TypePresets.label, { color: tier.base }]}>
                  {(t ? tier.labelEs : tier.labelEn).toUpperCase()}
                  {nextLevel
                    ? t
                      ? ` · ${delta.toLocaleString(language)} PTS A ${nextLevel.name.toUpperCase()}`
                      : ` · ${delta.toLocaleString(language)} PTS TO ${(nextLevel.nameEn || nextLevel.name).toUpperCase()}`
                    : ''}
                </Text>
              </FadeIn>

              {/* Progress bar */}
              <View style={styles.progWrap}>
                <View style={styles.trackRow}>
                  <View
                    style={[
                      styles.trackFill,
                      { flex: progress, backgroundColor: tier.base },
                    ]}
                  />
                  <View
                    style={[
                      styles.trackEmpty,
                      { flex: Math.max(0, 1 - progress) },
                    ]}
                  />
                </View>
              </View>

              {/* Actions */}
              <FadeIn delay={100} style={styles.actions}>
                <ActionTile
                  emoji="🎁"
                  label={t ? 'Canjear' : 'Redeem'}
                  onPress={() => router.push('/(app)/offers' as never)}
                />
                <ActionTile
                  emoji="🏆"
                  label={t ? 'Niveles' : 'Tiers'}
                  onPress={() => router.push('/(app)/profile/loyalty-levels' as never)}
                />
              </FadeIn>

              {/* Timeline header */}
              <FadeIn delay={160} style={styles.timelineHeader}>
                <Text style={[TypePresets.kicker, { color: Colors.textMuted }]}>
                  {t ? 'MOVIMIENTOS' : 'ACTIVITY'}
                </Text>
                <View style={styles.hairline} />
              </FadeIn>
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeIn delay={40 * Math.min(index, 4)}>
              <View style={styles.monthGroup}>
                <Text style={[TypePresets.label, { color: Colors.textMuted, opacity: 0.6 }]}>
                  {item.month.toUpperCase()}
                </Text>
                {item.txs.map((tx) => (
                  <TxRow key={tx.id} tx={tx} tierAccent={tier.base} lang={language} t={t} />
                ))}
              </View>
            </FadeIn>
          )}
          ListEmptyComponent={
            <View style={{ minHeight: 240 }}>
              <EmptyState
                icon="clock"
                title={t ? 'Sin movimientos aún' : 'No activity yet'}
                message={t ? 'Tus puntos aparecerán aquí.' : 'Your points will appear here.'}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ActionTile({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
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
      <Text style={[TypePresets.bodyLg, { color: Colors.textPrimary }]}>{emoji}</Text>
      <Text style={[TypePresets.subhead, { color: Colors.textPrimary }]}>{label}</Text>
    </Pressy>
  );
}

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
  const positive = amount > 0;
  const dateStr = tx.createdAt
    ? new Date(tx.createdAt).toLocaleDateString(lang, { day: 'numeric', month: 'short' })
    : '';
  return (
    <View style={styles.txRow}>
      <View style={styles.dot} />
      <View style={styles.txText}>
        <Text style={[TypePresets.bodySm, { color: Colors.textPrimary }]} numberOfLines={1}>
          {tx.description || tx.reason || (t ? 'Movimiento' : 'Activity')}
        </Text>
        <Text style={[TypePresets.caption, { color: Colors.textMuted }]}>{dateStr}</Text>
      </View>
      <Text
        style={[
          TypePresets.numericSm,
          { color: positive ? tierAccent : Colors.accentDanger },
        ]}
      >
        {positive ? '+' : ''}
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  heroNumber: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1,
    color: Colors.textPrimary,
  },

  progWrap: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  trackRow: {
    flexDirection: 'row',
    height: 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
  },
  trackEmpty: {
    height: '100%',
    backgroundColor: 'rgba(246,241,231,0.10)',
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  actionTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,241,231,0.06)',
  },

  timelineHeader: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 8,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(246,241,231,0.06)',
  },

  monthGroup: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  txText: {
    flex: 1,
    gap: 1,
  },
});
