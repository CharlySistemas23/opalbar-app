// ─────────────────────────────────────────────
//  MembershipCard — OPALBAR · AMEX Centurion-class
//
//  Frente: minimalista. Solo OPALBAR / TIER MEMBER / nombre. Nada más.
//  Tap → flip 180° rotateY → reverso con número, QR, puntos, vigencia.
//
//  Material: gradient metálico SVG (tier-tinted). Edge glint top hairline.
//  Sin sombras drop. Borde sutil. Sensación de "Apple Wallet pass".
//
//  Sizes:
//   · hero (250pt) — Home, sin onPress permite flip
//   · md (160pt) — Profile, onPress navega a detalle
//   · sm (60pt strip) — Headers, solo info compacta
//
//  No usa expo-linear-gradient (native dep) — usa react-native-svg
//  para mantener OTA eligibility.
// ─────────────────────────────────────────────
import { useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';

import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { Roles } from '@/constants/a11y';
import { useAppStore } from '@/stores/app.store';
import { Pressy } from '@/components/ui/Pressy';
import { TierVisual, resolveTier } from '@/constants/tiers';

export type MembershipSize = 'hero' | 'md' | 'sm';

interface Props {
  fullName: string;
  memberNumber?: string | number;
  tierName?: string;
  points: number;
  validThrough?: string;
  size?: MembershipSize;
  /** When provided, the card calls this instead of flipping (md/sm only). */
  onPress?: () => void;
  /** When true, the hero card supports tap-to-flip. Default true on hero size. */
  flippable?: boolean;
  testID?: string;
}

export function MembershipCard({
  fullName,
  memberNumber,
  tierName,
  points,
  validThrough,
  size = 'hero',
  onPress,
  flippable,
  testID,
}: Props) {
  const { language } = useAppStore();
  const t = language === 'es';
  const tier = resolveTier(tierName);

  const allowFlip = flippable ?? (size === 'hero' && !onPress);
  const flipped = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (!allowFlip) return;
    const next = isFlipped ? 0 : 1;
    flipped.value = withTiming(next, {
      duration: 600,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    setIsFlipped(!isFlipped);
    AccessibilityInfo.announceForAccessibility(
      isFlipped ? (t ? 'Frente de la tarjeta' : 'Card front') : (t ? 'Reverso de la tarjeta' : 'Card back'),
    );
  };

  if (size === 'sm') {
    return (
      <CardStrip
        tier={tier}
        fullName={fullName}
        points={points}
        language={language}
        t={t}
        onPress={onPress}
        testID={testID}
      />
    );
  }

  const heroHeight = size === 'hero' ? 230 : 170;

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipped.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: interpolate(flipped.value, [0, 0.5, 0.5001], [1, 1, 0]),
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipped.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: interpolate(flipped.value, [0, 0.4999, 0.5], [0, 0, 1]),
  }));

  const accLabel = `${tier.labelEs} member, ${fullName}, ${points.toLocaleString(language)} puntos`;

  return (
    <Pressy
      onPress={handlePress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={accLabel}
      accessibilityHint={
        allowFlip
          ? t
            ? 'Toca para ver el reverso'
            : 'Tap to flip card'
          : undefined
      }
      style={[styles.wrapper, { height: heroHeight }]}
      testID={testID}
    >
      <Animated.View style={[styles.faceAbs, frontStyle]}>
        <CardFront tier={tier} fullName={fullName} size={size} t={t} />
      </Animated.View>
      <Animated.View style={[styles.faceAbs, backStyle]}>
        <CardBack
          tier={tier}
          memberNumber={memberNumber}
          points={points}
          validThrough={validThrough}
          size={size}
          language={language}
          t={t}
        />
      </Animated.View>
    </Pressy>
  );
}

// ── Front face: minimalist ──────────────────
function CardFront({
  tier,
  fullName,
  size,
  t,
}: {
  tier: TierVisual;
  fullName: string;
  size: MembershipSize;
  t: boolean;
}) {
  const tierUpper = (tier.labelEn ?? '').toUpperCase();
  const memberLabel = t ? 'MIEMBRO' : 'MEMBER';
  const isHero = size === 'hero';

  return (
    <View style={styles.face}>
      <MetallicBg tier={tier} />
      <View style={styles.faceContent}>
        {/* Top: wordmark + tier */}
        <View style={styles.frontTop}>
          <Text style={[TypePresets.label, { color: tier.text, letterSpacing: 4 }]}>
            OPALBAR
          </Text>
        </View>

        {/* Center: TIER MEMBER + Name */}
        <View style={styles.frontCenter}>
          <Text
            style={[
              TypePresets.label,
              { color: tier.base, letterSpacing: 3, marginBottom: Spacing[3] },
            ]}
          >
            {memberLabel} {tierUpper}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              isHero ? TypePresets.heading : TypePresets.headingSm,
              { color: tier.text },
            ]}
          >
            {fullName}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Back face: number + QR + points + valid ──
function CardBack({
  tier,
  memberNumber,
  points,
  validThrough,
  size,
  language,
  t,
}: {
  tier: TierVisual;
  memberNumber?: string | number;
  points: number;
  validThrough?: string;
  size: MembershipSize;
  language: string;
  t: boolean;
}) {
  const isHero = size === 'hero';
  const qrSize = isHero ? 84 : 64;
  const numberLabel = memberNumber
    ? `Nº ${String(memberNumber).padStart(4, '0')}`
    : 'Nº ----';
  const qrValue = `OPALBAR:MEMBER:${memberNumber ?? '0000'}`;

  return (
    <View style={styles.face}>
      <MetallicBg tier={tier} />
      <View style={styles.faceContent}>
        <View style={styles.backRow}>
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <View>
              <Text style={[TypePresets.label, { color: tier.textMuted, letterSpacing: 2 }]}>
                {t ? 'NÚMERO' : 'NUMBER'}
              </Text>
              <Text
                style={[
                  TypePresets.bodyLg,
                  { color: tier.text, marginTop: 2, fontFamily: TypePresets.subhead.fontFamily },
                ]}
              >
                {numberLabel}
              </Text>
            </View>
            <View>
              <Text style={[TypePresets.label, { color: tier.textMuted, letterSpacing: 2 }]}>
                {t ? 'PUNTOS' : 'POINTS'}
              </Text>
              <Text
                style={[
                  isHero ? TypePresets.heading : TypePresets.headingSm,
                  { color: tier.base, marginTop: 2 },
                ]}
              >
                {points.toLocaleString(language)}
              </Text>
            </View>
            {validThrough ? (
              <View>
                <Text style={[TypePresets.label, { color: tier.textMuted, letterSpacing: 2 }]}>
                  {t ? 'VIGENTE' : 'VALID'}
                </Text>
                <Text style={[TypePresets.body, { color: tier.text, marginTop: 2 }]}>
                  {validThrough}
                </Text>
              </View>
            ) : null}
          </View>

          {/* QR */}
          <View style={[styles.qrFrame, { borderColor: tier.edgeGlint }]}>
            <QRCode
              value={qrValue}
              size={qrSize}
              backgroundColor={tier.cardGlint}
              color={tier.text}
              ecl="M"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Compact strip (size='sm') ────────────────
function CardStrip({
  tier,
  fullName,
  points,
  language,
  t,
  onPress,
  testID,
}: {
  tier: TierVisual;
  fullName: string;
  points: number;
  language: string;
  t: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const tierUpper = (tier.labelEn ?? '').toUpperCase();
  const accLabel = `${tier.labelEs} member, ${points.toLocaleString(language)} puntos`;

  const Inner = (
    <View style={[styles.face, { height: 60 }]}>
      <MetallicBg tier={tier} />
      <View style={[styles.faceContent, styles.stripRow]}>
        <View>
          <Text style={[TypePresets.label, { color: tier.base, letterSpacing: 2.5 }]}>
            {tierUpper}
          </Text>
          <Text
            numberOfLines={1}
            style={[TypePresets.body, { color: tier.text, marginTop: 1 }]}
          >
            {fullName}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[TypePresets.headingSm, { color: tier.base }]}>
            {points.toLocaleString(language)}
          </Text>
          <Text style={[TypePresets.label, { color: tier.textMuted, marginTop: 1 }]}>
            {t ? 'PTS' : 'PTS'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressy
        onPress={onPress}
        haptic="select"
        accessibilityRole={Roles.button}
        accessibilityLabel={accLabel}
        testID={testID}
      >
        {Inner}
      </Pressy>
    );
  }
  return (
    <View
      accessibilityRole={Roles.summary}
      accessibilityLabel={accLabel}
      testID={testID}
    >
      {Inner}
    </View>
  );
}

// ── Metallic SVG background ──────────────────
//
// 3-stop linear gradient at 135° simulates a metallic surface catching light
// from upper-left. The "glint" stop sits ~25% to fake reflectivity. Each tier
// has its own three tones (cardBg → cardMid → cardGlint).
function MetallicBg({ tier }: { tier: TierVisual }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`grad-${tier.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={tier.cardBg} />
            <Stop offset="40%" stopColor={tier.cardMid} />
            <Stop offset="55%" stopColor={tier.cardGlint} />
            <Stop offset="100%" stopColor={tier.cardBg} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#grad-${tier.key})`} />
      </Svg>
      {/* Top edge glint hairline */}
      <View
        style={[styles.edgeGlint, { backgroundColor: tier.edgeGlint }]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  faceAbs: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
  },
  face: {
    flex: 1,
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  faceContent: {
    flex: 1,
    padding: Spacing[5],
    justifyContent: 'space-between',
  },
  edgeGlint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  frontTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  frontCenter: {
    marginBottom: Spacing[2],
  },
  backRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing[4],
  },
  qrFrame: {
    padding: Spacing[2],
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-end',
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
