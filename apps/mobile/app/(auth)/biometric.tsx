// ─────────────────────────────────────────────
//  Biometric lock — Editorial Premium
//
//  Full-screen app-lock rendered by the root layout (BiometricGate) as an
//  overlay while `useBiometricLockState().locked` is true. The user is
//  already signed in; this screen only proves device ownership via
//  Face ID / Touch ID / fingerprint (device passcode as system fallback).
//
//  States
//   · probing      — hardware check in flight (skeleton)
//   · ready        — auto-prompts once on mount, "Desbloquear" retries
//   · unavailable  — hardware / enrollment gone → lock disables itself
//
//  Also mounted as a route (/(auth)/biometric) for safety; in that case a
//  successful unlock navigates home instead of just dropping the overlay.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  authenticate,
  getBiometricState,
  setBiometricLock,
  unlockNow,
  useBiometricLockState,
  type BiometricState,
} from '@/lib/biometric';
import { toast } from '@/components/Toast';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Heading,
  Kicker,
  Lead,
  Skeleton,
} from '@/components/ui';

type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_BY_KIND: Record<BiometricState['kind'], MciName> = {
  face: 'face-recognition',
  fingerprint: 'fingerprint',
  iris: 'eye-outline',
  generic: 'shield-lock-outline',
  none: 'shield-lock-outline',
};

interface Props {
  /** True when rendered by the root gate (overlay), false when a route. */
  overlay?: boolean;
}

export default function BiometricLock({ overlay = false }: Props) {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();
  const logout = useAuthStore((s) => s.logout);
  const wasLocked = useRef(useBiometricLockState.getState().locked);

  const [state, setState] = useState<BiometricState | null>(null);
  const [authing, setAuthing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const autoPrompted = useRef(false);

  const finishUnlock = useCallback(() => {
    fb.success();
    unlockNow();
    if (!overlay && !wasLocked.current) {
      router.replace('/(tabs)/home' as never);
    }
  }, [fb, overlay, router]);

  const tryUnlock = useCallback(async () => {
    if (authing) return;
    setAuthing(true);
    setFailed(false);
    const ok = await authenticate(
      t ? 'Desbloquea OPALBAR' : 'Unlock OPALBAR',
    );
    setAuthing(false);
    if (ok) {
      finishUnlock();
    } else {
      fb.error();
      setFailed(true);
    }
  }, [authing, t, finishUnlock, fb]);

  // Probe hardware. If biometrics vanished (enrollment removed) the lock
  // cannot be satisfied → disable the feature and let the user through.
  useEffect(() => {
    let alive = true;
    getBiometricState().then((s) => {
      if (!alive) return;
      setState(s);
      if (!s.available || !s.enrolled) {
        setBiometricLock(false);
        toast(
          t
            ? 'Bloqueo biométrico desactivado: tu dispositivo ya no tiene biometría configurada.'
            : 'Biometric lock disabled: your device no longer has biometrics set up.',
          'info',
        );
        unlockNow();
        if (!overlay) router.replace('/(tabs)/home' as never);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-prompt once as soon as we know biometrics are usable.
  useEffect(() => {
    if (!state || !state.available || !state.enrolled || autoPrompted.current) return;
    autoPrompted.current = true;
    const id = setTimeout(() => {
      tryUnlock();
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      unlockNow();
      setLoggingOut(false);
      router.replace('/(auth)/welcome' as never);
    }
  }

  const kind = state?.kind ?? 'generic';
  const usable = !!state && state.available && state.enrolled;

  const unlockLabel =
    kind === 'face'
      ? t
        ? 'Desbloquear con Face ID'
        : 'Unlock with Face ID'
      : kind === 'fingerprint'
        ? t
          ? 'Desbloquear con huella'
          : 'Unlock with fingerprint'
        : t
          ? 'Desbloquear'
          : 'Unlock';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <FadeIn>
            <View style={styles.brandMark} accessibilityIgnoresInvertColors>
              <Heading
                size="lg"
                tone="accent"
                style={{ lineHeight: 28 }}
                accessibilityElementsHidden
              >
                O
              </Heading>
            </View>
          </FadeIn>

          <FadeIn delay={120}>
            <Kicker align="center" tone="accent" style={{ opacity: 0.9 }}>
              {t ? 'OPALBAR · BLOQUEADO' : 'OPALBAR · LOCKED'}
            </Kicker>
          </FadeIn>

          <FadeIn delay={200}>
            <Display size="lg" align="center">
              {t ? 'Desbloquea\npara continuar.' : 'Unlock to\ncontinue.'}
            </Display>
          </FadeIn>

          <FadeIn delay={300}>
            <Lead tone="secondary" align="center" style={styles.lead}>
              {t
                ? 'Tu sesión sigue activa. Confirma que eres tú para abrir la app.'
                : 'Your session is still active. Confirm it is you to open the app.'}
            </Lead>
          </FadeIn>

          <FadeIn delay={380} style={styles.iconWrap}>
            {state ? (
              <View
                style={[styles.iconChip, failed && styles.iconChipFailed]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <MaterialCommunityIcons
                  name={ICON_BY_KIND[kind]}
                  size={40}
                  color={failed ? Colors.accentDanger : Colors.accentPrimary}
                />
              </View>
            ) : (
              <Skeleton width={88} height={88} radius={Radius.xl} />
            )}
          </FadeIn>

          {failed ? (
            <FadeIn>
              <Caption tone="danger" align="center">
                {t
                  ? 'No pudimos verificar tu identidad. Inténtalo de nuevo.'
                  : 'We could not verify your identity. Try again.'}
              </Caption>
            </FadeIn>
          ) : null}
        </View>

        <View style={styles.actions}>
          <FadeIn delay={460}>
            <Button
              label={unlockLabel}
              onPress={tryUnlock}
              loading={authing || !state}
              disabled={!usable}
              variant="primary"
              size="lg"
              fullWidth
              accessibilityHint={t ? 'Abre el lector biométrico' : 'Opens the biometric reader'}
            />
          </FadeIn>
          <FadeIn delay={520}>
            <Button
              label={t ? 'Cerrar sesión' : 'Sign out'}
              onPress={handleLogout}
              loading={loggingOut}
              variant="ghost"
              size="lg"
              fullWidth
            />
          </FadeIn>
          <FadeIn delay={580}>
            <Body size="sm" tone="muted" align="center">
              {t
                ? 'Tus datos biométricos nunca salen del dispositivo.'
                : 'Your biometric data never leaves the device.'}
            </Body>
          </FadeIn>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: 60,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,241,231,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lead: {
    maxWidth: 320,
  },
  iconWrap: {
    marginTop: Spacing[6],
    alignItems: 'center',
  },
  iconChip: {
    width: 88,
    height: 88,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipFailed: {
    borderColor: 'rgba(196,104,104,0.45)',
  },
  actions: {
    gap: Spacing[3],
  },
});
