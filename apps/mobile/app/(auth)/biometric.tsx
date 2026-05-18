// ─────────────────────────────────────────────
//  Biometric — Editorial Premium
//
//  Three states wrapped in one screen: probing (loader), unavailable /
//  not-enrolled (warning), ready (success). All states share the editorial
//  scaffold: kicker, Display headline, lead, primary + secondary buttons.
//  Lógica intacta (mismo hook, mismas rutas) — sólo el layer visual cambia.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAppStore } from '@/stores/app.store';
import { authenticate, getBiometricState, type BiometricState } from '@/lib/biometric';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop } from '@/constants/a11y';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Kicker,
  Lead,
} from '@/components/ui';

export default function Biometric() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [state, setState] = useState<BiometricState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBiometricState().then(setState);
  }, []);

  async function handleUse() {
    setLoading(true);
    const ok = await authenticate(
      t ? 'Confirma tu identidad para entrar' : 'Confirm your identity to sign in',
    );
    setLoading(false);
    if (ok) {
      router.replace('/(tabs)/home' as never);
    }
  }

  function goPasswordLogin() {
    router.replace('/(auth)/login' as never);
  }

  // Header shared across all states
  const Header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={HitSlop.expand}
        accessibilityRole="button"
        accessibilityLabel={t ? 'Volver' : 'Back'}
        style={styles.backBtn}
      >
        <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
      </Pressable>
    </View>
  );

  // ── Probing ────────────────────────────────
  if (!state) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {Header}
        <View style={styles.center}>
          <FadeIn>
            <ActivityIndicator color={Colors.accentPrimary} />
          </FadeIn>
          <FadeIn delay={180} style={{ marginTop: Spacing[6] }}>
            <Kicker tone="champagne" align="center">
              {t ? 'VERIFICANDO DISPOSITIVO' : 'CHECKING DEVICE'}
            </Kicker>
          </FadeIn>
          <FadeIn delay={260} style={{ marginTop: Spacing[3], maxWidth: 320 }}>
            <Lead tone="secondary" align="center">
              {t
                ? 'Comprobando si tu dispositivo soporta biometría…'
                : 'Checking if your device supports biometrics…'}
            </Lead>
          </FadeIn>
        </View>
      </SafeAreaView>
    );
  }

  // ── Unavailable / not enrolled ─────────────
  if (!state.available || !state.enrolled) {
    const kicker = state.available
      ? t
        ? 'BIOMETRÍA NO CONFIGURADA'
        : 'NO BIOMETRICS ENROLLED'
      : t
        ? 'BIOMETRÍA NO DISPONIBLE'
        : 'BIOMETRICS UNAVAILABLE';

    const title = state.available
      ? t
        ? 'Sin biometría\nconfigurada.'
        : 'No biometrics\nenrolled.'
      : t
        ? 'Tu dispositivo no\nsoporta biometría.'
        : "Your device doesn't\nsupport biometrics.";

    const message = state.available
      ? t
        ? 'No tienes huellas ni Face ID registrados. Configúralos desde los ajustes del sistema o entra con tu contraseña.'
        : 'No fingerprints or Face ID enrolled yet. Set them up in system settings, or use your password.'
      : t
        ? 'Inicia sesión con tu contraseña — funciona igual de bien.'
        : 'Sign in with your password — works just as well.';

    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {Header}
        <View style={styles.scroll}>
          <FadeIn>
            <Kicker tone="champagne">{kicker}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">{title}</Display>
          </FadeIn>
          <FadeIn delay={180} style={{ marginTop: Spacing[4], maxWidth: 360 }}>
            <Lead tone="secondary">{message}</Lead>
          </FadeIn>

          <View style={styles.footer}>
            <Hairline />
            <FadeIn delay={260} style={{ marginTop: Spacing[6] }}>
              <Button
                label={t ? 'Iniciar sesión' : 'Sign in'}
                onPress={goPasswordLogin}
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<Feather name="arrow-right" size={18} color={Colors.textInverse} />}
              />
            </FadeIn>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Ready ──────────────────────────────────
  const kicker =
    state.kind === 'face'
      ? t
        ? 'ENTRADA RÁPIDA'
        : 'QUICK ENTRY'
      : t
        ? 'ENTRADA RÁPIDA'
        : 'QUICK ENTRY';

  const title =
    state.kind === 'face'
      ? t
        ? 'Entra con\nFace ID.'
        : 'Sign in with\nFace ID.'
      : state.kind === 'fingerprint'
        ? t
          ? 'Entra con\nhuella.'
          : 'Sign in with\nfingerprint.'
        : t
          ? 'Entra con\nbiometría.'
          : 'Sign in with\nbiometrics.';

  const primaryLabel =
    state.kind === 'face'
      ? t
        ? 'Usar Face ID'
        : 'Use Face ID'
      : state.kind === 'fingerprint'
        ? t
          ? 'Usar huella digital'
          : 'Use fingerprint'
        : t
          ? 'Usar biometría'
          : 'Use biometrics';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {Header}
      <View style={styles.scroll}>
        <FadeIn>
          <Kicker tone="champagne">{kicker}</Kicker>
        </FadeIn>
        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Display size="md">{title}</Display>
        </FadeIn>
        <FadeIn delay={180} style={{ marginTop: Spacing[4], maxWidth: 360 }}>
          <Lead tone="secondary">
            {t
              ? 'Rápido, seguro, sin escribir nada. Tus datos biométricos nunca salen del dispositivo.'
              : 'Fast, secure, no typing required. Your biometric data never leaves the device.'}
          </Lead>
        </FadeIn>

        <FadeIn delay={280} style={styles.hintBlock}>
          <Body size="sm" tone="muted">
            {t
              ? 'Si prefieres tu contraseña, sigue funcionando.'
              : "If you prefer your password, it still works."}
          </Body>
        </FadeIn>

        <View style={styles.footer}>
          <Hairline />
          <FadeIn delay={360} style={{ marginTop: Spacing[6] }}>
            <Button
              label={primaryLabel}
              onPress={handleUse}
              loading={loading}
              variant="primary"
              size="lg"
              fullWidth
              accessibilityHint={t ? 'Abre el lector biométrico' : 'Opens the biometric reader'}
            />
          </FadeIn>
          <FadeIn delay={430} style={{ marginTop: Spacing[3] }}>
            <Button
              label={t ? 'Usar contraseña' : 'Use password'}
              onPress={goPasswordLogin}
              variant="ghost"
              size="lg"
              fullWidth
            />
          </FadeIn>
          <FadeIn delay={500} style={{ marginTop: Spacing[4] }}>
            <Caption tone="muted" align="center">
              {t
                ? 'Cifrado en el chip seguro de tu dispositivo.'
                : 'Encrypted on your device’s secure enclave.'}
            </Caption>
          </FadeIn>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[2] },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },
  scroll: {
    flex: 1,
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[8],
    paddingBottom: Spacing[8],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  hintBlock: {
    marginTop: Spacing[6],
  },
  footer: {
    marginTop: 'auto',
  },
});
