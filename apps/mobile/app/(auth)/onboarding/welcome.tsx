import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors } from '@/constants/tokens';
import { useFeedback } from '@/hooks/useFeedback';

// ─────────────────────────────────────────────
//  Onboarding step 4 — Welcome celebration
//  · Hero check icon: spring scale + fade
//  · Floating confetti dots behind it
//  · Staggered text fade-up
//  · Cards slide in from the right
//  · Success haptic on mount
// ─────────────────────────────────────────────

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

const CONFETTI_COLORS = ['#F4A340', '#A855F7', '#60A5FA', '#38C793', '#EC4899', '#FFD700'];

export default function OnboardingWelcome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const firstName = user?.profile?.firstName ?? '';

  // Animation values
  const ringScale = useRef(new Animated.Value(0.2)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const coreScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(20)).current;
  const bonusTranslate = useRef(new Animated.Value(20)).current;
  const bonusOpacity = useRef(new Animated.Value(0)).current;
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;
  const card3 = useRef(new Animated.Value(0)).current;
  const confetti = useRef(
    Array.from({ length: 12 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    // Fire success haptic + chime when the screen lands
    fb.success();

    // Sequence: ring expands, then check pops, then text fades in, then cards slide
    Animated.sequence([
      // Ring: spring expand + fade
      Animated.parallel([
        Animated.spring(ringScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]),
      // Core check: bouncy pop
      Animated.spring(coreScale, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
      // Title + bonus stagger
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(bonusOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(bonusTranslate, {
          toValue: 0,
          tension: 100,
          friction: 9,
          useNativeDriver: true,
        }),
      ]),
      // Cards cascade
      Animated.stagger(80, [
        Animated.spring(card1, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.spring(card2, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.spring(card3, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();

    // Confetti burst once ring appears
    confetti.forEach((c, i) => {
      const angle = (i / confetti.length) * Math.PI * 2;
      const distance = 140 + Math.random() * 60;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance + 20;
      Animated.parallel([
        Animated.sequence([
          Animated.delay(200 + i * 30),
          Animated.timing(c.opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.delay(800),
          Animated.timing(c.opacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(200 + i * 30),
          Animated.parallel([
            Animated.timing(c.x, {
              toValue: targetX,
              duration: 1400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(c.y, {
              toValue: targetY,
              duration: 1400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(c.rotate, {
              toValue: Math.random() > 0.5 ? 1 : -1,
              duration: 1400,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestions: {
    icon: FeatherIcon;
    tint: string;
    titleEs: string;
    titleEn: string;
    subEs: string;
    subEn: string;
    path: string;
    anim: Animated.Value;
  }[] = [
    {
      icon: 'calendar',
      tint: Colors.accentPrimary,
      titleEs: 'Descubre eventos',
      titleEn: 'Discover events',
      subEs: 'Mira qué pasa esta semana',
      subEn: "See what's on this week",
      path: '/(tabs)/events',
      anim: card1,
    },
    {
      icon: 'tag',
      tint: '#A855F7',
      titleEs: 'Revisa las ofertas',
      titleEn: 'Check offers',
      subEs: 'Promociones activas del día',
      subEn: "Today's active promotions",
      path: '/(app)/offers',
      anim: card2,
    },
    {
      icon: 'message-square',
      tint: Colors.accentSuccess,
      titleEs: 'Entra a la comunidad',
      titleEn: 'Join the community',
      subEs: 'Conecta con otros clientes',
      subEn: 'Connect with other guests',
      path: '/(tabs)/community',
      anim: card3,
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
        {/* Hero with celebration */}
        <View style={styles.hero}>
          {/* Confetti burst layer */}
          <View style={styles.confettiLayer} pointerEvents="none">
            {confetti.map((c, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.confettiDot,
                  {
                    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    opacity: c.opacity,
                    transform: [
                      { translateX: c.x },
                      { translateY: c.y },
                      {
                        rotate: c.rotate.interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: ['-360deg', '0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>

          {/* Ring + Core */}
          <Animated.View
            style={[
              styles.successRing,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.successCore,
                { transform: [{ scale: coreScale }] },
              ]}
            >
              <Feather name="check" size={42} color={Colors.textInverse} />
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslate }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.kicker}>{t ? 'Todo listo' : 'All set'}</Text>
            <Text style={styles.title}>
              {firstName
                ? t
                  ? `¡Bienvenido,\n${firstName}!`
                  : `Welcome,\n${firstName}!`
                : t
                  ? '¡Bienvenido!'
                  : 'Welcome!'}
            </Text>
            <Text style={styles.subtitle}>
              {t
                ? 'Tu cuenta en OPAL BAR está activa.\nTe regalamos 50 puntos para empezar.'
                : 'Your OPAL BAR account is active.\nWe gifted you 50 points to start.'}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.bonusChip,
              {
                opacity: bonusOpacity,
                transform: [{ translateY: bonusTranslate }],
              },
            ]}
          >
            <Feather name="gift" size={14} color={Colors.accentPrimary} />
            <Text style={styles.bonusText}>
              {t ? '+50 puntos de bienvenida' : '+50 welcome points'}
            </Text>
          </Animated.View>
        </View>

        <Text style={styles.sectionLabel}>
          {t ? 'Por dónde empezar' : 'Where to start'}
        </Text>

        <View style={styles.suggestionsCol}>
          {suggestions.map((s) => (
            <Animated.View
              key={s.path}
              style={{
                opacity: s.anim,
                transform: [
                  {
                    translateX: s.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              }}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.suggestionCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  fb.tap();
                  router.replace(s.path as never);
                }}
              >
                <View style={[styles.suggestionIcon, { backgroundColor: s.tint + '1F' }]}>
                  <Feather name={s.icon} size={20} color={s.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionTitle}>{t ? s.titleEs : s.titleEn}</Text>
                  <Text style={styles.suggestionSub}>{t ? s.subEs : s.subEn}</Text>
                </View>
                <Feather name="arrow-right" size={16} color={Colors.textMuted} />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => {
            fb.tap();
            router.replace('/(tabs)/home' as never);
          }}
        >
          <Text style={styles.primaryBtnLabel}>
            {t ? 'Entrar a OPAL BAR' : 'Enter OPAL BAR'}
          </Text>
          <Feather name="arrow-right" size={18} color={Colors.textInverse} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },

  stepRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
  },
  stepDotActive: { backgroundColor: Colors.accentPrimary },

  scroll: { paddingHorizontal: 24, paddingBottom: 20 },

  hero: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 32,
    position: 'relative',
  },
  confettiLayer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  confettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
  },

  successRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(56,199,147,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  successCore: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentSuccess,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: Colors.accentSuccess,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  bonusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(244,163,64,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,163,64,0.35)',
    marginTop: 18,
  },
  bonusText: { color: Colors.accentPrimary, fontSize: 12, fontWeight: '800' },

  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  suggestionsCol: { gap: 10 },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  suggestionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '800' },
});
