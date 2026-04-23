import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { loyaltyApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const FEATHER_ICONS = new Set<string>(['star', 'award', 'gift', 'shield', 'zap', 'heart', 'crown', 'trophy']);

function resolveIcon(raw?: string | null): FeatherName {
  if (raw && FEATHER_ICONS.has(raw)) return raw as FeatherName;
  return 'star';
}

export default function LoyaltyLevels() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loyaltyApi
      .levels()
      .then((r) => {
        const payload = r.data?.data;
        const items = Array.isArray(payload) ? payload : payload?.items ?? [];
        const sorted = [...items].sort((a, b) => (a.minPoints ?? 0) - (b.minPoints ?? 0));
        setLevels(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentPoints = user?.points ?? 0;

  const { currentLevel, nextLevel, progress } = useMemo(() => {
    if (!levels.length) return { currentLevel: null, nextLevel: null, progress: 0 };
    let current = levels[0];
    let next: any = null;
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

  const currentColor = currentLevel?.color ?? Colors.accentPrimary;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Niveles' : 'Levels'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: currentColor }]}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconBox}>
                <Feather name={resolveIcon(currentLevel?.icon)} size={26} color={Colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>{t ? 'Tu nivel' : 'Your level'}</Text>
                <Text style={styles.heroLevelName}>{currentLevel?.name ?? '—'}</Text>
              </View>
              <View style={styles.heroPointsBox}>
                <Text style={styles.heroPointsValue}>{currentPoints}</Text>
                <Text style={styles.heroPointsLabel}>{t ? 'pts' : 'pts'}</Text>
              </View>
            </View>

            {nextLevel ? (
              <View style={styles.progressBlock}>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressText}>
                    {t ? 'Siguiente' : 'Next'}: {nextLevel.name}
                  </Text>
                  <Text style={styles.progressText}>
                    {Math.max(0, (nextLevel.minPoints ?? 0) - currentPoints)} {t ? 'pts restantes' : 'pts to go'}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
              </View>
            ) : (
              <View style={styles.maxBadge}>
                <Feather name="check-circle" size={14} color={Colors.textInverse} />
                <Text style={styles.maxBadgeText}>
                  {t ? 'Has alcanzado el nivel máximo' : 'You have reached the top tier'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>{t ? 'Todos los niveles' : 'All levels'}</Text>

          {levels.map((level) => {
            const isCurrent = currentLevel?.id === level.id;
            const achieved = currentPoints >= (level.minPoints ?? 0);
            const tint = level.color ?? Colors.accentPrimary;
            return (
              <View
                key={level.id}
                style={[
                  styles.levelCard,
                  isCurrent && { borderColor: tint, borderWidth: 1.5 },
                  !achieved && styles.levelCardLocked,
                ]}
              >
                <View style={[styles.levelIcon, { backgroundColor: achieved ? `${tint}20` : Colors.bgPrimary }]}>
                  <Feather
                    name={achieved ? resolveIcon(level.icon) : 'lock'}
                    size={20}
                    color={achieved ? tint : Colors.textMuted}
                  />
                </View>
                <View style={styles.levelInfo}>
                  <View style={styles.levelTitleRow}>
                    <Text style={[styles.levelName, { color: achieved ? Colors.textPrimary : Colors.textMuted }]}>
                      {level.name}
                    </Text>
                    {isCurrent && (
                      <View style={[styles.currentPill, { backgroundColor: `${tint}20` }]}>
                        <Text style={[styles.currentPillText, { color: tint }]}>
                          {t ? 'Actual' : 'Current'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.levelReq}>
                    {level.minPoints ?? 0}
                    {level.maxPoints ? ` – ${level.maxPoints}` : '+'} {t ? 'pts' : 'pts'}
                  </Text>
                  {level.benefits ? (
                    <Text style={styles.levelBenefits} numberOfLines={3}>
                      {level.benefits}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 16 },

  hero: {
    borderRadius: Radius.xl,
    padding: 18,
    gap: 16,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  heroLevelName: { color: Colors.textInverse, fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  heroPointsBox: { alignItems: 'flex-end' },
  heroPointsValue: { color: Colors.textInverse, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroPointsLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },

  progressBlock: { gap: 8 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.textInverse, borderRadius: 4 },

  maxBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  maxBadgeText: { color: Colors.textInverse, fontSize: 12, fontWeight: '600' },

  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  levelCardLocked: { opacity: 0.6 },
  levelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelInfo: { flex: 1, gap: 2 },
  levelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelName: { fontSize: 15, fontWeight: '700' },
  levelReq: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  levelBenefits: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 17 },
  currentPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
});
