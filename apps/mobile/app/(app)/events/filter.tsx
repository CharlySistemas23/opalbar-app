// ─────────────────────────────────────────────
//  Event Filter — Editorial Premium
//
//  Modal-style filter page: kicker + Heading title, hairline-divided
//  sections (quick date range / category), clear & apply actions in a
//  sticky footer. Categories come from `eventsApi.categories()` — the
//  four hardcoded ids used to render chips that mapped to nothing in the
//  `/events` query. Applying pushes categoryId/startDate/endDate back to
//  the events list as route params.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Body,
  Button,
  Caption,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { useAppStore } from '@/stores/app.store';
import { eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';

type QuickRange = 'all' | 'today' | 'week' | 'weekend';

interface CategoryOption {
  id: string;
  name: string;
  nameEn?: string | null;
}

function rangeToDates(range: QuickRange): { startDate?: string; endDate?: string } {
  const now = new Date();
  if (range === 'all') return {};
  if (range === 'today') {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { startDate: now.toISOString(), endDate: end.toISOString() };
  }
  if (range === 'week') {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return { startDate: now.toISOString(), endDate: end.toISOString() };
  }
  // weekend — through the coming (or current) Fri–Sun window
  const day = now.getDay(); // 0 Sun … 6 Sat
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + daysUntilFriday);
  friday.setHours(0, 0, 0, 0);
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  sunday.setHours(23, 59, 59, 999);
  const start = daysUntilFriday === 0 ? now : friday;
  return { startDate: start.toISOString(), endDate: sunday.toISOString() };
}

export default function EventFilter() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const params = useLocalSearchParams<{ categoryId?: string; range?: string }>();

  const [range, setRange] = useState<QuickRange>((params.range as QuickRange) || 'all');
  const [selectedCategory, setSelectedCategory] = useState(params.categoryId || '');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    eventsApi
      .categories()
      .then((r) => {
        const payload = r.data?.data;
        const rows: CategoryOption[] = Array.isArray(payload) ? payload : payload?.data ?? [];
        setCategories(rows);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const rangeOptions: Array<{ value: QuickRange; label: string }> = [
    { value: 'all', label: t ? 'Cualquier fecha' : 'Any date' },
    { value: 'today', label: t ? 'Hoy' : 'Today' },
    { value: 'weekend', label: t ? 'Este fin de semana' : 'This weekend' },
    { value: 'week', label: t ? 'Próximos 7 días' : 'Next 7 days' },
  ];

  function apply() {
    const { startDate, endDate } = rangeToDates(range);
    router.push({
      pathname: '/(tabs)/events',
      params: {
        categoryId: selectedCategory || '',
        range,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      },
    });
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressy
          onPress={() => router.back()}
          accessibilityLabel={t ? 'Volver' : 'Back'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          style={styles.iconBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
        <Pressy
          onPress={() => {
            setRange('all');
            setSelectedCategory('');
          }}
          accessibilityLabel={t ? 'Limpiar' : 'Clear'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          haptic="select"
          style={styles.clearBtn}
        >
          <Caption tone="accent">{t ? 'Limpiar' : 'Clear'}</Caption>
        </Pressy>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FadeIn>
          <Kicker tone="champagne">{t ? 'AFINAR' : 'REFINE'}</Kicker>
        </FadeIn>
        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Heading size="lg">{t ? 'Filtrar eventos.' : 'Filter events.'}</Heading>
        </FadeIn>

        {/* Quick date range ───────────────── */}
        <FadeIn delay={160} style={{ marginTop: Spacing[8] }}>
          <Kicker tone="muted">{t ? 'CUÁNDO' : 'WHEN'}</Kicker>
          <View style={{ marginTop: Spacing[3] }}>
            <Hairline variant="subtle" />
            {rangeOptions.map((opt) => {
              const active = range === opt.value;
              return (
                <View key={opt.value}>
                  <Pressy
                    onPress={() => setRange(opt.value)}
                    accessibilityRole={Roles.button}
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected: active }}
                    haptic="select"
                    style={styles.catRow}
                  >
                    <Subhead tone={active ? 'accent' : 'primary'}>{opt.label}</Subhead>
                    {active ? (
                      <Feather name="check" size={18} color={Colors.accentPrimary} />
                    ) : null}
                  </Pressy>
                  <Hairline variant="subtle" />
                </View>
              );
            })}
          </View>
        </FadeIn>

        {/* Category ────────────────────── */}
        <FadeIn delay={240} style={{ marginTop: Spacing[8] }}>
          <Kicker tone="muted">{t ? 'CATEGORÍA' : 'CATEGORY'}</Kicker>
          <View style={{ marginTop: Spacing[3] }}>
            {loading ? (
              <View style={{ paddingVertical: Spacing[6], alignItems: 'center' }}>
                <ActivityIndicator color={Colors.accentPrimary} />
              </View>
            ) : error ? (
              <Body tone="secondary" style={{ paddingVertical: Spacing[4] }}>
                {error}
              </Body>
            ) : categories.length === 0 ? (
              <Body tone="muted" style={{ paddingVertical: Spacing[4] }}>
                {t ? 'Sin categorías por ahora.' : 'No categories yet.'}
              </Body>
            ) : (
              <>
                <Hairline variant="subtle" />
                {categories.map((cat) => {
                  const active = selectedCategory === cat.id;
                  const label = t ? cat.name : cat.nameEn || cat.name;
                  return (
                    <View key={cat.id}>
                      <Pressy
                        onPress={() => setSelectedCategory(active ? '' : cat.id)}
                        accessibilityRole={Roles.button}
                        accessibilityLabel={label}
                        accessibilityState={{ selected: active }}
                        haptic="select"
                        style={styles.catRow}
                      >
                        <Subhead tone={active ? 'accent' : 'primary'}>{label}</Subhead>
                        {active ? (
                          <Feather name="check" size={18} color={Colors.accentPrimary} />
                        ) : null}
                      </Pressy>
                      <Hairline variant="subtle" />
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </FadeIn>
      </ScrollView>

      <View style={styles.footer}>
        <Hairline variant="subtle" />
        <View style={styles.footerInner}>
          <Button
            label={t ? 'Aplicar filtros' : 'Apply filters'}
            onPress={apply}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[2],
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },
  clearBtn: {
    minHeight: 44,
    paddingHorizontal: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    paddingBottom: 120,
  },

  catRow: {
    minHeight: 56,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[1],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bgPrimary,
  },
  footerInner: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[6],
  },
});
