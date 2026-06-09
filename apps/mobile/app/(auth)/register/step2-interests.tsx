// ─────────────────────────────────────────────
//  Onboarding · Step 2 — Interests (Editorial Premium)
//
//  Layout = Figma canonical:
//   · Progress 2/4 + Kicker + Display headline + Lead
//   · Two semantic groups (Copeo + Shows + fallback Otros)
//   · Group header: Label kicker + Caption lead
//   · 2-col grid of category cards on bgCard hairline border;
//     active uses accent border + bgElevated fill (no neon glow)
//   · Sticky footer: selection note + primary CTA
//
//  Lógica intacta: eventsApi.categories + usersApi.updateInterests + flow.
// ─────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi, eventsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import {
  Colors,
  EditorialSpacing,
  Radius,
  Spacing,
} from '@/constants/tokens';
import { useFeedback } from '@/hooks/useFeedback';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Kicker,
  Label,
  Lead,
  Pressy,
  Subhead,
} from '@/components/ui';

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
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
      router.replace('/(auth)/onboarding/permissions' as never);
    }
  }

  const meetsMin = selected.length >= MIN_SUGGESTED;
  const ctaLabel = selected.length > 0
    ? t ? 'Continuar' : 'Continue'
    : t ? 'Omitir' : 'Skip';

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
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <FadeIn>
          <Kicker tone="champagne">{t ? 'PASO 2 DE 4' : 'STEP 2 OF 4'}</Kicker>
        </FadeIn>
        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Display size="md">
            {t ? '¿Qué te\nenciende?' : 'What lights\nyou up?'}
          </Display>
        </FadeIn>
        <FadeIn delay={180} style={{ marginTop: Spacing[4], maxWidth: 360 }}>
          <Lead tone="secondary">
            {t
              ? `Elige al menos ${MIN_SUGGESTED} para curarte las noches perfectas.`
              : `Pick at least ${MIN_SUGGESTED} so we can curate the perfect nights for you.`}
          </Lead>
        </FadeIn>

        {loadingCats ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.accentPrimary} />
          </View>
        ) : (
          <>
            {groups.copeo.length > 0 && (
              <FadeIn delay={240} style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                  <Label tone="primary">
                    {t ? 'BAR POR COPEO' : 'DRINKS BY THE GLASS'}
                  </Label>
                </View>
                <Caption tone="muted" style={styles.groupSub}>
                  {t
                    ? 'Catas, mixología y descubrir nuevas bebidas'
                    : 'Tastings, mixology and new drinks'}
                </Caption>
                <CategoryGrid
                  items={groups.copeo}
                  selected={selected}
                  onToggle={toggle}
                  t={t}
                />
              </FadeIn>
            )}

            {groups.shows.length > 0 && (
              <FadeIn delay={320} style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                  <Label tone="primary">
                    {t ? 'NOCHES CON SHOW' : 'NIGHTS WITH SHOWS'}
                  </Label>
                </View>
                <Caption tone="muted" style={styles.groupSub}>
                  {t
                    ? 'En vivo, DJ, comedia y todo lo que se mueve'
                    : 'Live music, DJ, comedy and everything that moves'}
                </Caption>
                <CategoryGrid
                  items={groups.shows}
                  selected={selected}
                  onToggle={toggle}
                  t={t}
                />
              </FadeIn>
            )}

            {groups.other.length > 0 && (
              <FadeIn delay={400} style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                  <Label tone="primary">{t ? 'OTROS' : 'OTHERS'}</Label>
                </View>
                <CategoryGrid
                  items={groups.other}
                  selected={selected}
                  onToggle={toggle}
                  t={t}
                />
              </FadeIn>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.selectionNote}>
          <Feather
            name={meetsMin ? 'check-circle' : 'info'}
            size={14}
            color={meetsMin ? Colors.accentSuccess : Colors.textMuted}
          />
          <Caption tone={meetsMin ? 'success' : 'muted'}>
            {selected.length === 0
              ? t
                ? `Elige al menos ${MIN_SUGGESTED}`
                : `Pick at least ${MIN_SUGGESTED}`
              : t
                ? `${selected.length} ${selected.length === 1 ? 'seleccionada' : 'seleccionadas'}`
                : `${selected.length} selected`}
          </Caption>
        </View>
        <Button
          label={ctaLabel}
          onPress={handleDone}
          loading={loading}
          variant="primary"
          size="lg"
          fullWidth
          rightIcon={<Feather name="arrow-right" size={18} color={Colors.textInverse} />}
        />
      </View>
    </SafeAreaView>
  );
}

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
        const label = t ? cat.name : cat.nameEn ?? cat.name;

        return (
          <Pressy
            key={cat.id}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            haptic="select"
            onPress={() => onToggle(cat.id)}
            style={[styles.card, active && styles.cardActive]}
          >
            <View
              style={[styles.cardIcon, active && styles.cardIconActive]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Feather
                name={iconName}
                size={18}
                color={active ? Colors.accentPrimary : Colors.textSecondary}
              />
            </View>
            <Subhead tone={active ? 'primary' : 'secondary'} numberOfLines={2}>
              {label}
            </Subhead>
            {active ? (
              <View style={styles.checkBadge}>
                <Feather name="check" size={11} color={Colors.textInverse} />
              </View>
            ) : null}
          </Pressy>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  stepRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[5],
    paddingBottom: Spacing[3],
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
  },
  stepDotActive: { backgroundColor: Colors.accentPrimary },

  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[8],
  },

  loader: {
    marginTop: Spacing[10],
    alignItems: 'center',
  },

  groupBlock: {
    marginTop: Spacing[8],
    gap: Spacing[3],
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupSub: {
    marginTop: -Spacing[1],
    marginBottom: Spacing[2],
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  card: {
    width: '48.5%',
    minHeight: 112,
    padding: Spacing[3],
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing[3],
    position: 'relative',
  },
  cardActive: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.accentPrimary,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconActive: {
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderColor: 'rgba(201,169,97,0.35)',
  },
  checkBadge: {
    position: 'absolute',
    top: Spacing[2],
    right: Spacing[2],
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[4],
    paddingTop: Spacing[3],
    gap: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  selectionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    justifyContent: 'center',
  },
});
