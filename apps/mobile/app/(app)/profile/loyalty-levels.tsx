// ─────────────────────────────────────────────
//  Loyalty Levels — Editorial Premium
//
//  Magazine layout:
//   · Hero block: kicker NIVEL ACTUAL + serif Heading level name +
//     Numeric points + progress hairline rule to next level
//   · Section TODOS LOS NIVELES — each level is an editorial Card:
//     icon (or padlock) + name + range + benefits paragraph. Current
//     level gets accent border; locked levels dim by 0.55.
// ─────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { loyaltyApi } from '@/api/client';
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

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const FEATHER_ICONS = new Set<string>([
  'star', 'award', 'gift', 'shield', 'zap', 'heart', 'crown', 'trophy',
]);

function resolveIcon(raw?: string | null): FeatherName {
  if (raw && FEATHER_ICONS.has(raw)) return raw as FeatherName;
  return 'star';
}

interface Level {
  id: string;
  name: string;
  minPoints?: number;
  maxPoints?: number;
  color?: string;
  icon?: string | null;
  benefits?: string;
}

export default function LoyaltyLevels() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loyaltyApi
      .levels()
      .then((r) => {
        const payload = r.data?.data;
        const items: Level[] = Array.isArray(payload) ? payload : payload?.items ?? [];
        const sorted = [...items].sort((a, b) => (a.minPoints ?? 0) - (b.minPoints ?? 0));
        setLevels(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentPoints = user?.points ?? 0;

  const { currentLevel, nextLevel, progress } = useMemo(() => {
    if (!levels.length) return { currentLevel: null as Level | null, nextLevel: null as Level | null, progress: 0 };
    let current: Level = levels[0];
    let next: Level | null = null;
    for (let i = 0; i < levels.length; i++) {
      if (currentPoints >= (levels[i].minPoints ?? 0)) {
        current = levels[i];
        next = levels[i + 1] ?? null;
      }
    }
    let pct = 1;
    if (next) {
      const from = current.minPoints ?? 0;
      const to = next.minPoints ?? from + 1;
      pct = Math.max(0, Math.min(1, (currentPoints - from) / Math.max(1, to - from)));
    }
    return { currentLevel: current, nextLevel: next, progress: pct };
  }, [levels, currentPoints]);

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
          <SkeletonList count={4} itemHeight={92} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Hero ── */}
          <FadeIn style={styles.hero}>
            <Kicker tone="muted">{t ? 'NIVEL ACTUAL' : 'CURRENT TIER'}</Kicker>
            <Heading size="lg" style={{ marginTop: Spacing[3] }}>
              {currentLevel?.name ?? '—'}
            </Heading>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: Spacing[5], gap: Spacing[2] }}>
              <Numeric size="md">{currentPoints.toLocaleString(language)}</Numeric>
              <Caption tone="champagne">{t ? 'PTS' : 'PTS'}</Caption>
            </View>

            {nextLevel ? (
              <View style={{ marginTop: Spacing[5] }}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
                <Caption tone="muted" style={{ marginTop: Spacing[3] }}>
                  {t
                    ? `${Math.max(0, (nextLevel.minPoints ?? 0) - currentPoints)} pts para ${nextLevel.name}`
                    : `${Math.max(0, (nextLevel.minPoints ?? 0) - currentPoints)} pts to ${nextLevel.name}`}
                </Caption>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing[5], gap: Spacing[2] }}>
                <Feather name="check-circle" size={14} color={Colors.accentSuccess} />
                <Caption tone="success">
                  {t ? 'Has alcanzado el nivel máximo.' : 'You have reached the top tier.'}
                </Caption>
              </View>
            )}
          </FadeIn>

          <FadeIn delay={120}>
            <Hairline variant="subtle" style={{ marginHorizontal: EditorialSpacing.pageGutter }} />
          </FadeIn>

          {/* ── All levels ── */}
          <FadeIn delay={160} style={styles.section}>
            <Kicker tone="muted">{t ? 'TODOS LOS NIVELES' : 'ALL TIERS'}</Kicker>
            <Heading size="sm" style={{ marginTop: Spacing[1], marginBottom: Spacing[5] }}>
              {t ? 'La escalera' : 'The ladder'}
            </Heading>

            <View style={{ gap: Spacing[3] }}>
              {levels.map((level, idx) => {
                const isCurrent = currentLevel?.id === level.id;
                const achieved = currentPoints >= (level.minPoints ?? 0);
                const tint = level.color ?? Colors.accentPrimary;
                return (
                  <FadeIn key={level.id} delay={70 * idx}>
                    <View
                      style={[
                        styles.levelCard,
                        isCurrent && { borderColor: tint },
                        !achieved && styles.levelCardLocked,
                      ]}
                    >
                      <View style={styles.levelIconBox}>
                        <Feather
                          name={achieved ? resolveIcon(level.icon) : 'lock'}
                          size={20}
                          color={achieved ? tint : Colors.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.levelRow}>
                          <Heading size="sm" tone={achieved ? 'primary' : 'muted'}>
                            {level.name}
                          </Heading>
                          {isCurrent ? (
                            <Caption tone="champagne" style={{ marginLeft: Spacing[2] }}>
                              {t ? 'ACTUAL' : 'CURRENT'}
                            </Caption>
                          ) : null}
                        </View>
                        <Caption tone="muted" style={{ marginTop: 2 }}>
                          {level.minPoints ?? 0}
                          {level.maxPoints ? ` – ${level.maxPoints}` : '+'} {t ? 'pts' : 'pts'}
                        </Caption>
                        {level.benefits ? (
                          <Body size="sm" tone="secondary" style={{ marginTop: Spacing[3] }} numberOfLines={4}>
                            {level.benefits}
                          </Body>
                        ) : null}
                      </View>
                    </View>
                  </FadeIn>
                );
              })}
            </View>
          </FadeIn>
        </ScrollView>
      )}
    </SafeAreaView>
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
  scroll: {
    paddingBottom: Spacing[12],
  },
  hero: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[8],
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
  },
  section: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[8],
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[4],
    padding: Spacing[5],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  levelCardLocked: { opacity: 0.55 },
  levelIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
