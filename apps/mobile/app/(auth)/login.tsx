// ─────────────────────────────────────────────
//  Login — Editorial Premium
//
//  Layout: kicker + Display headline, then form. No hero icon (we own
//  identity from welcome.tsx — reentry doesn't need to re-pitch the
//  brand). Inputs are <Input> primitives with editorial label-on-top.
// ─────────────────────────────────────────────
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop } from '@/constants/a11y';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { useFeedback } from '@/hooks/useFeedback';
import { getDeviceMeta } from '@/lib/device';
import { setPendingPassword } from '@/lib/pending-credentials';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Input,
  Kicker,
  Pressy,
} from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError(t ? 'Introduce un email válido.' : 'Enter a valid email.');
      return;
    }
    if (!password) {
      setError(t ? 'Introduce tu contraseña.' : 'Enter your password.');
      return;
    }
    try {
      await login({ email: mail, password, ...getDeviceMeta() });
      fb.success();
      router.replace('/(tabs)/home' as never);
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        // Account exists but never verified. Backend already re-sent the
        // OTP. Park the password in memory (never in route params) so the
        // OTP screen can auto-login after verification.
        const identifier: string = err.identifier || mail;
        setPendingPassword(identifier, password);
        const isPhone = !identifier.includes('@');
        router.push({
          pathname: isPhone ? '/(auth)/otp-phone' : '/(auth)/otp-email',
          params: isPhone
            ? { phone: identifier, purpose: 'PHONE_VERIFICATION' }
            : { email: identifier, purpose: 'EMAIL_VERIFICATION' },
        } as never);
        return;
      }
      if (err?.response?.status === 429) {
        const retryAfter = err.response.headers?.['retry-after'] ?? '300';
        router.replace({
          pathname: '/(auth)/too-many-attempts',
          params: { retryAfter: String(retryAfter) },
        } as never);
        return;
      }
      fb.error();
      setError(apiError(err, t ? 'Correo o contraseña incorrectos.' : 'Invalid email or password.'));
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn>
            <Kicker tone="champagne">{t ? 'BIENVENIDO DE VUELTA' : 'WELCOME BACK'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">{t ? 'Inicia sesión.' : 'Sign in.'}</Display>
          </FadeIn>

          <View style={styles.form}>
            <FadeIn delay={180}>
              <Input
                label={t ? 'Email' : 'Email'}
                placeholder={t ? 'email@ejemplo.com' : 'email@example.com'}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                accessibilityLabel={t ? 'Correo electrónico' : 'Email'}
                leftIcon={<Feather name="mail" size={18} color={Colors.textMuted} />}
              />
            </FadeIn>

            <FadeIn delay={250}>
              <Input
                label={t ? 'Contraseña' : 'Password'}
                placeholder={t ? 'Tu contraseña' : 'Your password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                accessibilityLabel={t ? 'Contraseña' : 'Password'}
                leftIcon={<Feather name="lock" size={18} color={Colors.textMuted} />}
                rightIcon={
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color={Colors.textMuted}
                  />
                }
                onRightIconPress={() => setShowPassword((v) => !v)}
                rightIconLabel={
                  showPassword
                    ? t
                      ? 'Ocultar contraseña'
                      : 'Hide password'
                    : t
                      ? 'Mostrar contraseña'
                      : 'Show password'
                }
              />
            </FadeIn>

            {error ? (
              <FadeIn>
                <Caption tone="danger" align="center">
                  {error}
                </Caption>
              </FadeIn>
            ) : null}

            <Pressy
              onPress={() => router.push('/(auth)/forgot-password' as never)}
              accessibilityRole="link"
              accessibilityLabel={t ? '¿Olvidaste tu contraseña?' : 'Forgot password?'}
              haptic="select"
              style={styles.forgotWrap}
            >
              <Caption tone="accent">
                {t ? '¿Olvidaste tu contraseña?' : 'Forgot your password?'}
              </Caption>
            </Pressy>

            <FadeIn delay={320}>
              <Button
                label={t ? 'Entrar' : 'Sign in'}
                onPress={handleLogin}
                loading={isLoading}
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<Feather name="arrow-right" size={18} color={Colors.textInverse} />}
              />
            </FadeIn>
          </View>

          <View style={styles.signupRow}>
            <Body size="sm" tone="secondary">
              {t ? '¿No tienes cuenta? ' : "Don't have an account? "}
            </Body>
            <Pressy
              onPress={() => router.replace('/(auth)/register' as never)}
              accessibilityRole="link"
              accessibilityLabel={t ? 'Regístrate' : 'Sign up'}
            >
              <Body size="sm" tone="accent" weight="semiBold">
                {t ? 'Regístrate' : 'Sign up'}
              </Body>
            </Pressy>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[8],
    paddingBottom: Spacing[8],
  },
  form: {
    marginTop: Spacing[8],
    gap: Spacing[4],
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing[1],
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing[6],
  },
});
