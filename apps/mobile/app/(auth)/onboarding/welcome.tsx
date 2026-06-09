// ─────────────────────────────────────────────
//  Onboarding · Welcome celebration (Editorial Premium)
//
//  Layout = Figma canonical:
//   · Progress 4/4 (all complete)
//   · Kicker accent overline + Display headline ("¡Bienvenido, Nombre.")
//   · Lead body with welcome line + champagne points note
//   · Section label + 3 suggestion list items (bgCard hairline pill,
//     icon chip + Subhead + Caption + arrow-right)
//   · Bottom CTA: primary gold "Entrar a OPAL BAR"
//
//  Lógica intacta: success haptic on mount, router.replace to (tabs)/home
//  o a las rutas de cada sugerencia.
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAuthStore } from '@/stores/auth.store';
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

export default function OnboardingWelcome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const firstName = user?.profile?.firstName ?? '';

  useEffect(() => {
    fb.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestions: {
    icon: FeatherIcon;
    titleEs: string;
    titleEn: string;
    subEs: string;
    subEn: string;
    path: string;
  }[] = [
    {
      icon: 'calendar',
      titleEs: 'Descubre eventos',
      titleEn: 'Discover events',
      subEs: 'Mira qué pasa esta semana',
      subEn: "See what's on this week",
      path: '/(tabs)/events',
    },
    {
      icon: 'tag',
      titleEs: 'Revisa las ofertas',
      titleEn: 'Check offers',
      subEs: 'Promociones activas del día',
      subEn: "Today's active promotions",
      path: '/(app)/offers',
    },
    {
      icon: 'message-square',
      titleEs: 'Entra a la comunidad',
      titleEn: 'Join the community',
      subEs: 'Conecta con otros clientes',
      subEn: 'Connect with other guests',
      path: '/(tabs)/community',
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Progress (all complete) */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepDot, styles.stepDotActive]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <FadeIn>
          <Kicker tone="champagne">{t ? 'TODO LISTO' : 'ALL SET'}</Kicker>
        </FadeIn>
        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Display size="md">
            {firstName
              ? t
                ? `Bienvenido,\n${firstName}.`
                : `Welcome,\n${firstName}.`
              : t
                ? 'Bienvenido.'
                : 'Welcome.'}
          </Display>
        </FadeIn>
        <FadeIn delay={180} style={{ marginTop: Spacing[4], maxWidth: 360 }}>
          <Lead tone="secondary">
            {t
              ? 'Tu cuenta en OPALBAR está activa. Te regalamos 50 puntos para empezar.'
              : 'Your OPALBAR account is active. We gifted you 50 points to start.'}
          </Lead>
        </FadeIn>

        <FadeIn delay={260} style={styles.bonusCard}>
          <View
            style={styles.bonusIcon}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Feather name="gift" size={16} color={Colors.accentPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Label tone="accent">
              {t ? '+50 PUNTOS DE BIENVENIDA' : '+50 WELCOME POINTS'}
            </Label>
            <Caption tone="muted" style={{ marginTop: 2 }}>
              {t
                ? 'Disponibles en tu wallet desde hoy.'
                : 'Available in your wallet from today.'}
            </Caption>
          </View>
        </FadeIn>

        <FadeIn delay={340} style={{ marginTop: Spacing[8] }}>
          <Label tone="secondary">{t ? 'POR DÓNDE EMPEZAR' : 'WHERE TO START'}</Label>
        </FadeIn>

        <View style={styles.suggestionsCol}>
          {suggestions.map((s, i) => (
            <FadeIn key={s.path} delay={400 + i * 70}>
              <Pressy
                accessibilityRole="button"
                accessibilityLabel={t ? s.titleEs : s.titleEn}
                onPress={() => {
                  fb.tap();
                  router.replace(s.path as never);
                }}
                style={styles.suggestionCard}
              >
                <View
                  style={styles.suggestionIcon}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Feather name={s.icon} size={18} color={Colors.accentPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Subhead tone="primary">{t ? s.titleEs : s.titleEn}</Subhead>
                  <Caption tone="muted" style={{ marginTop: 2 }}>
                    {t ? s.subEs : s.subEn}
                  </Caption>
                </View>
                <Feather name="arrow-right" size={16} color={Colors.textMuted} />
              </Pressy>
            </FadeIn>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t ? 'Entrar a OPALBAR' : 'Enter OPALBAR'}
          onPress={() => {
            fb.tap();
            router.replace('/(tabs)/home' as never);
          }}
          variant="primary"
          size="lg"
          fullWidth
          rightIcon={<Feather name="arrow-right" size={18} color={Colors.textInverse} />}
        />
      </View>
    </SafeAreaView>
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

  bonusCard: {
    marginTop: Spacing[6],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.35)',
    borderRadius: Radius.lg,
  },
  bonusIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(201,169,97,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  suggestionsCol: {
    marginTop: Spacing[3],
    gap: Spacing[2],
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
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
});
