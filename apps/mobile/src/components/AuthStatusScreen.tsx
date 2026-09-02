// ─────────────────────────────────────────────
//  AuthStatusScreen — Editorial Premium
//
//  Shared shell for status / outcome screens in the auth flow
//  (email-sent, registration-complete, session-expired, too-many-attempts).
//
//  Replaces the legacy decorative-bubble layout with the editorial canonical:
//   · SafeAreaView edges ['top','bottom'] fill bgPrimary
//   · 40x40 back button (Feather arrow-left, paddingX 16 paddingY 12)
//   · Hero: Kicker accent overline + Display headline + Lead body, padX 24
//   · Optional bgCard "hint" note bound by hairline border
//   · Bottom CTAs: Button primary gold (variant chosen by `variant`),
//     optional secondary ghost
//
//  Variant only tints the kicker/icon — the headline stays parchment so the
//  composition reads as one editorial system across all 4 consumer screens.
// ─────────────────────────────────────────────
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop } from '@/constants/a11y';
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
type Variant = 'success' | 'danger' | 'warning' | 'info';

const VARIANT_TONE: Record<Variant, 'success' | 'danger' | 'warning' | 'accent'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'accent',
};

const VARIANT_KICKER_TONE: Record<Variant, 'champagne' | 'danger' | 'warning' | 'accent'> = {
  success: 'champagne',
  danger: 'danger',
  warning: 'warning',
  info: 'champagne',
};

interface Props {
  icon: FeatherIcon;
  /** Short caps overline above the headline (e.g. "CORREO ENVIADO"). */
  kicker?: string;
  variant?: Variant;
  title: string;
  message: string;
  /** Optional restrained body note shown in a bgCard hairline pill. */
  hint?: string;
  primary?: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean };
  secondary?: { label: string; onPress: () => void };
  onBack?: () => void;
}

export function AuthStatusScreen({
  icon,
  kicker,
  variant = 'info',
  title,
  message,
  hint,
  primary,
  secondary,
  onBack,
}: Props) {
  const iconTone = VARIANT_TONE[variant];
  const kickerTone = VARIANT_KICKER_TONE[variant];
  const iconColor =
    iconTone === 'success'
      ? Colors.accentSuccess
      : iconTone === 'danger'
        ? Colors.accentDanger
        : iconTone === 'warning'
          ? Colors.accentWarning
          : Colors.accentPrimary;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {onBack && (
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={HitSlop.expand}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressable>
        </View>
      )}

      <View style={styles.body}>
        <FadeIn>
          <View
            style={[styles.iconChip, { borderColor: iconColor + '55' }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Feather name={icon} size={20} color={iconColor} />
          </View>
        </FadeIn>

        {kicker ? (
          <FadeIn delay={120} style={{ marginTop: Spacing[5] }}>
            <Kicker tone={kickerTone}>{kicker}</Kicker>
          </FadeIn>
        ) : null}

        <FadeIn delay={180} style={{ marginTop: kicker ? Spacing[3] : Spacing[5] }}>
          <Display size="md">{title}</Display>
        </FadeIn>

        <FadeIn delay={260} style={styles.messageWrap}>
          <Lead tone="secondary">{message}</Lead>
        </FadeIn>

        {hint ? (
          <FadeIn delay={340} style={styles.hintCard}>
            <View style={styles.hintIcon}>
              <Feather name="info" size={14} color={Colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Caption tone="muted">{hint}</Caption>
            </View>
          </FadeIn>
        ) : null}
      </View>

      <View style={styles.footer}>
        {primary ? (
          <FadeIn delay={420}>
            <Button
              label={primary.label}
              onPress={primary.onPress}
              loading={primary.loading}
              disabled={primary.disabled}
              variant="primary"
              size="lg"
              fullWidth
            />
          </FadeIn>
        ) : null}
        {secondary ? (
          <FadeIn delay={480}>
            <Button
              label={secondary.label}
              onPress={secondary.onPress}
              variant="ghost"
              size="lg"
              fullWidth
            />
          </FadeIn>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageWrap: {
    marginTop: Spacing[4],
    maxWidth: 360,
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
  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[4],
    paddingTop: Spacing[2],
    gap: Spacing[3],
  },
});
