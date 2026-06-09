// ─────────────────────────────────────────────
//  Onboarding · Permissions (Editorial Premium)
//
//  Layout = Figma canonical:
//   · Progress 3/4 + sub-step micro-dots
//   · Kicker accent overline (LOCATION / CAMERA / NOTIFICATIONS)
//   · Display headline + Lead body for the rationale
//   · Hint card in bgCard hairline pill explaining privacy
//   · Bottom CTAs: primary gold "Permitir" + ghost "Ahora no"
//
//  Lógica intacta: requestLocation / Camera / Notification permissions and
//  step advance on either action. Final step → /(auth)/onboarding/welcome.
// ─────────────────────────────────────────────
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAppStore } from '@/stores/app.store';
import {
  Colors,
  EditorialSpacing,
  Radius,
  Spacing,
} from '@/constants/tokens';
import {
  requestCameraPermission,
  requestLocationPermission,
  requestNotificationPermission,
} from '@/lib/permissions';
import { useFeedback } from '@/hooks/useFeedback';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Kicker,
  Lead,
} from '@/components/ui';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Step {
  key: 'location' | 'camera' | 'notifications';
  icon: FeatherIcon;
  kickerEs: string;
  kickerEn: string;
  titleEs: string;
  titleEn: string;
  messageEs: string;
  messageEn: string;
  hintEs: string;
  hintEn: string;
  request: () => Promise<'granted' | 'denied' | 'unavailable'>;
}

const STEPS: Step[] = [
  {
    key: 'location',
    icon: 'map-pin',
    kickerEs: 'TU UBICACIÓN',
    kickerEn: 'YOUR LOCATION',
    titleEs: 'Mostramos lo\nque hay cerca.',
    titleEn: 'We show what\nis nearby.',
    messageEs:
      'La usamos para mostrarte bares y eventos cerca, y para validar tu check-in.',
    messageEn:
      'We use it to show bars and events near you, and to validate your check-in.',
    hintEs: 'Solo se usa cuando la app está abierta. Puedes cambiarlo cuando quieras.',
    hintEn: 'Only used while the app is open. You can change this anytime.',
    request: requestLocationPermission,
  },
  {
    key: 'camera',
    icon: 'camera',
    kickerEs: 'CÁMARA',
    kickerEn: 'CAMERA',
    titleEs: 'Escanea QR y\ncomparte la noche.',
    titleEn: 'Scan QR and\nshare the night.',
    messageEs:
      'La necesitamos para escanear códigos QR y para que compartas momentos en la comunidad.',
    messageEn:
      'We need it to scan QR codes and so you can share moments with the community.',
    hintEs: 'Nunca accedemos sin permiso. Puedes denegarla ahora y activarla después.',
    hintEn: 'We never access it without permission. You can deny now and enable later.',
    request: requestCameraPermission,
  },
  {
    key: 'notifications',
    icon: 'bell',
    kickerEs: 'NOTIFICACIONES',
    kickerEn: 'NOTIFICATIONS',
    titleEs: 'Te avisamos cuando\nimporta.',
    titleEn: 'We ping you when\nit matters.',
    messageEs:
      'Cuando cambia tu reserva, ganas una oferta o se publica algo que te interesa.',
    messageEn:
      "When your booking changes, you win an offer, or something you like is posted.",
    hintEs: 'Puedes elegir el detalle de qué recibir desde tu perfil.',
    hintEn: 'You can fine-tune what you receive from your profile.',
    request: requestNotificationPermission,
  },
];

export default function Permissions() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const step = STEPS[idx];

  function next() {
    if (idx < STEPS.length - 1) {
      fb.select();
      setIdx(idx + 1);
    } else {
      router.replace('/(auth)/onboarding/welcome' as never);
    }
  }

  async function handleAllow() {
    fb.tap();
    setLoading(true);
    try {
      const result = await step.request();
      if (result === 'granted') fb.success();
      else if (result === 'denied') fb.warning();
    } finally {
      setLoading(false);
      next();
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Progress 3/4 */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={styles.stepDot} />
      </View>
      <View style={styles.subStepRow}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.subStepDot, i <= idx && styles.subStepDotActive]}
          />
        ))}
      </View>

      <View style={styles.body}>
        <FadeIn key={`icon-${step.key}`}>
          <View
            style={styles.iconChip}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Feather name={step.icon} size={20} color={Colors.accentPrimary} />
          </View>
        </FadeIn>

        <FadeIn key={`kicker-${step.key}`} delay={120} style={{ marginTop: Spacing[5] }}>
          <Kicker tone="champagne">{t ? step.kickerEs : step.kickerEn}</Kicker>
        </FadeIn>

        <FadeIn key={`title-${step.key}`} delay={180} style={{ marginTop: Spacing[3] }}>
          <Display size="md">{t ? step.titleEs : step.titleEn}</Display>
        </FadeIn>

        <FadeIn
          key={`msg-${step.key}`}
          delay={260}
          style={{ marginTop: Spacing[4], maxWidth: 360 }}
        >
          <Lead tone="secondary">{t ? step.messageEs : step.messageEn}</Lead>
        </FadeIn>

        <FadeIn key={`hint-${step.key}`} delay={340} style={styles.hintCard}>
          <View
            style={styles.hintIcon}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Feather name="info" size={14} color={Colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Caption tone="muted">{t ? step.hintEs : step.hintEn}</Caption>
          </View>
        </FadeIn>

        <View style={styles.stepCountWrap}>
          <Body size="sm" tone="muted">
            {t ? 'Paso' : 'Step'} {idx + 1} {t ? 'de' : 'of'} {STEPS.length}
          </Body>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label={t ? 'Permitir' : 'Allow'}
          onPress={handleAllow}
          loading={loading}
          variant="primary"
          size="lg"
          fullWidth
        />
        <Button
          label={t ? 'Ahora no' : 'Not now'}
          onPress={next}
          variant="ghost"
          size="lg"
          fullWidth
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
    paddingBottom: Spacing[1],
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
  },
  stepDotActive: { backgroundColor: Colors.accentPrimary },

  subStepRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[1],
    paddingBottom: Spacing[2],
  },
  subStepDot: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.bgElevated,
  },
  subStepDotActive: { backgroundColor: 'rgba(201,169,97,0.55)' },

  body: {
    flex: 1,
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[6],
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintCard: {
    marginTop: Spacing[6],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  hintIcon: {
    paddingTop: 2,
  },
  stepCountWrap: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: Spacing[4],
  },

  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[4],
    paddingTop: Spacing[2],
    gap: Spacing[3],
  },
});
