// ─────────────────────────────────────────────
//  Register — Editorial Premium
//
//  Layout: kicker + Display headline, then a stationery-feeling form
//  (Input primitives w/ uppercase labels). Phone uses the existing
//  PhonePicker (international). Legal copy is captioned, restrained.
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

import { authApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { setPendingPassword } from '@/lib/pending-credentials';
import { LEGAL_URLS, openLegal } from '@/lib/legal';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop } from '@/constants/a11y';
import { PhonePicker } from '@/components/PhonePicker';
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

export default function Register() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneIsValid, setPhoneIsValid] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passOk =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
  // El picker emite E.164 + flag de validez. Si está vacío es válido (es opcional).
  const phoneOk = phone.length === 0 || phoneIsValid;

  async function handleRegister() {
    setError(null);
    if (firstName.trim().length < 2) {
      setError(t ? 'Nombre muy corto.' : 'First name too short.');
      return;
    }
    if (lastName.trim().length < 2) {
      setError(t ? 'Apellido muy corto.' : 'Last name too short.');
      return;
    }
    const mail = email.trim().toLowerCase();
    if (!emailOk) {
      setError(t ? 'Email inválido.' : 'Invalid email.');
      return;
    }
    const cleanPhone = phone.trim();
    if (cleanPhone && !phoneOk) {
      setError(
        t
          ? 'Teléfono inválido. Usa formato internacional, ej. +525512345678.'
          : 'Invalid phone. Use international format, e.g. +525512345678.',
      );
      return;
    }
    if (!passOk) {
      setError(
        t
          ? 'Mínimo 8 chars, 1 mayúscula, 1 número y 1 símbolo.'
          : 'Min 8 chars, 1 uppercase, 1 number, 1 symbol.',
      );
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: mail,
        phone: cleanPhone || undefined,
        password,
        language,
      });
      // Backend auto-sends EMAIL_VERIFICATION OTP on register — no need to re-send here.
      // Password is parked in memory (never a route param) for the auto-login
      // that follows a successful verification.
      setPendingPassword(mail, password);
      fb.success();
      router.push({
        pathname: '/(auth)/otp-email',
        params: { email: mail, purpose: 'EMAIL_VERIFICATION' },
      } as never);
    } catch (err: any) {
      fb.error();
      setError(apiError(err, t ? 'No se pudo crear la cuenta.' : 'Could not create account.'));
    } finally {
      setLoading(false);
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FadeIn>
            <Kicker tone="champagne">{t ? 'BIENVENIDO' : 'WELCOME'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">{t ? 'Crea tu cuenta.' : 'Create your account.'}</Display>
          </FadeIn>
          <FadeIn delay={160} style={{ marginTop: Spacing[3], maxWidth: 320 }}>
            <Body tone="secondary">
              {t
                ? 'Empieza a descubrir todo lo que pasa esta noche.'
                : 'Start discovering everything happening tonight.'}
            </Body>
          </FadeIn>

          <View style={styles.form}>
            <FadeIn delay={240}>
              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t ? 'Nombre' : 'First name'}
                    placeholder={t ? 'Tu nombre' : 'Your first name'}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    autoComplete="name-given"
                    accessibilityLabel={t ? 'Nombre' : 'First name'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t ? 'Apellido' : 'Last name'}
                    placeholder={t ? 'Tu apellido' : 'Your last name'}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    autoComplete="name-family"
                    accessibilityLabel={t ? 'Apellido' : 'Last name'}
                  />
                </View>
              </View>
            </FadeIn>

            <FadeIn delay={310}>
              <Input
                label="Email"
                placeholder={t ? 'email@ejemplo.com' : 'email@example.com'}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                accessibilityLabel={t ? 'Correo electrónico' : 'Email'}
                leftIcon={<Feather name="mail" size={18} color={Colors.textMuted} />}
                helper={
                  t
                    ? 'Te enviaremos un código de 6 dígitos.'
                    : "We'll email you a 6-digit code."
                }
                error={
                  email && !emailOk
                    ? t
                      ? 'Email inválido.'
                      : 'Invalid email.'
                    : undefined
                }
              />
            </FadeIn>

            <FadeIn delay={380}>
              <View>
                <View style={styles.phoneLabel}>
                  <Caption tone="secondary" style={styles.phoneLabelText}>
                    {t ? 'TELÉFONO (OPCIONAL)' : 'PHONE (OPTIONAL)'}
                  </Caption>
                </View>
                <PhonePicker
                  value={phone}
                  onChange={(e164, valid) => {
                    setPhone(e164);
                    setPhoneIsValid(valid);
                  }}
                  placeholder={t ? 'Teléfono' : 'Phone'}
                  defaultCountry="MX"
                  isValid={phone.length > 0 && phoneOk}
                  hasError={phone.length > 0 && !phoneOk}
                />
              </View>
            </FadeIn>

            <FadeIn delay={450}>
              <Input
                label={t ? 'Contraseña' : 'Password'}
                placeholder={t ? 'Tu contraseña' : 'Your password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
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
                helper={
                  t
                    ? '8+ caracteres, mayúscula, número y símbolo.'
                    : '8+ chars, 1 uppercase, 1 number, 1 symbol.'
                }
                error={
                  password && !passOk
                    ? t
                      ? 'Contraseña aún no cumple los requisitos.'
                      : 'Password does not meet requirements yet.'
                    : undefined
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

            <FadeIn delay={520} style={{ marginTop: Spacing[2] }}>
              <Button
                label={t ? 'Crear cuenta' : 'Create account'}
                onPress={handleRegister}
                loading={loading}
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<Feather name="arrow-right" size={18} color={Colors.textInverse} />}
              />
            </FadeIn>

            {/* Apple 1.2 (UGC): los términos y la política deben ser
                accesibles y explícitamente aceptados al registrarse. */}
            <View style={styles.legalWrap}>
              <Caption tone="muted" align="center">
                {t ? 'Al crear tu cuenta aceptas los ' : 'By creating an account you accept the '}
              </Caption>
              <View style={styles.legalLinks}>
                <Pressy
                  onPress={() => openLegal(LEGAL_URLS.terms)}
                  accessibilityRole="link"
                  accessibilityLabel={t ? 'Términos de servicio' : 'Terms of service'}
                  hitSlop={HitSlop.expand}
                >
                  <Caption style={styles.legalLink}>
                    {t ? 'Términos de servicio' : 'Terms of service'}
                  </Caption>
                </Pressy>
                <Caption tone="muted">{t ? '  ·  ' : '  ·  '}</Caption>
                <Pressy
                  onPress={() => openLegal(LEGAL_URLS.privacy)}
                  accessibilityRole="link"
                  accessibilityLabel={t ? 'Política de privacidad' : 'Privacy policy'}
                  hitSlop={HitSlop.expand}
                >
                  <Caption style={styles.legalLink}>
                    {t ? 'Política de privacidad' : 'Privacy policy'}
                  </Caption>
                </Pressy>
              </View>
              <Caption tone="muted" align="center" style={{ marginTop: Spacing[2] }}>
                {t
                  ? 'No toleramos contenido ofensivo ni abusivo: puedes reportar o bloquear a cualquier usuario desde su perfil.'
                  : 'We have zero tolerance for objectionable content: you can report or block any user from their profile.'}
              </Caption>
            </View>

            <View style={styles.loginRow}>
              <Body size="sm" tone="secondary">
                {t ? '¿Ya tienes cuenta? ' : 'Already have an account? '}
              </Body>
              <Pressy
                onPress={() => router.replace('/(auth)/login' as never)}
                accessibilityRole="link"
                accessibilityLabel={t ? 'Inicia sesión' : 'Sign in'}
              >
                <Body size="sm" tone="accent" weight="semiBold">
                  {t ? 'Inicia sesión' : 'Sign in'}
                </Body>
              </Pressy>
            </View>
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
    paddingTop: Spacing[6],
    paddingBottom: Spacing[10],
  },
  form: {
    marginTop: Spacing[8],
    gap: Spacing[4],
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  phoneLabel: {
    marginBottom: Spacing[2],
  },
  phoneLabelText: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  legalWrap: {
    marginTop: Spacing[2],
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing[1],
  },
  legalLink: {
    color: Colors.accentPrimary,
    textDecorationLine: 'underline',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing[6],
  },
});
