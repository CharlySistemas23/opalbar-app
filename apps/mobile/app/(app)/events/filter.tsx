// ─────────────────────────────────────────────
//  Event Filter — Editorial Premium
//
//  Modal-style filter page: kicker + Heading title, hairline-divided
//  sections (day / category), clear & apply actions in a sticky footer.
// ─────────────────────────────────────────────
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
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
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { useAppStore } from '@/stores/app.store';

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EventFilter() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = [
    { id: 'live_music', label: t ? 'Música en vivo' : 'Live music' },
    { id: 'dj', label: 'DJ' },
    { id: 'art', label: t ? 'Arte' : 'Art' },
    { id: 'food', label: t ? 'Gastronomía' : 'Food' },
  ];

  const days = t ? DAYS_ES : DAYS_EN;

  function toggleDay(i: number) {
    setSelectedDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
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
            setSelectedDays([]);
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

        {/* Day of week ───────────────────── */}
        <FadeIn delay={160} style={{ marginTop: Spacing[8] }}>
          <Kicker tone="muted">{t ? 'DÍA DE LA SEMANA' : 'DAY OF WEEK'}</Kicker>
          <View style={styles.daysRow}>
            {days.map((day, i) => {
              const active = selectedDays.includes(i);
              return (
                <Pressy
                  key={i}
                  onPress={() => toggleDay(i)}
                  accessibilityRole={Roles.button}
                  accessibilityLabel={day}
                  accessibilityState={{ selected: active }}
                  haptic="select"
                  style={[styles.dayChip, active && styles.dayChipActive]}
                >
                  <Caption tone={active ? 'inverse' : 'secondary'} style={{ fontWeight: '600' }}>
                    {day}
                  </Caption>
                </Pressy>
              );
            })}
          </View>
        </FadeIn>

        {/* Category ────────────────────── */}
        <FadeIn delay={240} style={{ marginTop: Spacing[8] }}>
          <Kicker tone="muted">{t ? 'CATEGORÍA' : 'CATEGORY'}</Kicker>
          <View style={{ marginTop: Spacing[3] }}>
            <Hairline variant="subtle" />
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <View key={cat.id}>
                  <Pressy
                    onPress={() => setSelectedCategory(active ? '' : cat.id)}
                    accessibilityRole={Roles.button}
                    accessibilityLabel={cat.label}
                    accessibilityState={{ selected: active }}
                    haptic="select"
                    style={styles.catRow}
                  >
                    <Subhead tone={active ? 'accent' : 'primary'}>{cat.label}</Subhead>
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
      </ScrollView>

      <View style={styles.footer}>
        <Hairline variant="subtle" />
        <View style={styles.footerInner}>
          <Button
            label={t ? 'Aplicar filtros' : 'Apply filters'}
            onPress={() => router.back()}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

void Body;

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

  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginTop: Spacing[3],
  },
  dayChip: {
    width: 48,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
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
