import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usersApi, eventsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors } from '@/constants/tokens';
import { useFeedback } from '@/hooks/useFeedback';

// ─────────────────────────────────────────────
//  Onboarding step 2 — Interest categories
//  · Grouped in two sections: Copeo + Shows
//  · Richer 2-col card grid with color tint
//  · Sticky "N seleccionadas" banner
// ─────────────────────────────────────────────

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Category {
  id: string;
  name: string;
  nameEn?: string;
  slug?: string;
  icon?: string;
  color?: string;
}

const ICON_MAP: Record<string, FeatherIcon> = {
  music: 'music',
  disc: 'disc',
  zap: 'zap',
  mic: 'mic',
  coffee: 'coffee',
  wine: 'coffee',
  clock: 'clock',
  users: 'users',
  star: 'star',
  'help-circle': 'help-circle',
  tag: 'tag',
};

// Slugs that belong to each group (everything else lands in "Otros")
const COPEO_SLUGS = new Set([
  'mixologia',
  'cata-mezcal',
  'cata-tequila',
  'cata-whisky',
  'cata-de-vinos',
  'happy-hour',
]);

const SHOWS_SLUGS = new Set([
  'musica-en-vivo',
  'dj-set',
  'karaoke',
  'drag-show',
  'stand-up',
  'tematica',
  'trivia',
]);

const MIN_SUGGESTED = 3;

export default function Step2Interests() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    eventsApi
      .categories()
      .then((r) => {
        const rows = r.data?.data ?? r.data?.data?.data ?? [];
        setCategories(rows);
      })
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, []);

  const groups = useMemo(() => {
    const copeo: Category[] = [];
    const shows: Category[] = [];
    const other: Category[] = [];
    for (const c of categories) {
      if (c.slug && COPEO_SLUGS.has(c.slug)) copeo.push(c);
      else if (c.slug && SHOWS_SLUGS.has(c.slug)) shows.push(c);
      else other.push(c);
    }
    return { copeo, shows, other };
  }, [categories]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Haptic feedback: success tick when we hit the minimum, select for others
      if (next.length === MIN_SUGGESTED && prev.length < MIN_SUGGESTED) {
        fb.success();
      } else {
        fb.select();
      }
      return next;
    });
  }

  async function handleDone() {
    fb.tap();
    setLoading(true);
    try {
      if (selected.length > 0) {
        await usersApi.updateInterests({ categoryIds: selected });
      }
    } catch {}
    finally {
      setLoading(false);
      router.replace('/(auth)/onboarding/permissions' as never);
    }
  }

  const canContinue = selected.length >= 1 || !loading;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Progress 2/4 */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={styles.stepDot} />
        <View style={styles.stepDot} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>{t ? 'Paso 2 de 4' : 'Step 2 of 4'}</Text>
        <Text style={styles.title}>
          {t ? '¿Qué te\nenciende?' : 'What lights\nyou up?'}
        </Text>
        <Text style={styles.subtitle}>
          {t
            ? `Elige al menos ${MIN_SUGGESTED} para que te mostremos las noches perfectas para ti.`
            : `Pick at least ${MIN_SUGGESTED} so we can curate the perfect nights for you.`}
        </Text>

        {loadingCats ? (
          <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── Copeo ───────────────────────────── */}
            {groups.copeo.length > 0 && (
              <View style={styles.groupBlock}>
                <View style={styles.groupHeaderRow}>
                  <View style={styles.groupIconDot}>
                    <Feather name="coffee" size={12} color={Colors.accentPrimary} />
                  </View>
                  <Text style={styles.groupTitle}>
                    {t ? 'Bar por copeo' : 'Drinks by the glass'}
                  </Text>
                </View>
                <Text style={styles.groupSub}>
                  {t
                    ? 'Catas, mixología y descubrir nuevas bebidas'
                    : 'Tastings, mixology and new drinks'}
                </Text>
                <CategoryGrid
                  items={groups.copeo}
                  selected={selected}
                  onToggle={toggle}
                  t={t}
                />
              </View>
            )}

            {/* ── Shows ───────────────────────────── */}
            {groups.shows.length > 0 && (
              <View style={styles.groupBlock}>
                <View style={styles.groupHeaderRow}>
                  <View style={styles.groupIconDot}>
                    <Feather name="star" size={12} color={Colors.accentWarning} />
                  </View>
                  <Text style={styles.groupTitle}>
                    {t ? 'Noches con show' : 'Nights with shows'}
                  </Text>
                </View>
                <Text style={styles.groupSub}>
                  {t
                    ? 'En vivo, DJ, comedia y todo lo que se mueve'
                    : 'Live music, DJ, comedy and everything that moves'}
                </Text>
                <CategoryGrid
                  items={groups.shows}
                  selected={selected}
                  onToggle={toggle}
                  t={t}
                />
              </View>
            )}

            {/* ── Otros (fallback) ─────────────────── */}
            {groups.other.length > 0 && (
              <View style={styles.groupBlock}>
                <View style={styles.groupHeaderRow}>
                  <View style={styles.groupIconDot}>
                    <Feather name="plus" size={12} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.groupTitle}>
                    {t ? 'Otros' : 'Others'}
                  </Text>
                </View>
                <CategoryGrid
                  items={groups.other}
                  selected={selected}
                  onToggle={toggle}
                  t={t}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <View style={styles.selectionNote}>
          <Feather
            name={selected.length >= MIN_SUGGESTED ? 'check-circle' : 'info'}
            size={14}
            color={
              selected.length >= MIN_SUGGESTED ? Colors.accentSuccess : Colors.textMuted
            }
          />
          <Text
            style={[
              styles.selectionNoteText,
              selected.length >= MIN_SUGGESTED && { color: Colors.accentSuccess },
            ]}
          >
            {selected.length === 0
              ? t
                ? `Elige al menos ${MIN_SUGGESTED}`
                : `Pick at least ${MIN_SUGGESTED}`
              : t
                ? `${selected.length} ${selected.length === 1 ? 'seleccionada' : 'seleccionadas'}`
                : `${selected.length} selected`}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (loading || !canContinue) && { opacity: 0.6 },
            pressed && styles.pressed,
          ]}
          onPress={handleDone}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <Text style={styles.primaryBtnLabel}>
                {selected.length > 0
                  ? t ? 'Continuar' : 'Continue'
                  : t ? 'Omitir' : 'Skip'}
              </Text>
              <Feather name="arrow-right" size={18} color={Colors.textInverse} />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Grid sub-component
// ─────────────────────────────────────────────
function CategoryGrid({
  items,
  selected,
  onToggle,
  t,
}: {
  items: Category[];
  selected: string[];
  onToggle: (id: string) => void;
  t: boolean;
}) {
  return (
    <View style={styles.grid}>
      {items.map((cat) => {
        const active = selected.includes(cat.id);
        const iconName = ICON_MAP[cat.icon || ''] || 'tag';
        const tint = cat.color || Colors.accentPrimary;
        const label = t ? cat.name : cat.nameEn ?? cat.name;

        return (
          <Pressable
            key={cat.id}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: active ? tint + '18' : Colors.bgCard,
                borderColor: active ? tint : Colors.border,
              },
              pressed && styles.pressed,
            ]}
            onPress={() => onToggle(cat.id)}
          >
            <View style={[styles.cardGlow, { backgroundColor: tint + '22' }]} />
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: active ? tint + '38' : tint + '1A' },
              ]}
            >
              <Feather name={iconName} size={22} color={tint} />
            </View>
            <Text
              style={[
                styles.cardLabel,
                active && { color: Colors.textPrimary, fontWeight: '800' },
              ]}
              numberOfLines={2}
            >
              {label}
            </Text>
            {active && (
              <View style={[styles.checkBadge, { backgroundColor: tint }]}>
                <Feather name="check" size={12} color={Colors.textInverse} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.85 },

  stepRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
  },
  stepDotActive: { backgroundColor: Colors.accentPrimary },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },

  kicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
    lineHeight: 36,
    letterSpacing: -0.5,
    paddingHorizontal: 4,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    paddingHorizontal: 4,
  },

  // Group header
  groupBlock: {
    marginTop: 28,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  groupIconDot: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  groupSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
    marginBottom: 14,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    minHeight: 112,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  cardGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.4,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    letterSpacing: -0.1,
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
    gap: 10,
  },
  selectionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  selectionNoteText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
});
