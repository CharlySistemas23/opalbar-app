import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import {
  requestLocationPermission,
  requestCameraPermission,
  requestNotificationPermission,
} from '@/lib/permissions';
import { useFeedback } from '@/hooks/useFeedback';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Step {
  key: 'location' | 'camera' | 'notifications';
  icon: FeatherIcon;
  color: string;
  titleEs: string; titleEn: string;
  messageEs: string; messageEn: string;
  hintEs: string; hintEn: string;
  request: () => Promise<'granted' | 'denied' | 'unavailable'>;
}

const STEPS: Step[] = [
  {
    key: 'location',
    icon: 'map-pin',
    color: '#60A5FA',
    titleEs: 'Tu ubicación',
    titleEn: 'Your location',
    messageEs: 'Úsala para mostrarte bares y eventos cerca de ti, y para validar tu check-in.',
    messageEn: 'Use it to show bars and events near you, and to validate your check-in.',
    hintEs: 'Solo se usa cuando la app está abierta. Puedes cambiarlo cuando quieras.',
    hintEn: 'Only used while the app is open. You can change this anytime.',
    request: requestLocationPermission,
  },
  {
    key: 'camera',
    icon: 'camera',
    color: Colors.accentSuccess,
    titleEs: 'Acceso a la cámara',
    titleEn: 'Camera access',
    messageEs: 'La necesitamos para escanear códigos QR y para que puedas compartir momentos en la comunidad.',
    messageEn: 'We need it to scan QR codes and so you can share moments with the community.',
    hintEs: 'Nunca accedemos sin tu autorización. Puedes denegarla ahora y activarla después.',
    hintEn: 'We never access it without permission. You can deny now and enable it later.',
    request: requestCameraPermission,
  },
  {
    key: 'notifications',
    icon: 'bell',
    color: Colors.accentPrimary,
    titleEs: 'Notificaciones',
    titleEn: 'Notifications',
    messageEs: 'Te avisamos cuando cambie tu reserva, gane una oferta o se publique algo que te interesa.',
    messageEn: 'We\'ll ping you when your booking changes, you win an offer, or something you like is posted.',
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
      {/* Global progress 3/4 (steps 1 & 2 completed) */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, { backgroundColor: Colors.accentPrimary }]} />
        <View style={[styles.stepDot, { backgroundColor: Colors.accentPrimary }]} />
        <View style={[styles.stepDot, { backgroundColor: Colors.accentPrimary }]} />
        <View style={[styles.stepDot, { backgroundColor: Colors.bgCard }]} />
      </View>
      <View style={styles.subStepRow}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.subStepDot,
              { backgroundColor: i <= idx ? step.color : Colors.bgElevated },
            ]}
          />
        ))}
      </View>

      <View style={styles.body}>
        <View style={[styles.iconOuter, { backgroundColor: step.color + '15' }]}>
          <View style={[styles.iconInner, { backgroundColor: step.color + '25' }]}>
            <Feather name={step.icon} size={48} color={step.color} />
          </View>
        </View>

        <Text style={styles.title}>{t ? step.titleEs : step.titleEn}</Text>
        <Text style={styles.message}>{t ? step.messageEs : step.messageEn}</Text>

        <View style={styles.hintBox}>
          <Feather name="info" size={13} color={Colors.textMuted} />
          <Text style={styles.hintText}>{t ? step.hintEs : step.hintEn}</Text>
        </View>

        <Text style={styles.stepCount}>
          {t ? 'Paso' : 'Step'} {idx + 1} {t ? 'de' : 'of'} {STEPS.length}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: step.color }, loading && { opacity: 0.7 }]}
          onPress={handleAllow}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading
            ? <ActivityIndicator color={Colors.textInverse} />
            : <Text style={styles.primaryLbl}>{t ? 'Permitir' : 'Allow'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={next} activeOpacity={0.85}>
          <Text style={[styles.secondaryLbl, { color: step.color }]}>
            {t ? 'Ahora no' : 'Not now'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  stepRow: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 4,
  },
  stepDot: { flex: 1, height: 4, borderRadius: 2 },
  subStepRow: {
    flexDirection: 'row', gap: 4,
    paddingHorizontal: 24, paddingTop: 6, paddingBottom: 4,
  },
  subStepDot: { flex: 1, height: 2, borderRadius: 1, opacity: 0.6 },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32, gap: 16,
  },
  iconOuter: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  iconInner: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24, fontWeight: '800',
    textAlign: 'center', lineHeight: 30,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 14, lineHeight: 22,
    textAlign: 'center',
  },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 8,
  },
  hintText: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, flex: 1 },
  stepCount: { color: Colors.textMuted, fontSize: 11, marginTop: 12, letterSpacing: 1 },

  footer: {
    paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8, gap: 10,
  },
  primaryBtn: {
    height: 54, borderRadius: Radius.button,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryLbl: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    height: 46, borderRadius: Radius.button,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryLbl: { fontSize: 14, fontWeight: '700' },
});
