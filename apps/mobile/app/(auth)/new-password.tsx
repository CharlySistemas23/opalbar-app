// ─────────────────────────────────────────────
//  New Password — Editorial Premium
//
//  Reset flow final step. Kicker + Display title, two password inputs,
//  inline rule line. Single eye toggle covers both fields. Success
//  emits a toast and redirects to login.
// ─────────────────────────────────────────────
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { toast } from '@/components/Toast';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { authApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop } from '@/constants/a11y';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Input,
  Kicker,
  Lead,
} from '@/components/ui';

/** Same policy the API enforces on /auth/reset-password and /auth/register. */
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

export default function NewPassword() {
  const router = useRouter();
  const { email, code } = useLocalSearchParams<{ email: string; code: string }>();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors the backend policy (auth DTO): 8–64 chars, 1 uppercase,
  // 1 digit, 1 symbol (anything non-alphanumeric).
  const rules = useMemo(
    () => [
      { key: 'len', ok: password.length >= 8 && password.length <= 64, es: '8 a 64 caracteres', en: '8 to 64 characters' },
      { key: 'upper', ok: /[A-Z]/.test(password), es: 'Una mayúscula', en: 'One uppercase letter' },
      { key: 'digit', ok: /\d/.test(password), es: 'Un número', en: 'One number' },
      { key: 'symbol', ok: /[^A-Za-z0-9]/.test(password), es: 'Un símbolo', en: 'One symbol' },
    ],
    [password],
  );
  const passOk = PASSWORD_RE.test(password);
  const matchOk = confirm.length > 0 && confirm === password;
  const missingParams = !email || !code;

  async function handleReset() {
    if (loading) return;
    setError(null);
    if (missingParams) {
      setError(
        t
          ? 'Este enlace ya no es válido. Solicita un nuevo código.'
          : 'This link is no longer valid. Request a new code.',
      );
      return;
    }
    if (!passOk) {
      setError(
        t
          ? 'La contraseña aún no cumple todos los requisitos.'
          : 'The password does not meet all requirements yet.',
      );
      return;
    }
    if (password !== confirm) {
      setError(t ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({
        identifier: email,
        otpCode: code,
        newPassword: password,
      });
      fb.success();
      toast(
        t ? 'Contraseña actualizada. Inicia sesión.' : 'Password updated. Please sign in.',
        'success',
      );
      router.replace('/(auth)/login' as never);
    } catch (err: any) {
      fb.error();
      setError(
        apiError(err, t ? 'No pudimos actualizar la contraseña.' : 'Could not update the password.'),
      );
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn>
            <Kicker tone="champagne">{t ? 'NUEVA CONTRASEÑA' : 'NEW PASSWORD'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">
              {t ? 'Elige una\ncontraseña.' : 'Choose a\npassword.'}
            </Display>
          </FadeIn>
          <FadeIn delay={180} style={{ marginTop: Spacing[4], maxWidth: 340 }}>
            <Lead tone="secondary">
              {t
                ? 'Que sea memorable para ti y un misterio para los demás.'
                : 'Memorable to you, a mystery to everyone else.'}
            </Lead>
          </FadeIn>

          <View style={styles.form}>
            <FadeIn delay={260}>
              <Input
                label={t ? 'Nueva contraseña' : 'New password'}
                placeholder={t ? 'Mínimo 8 caracteres' : 'At least 8 characters'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoComplete="password-new"
                autoFocus
                accessibilityLabel={t ? 'Nueva contraseña' : 'New password'}
                leftIcon={<Feather name="lock" size={18} color={Colors.textMuted} />}
                rightIcon={
                  <Feather
                    name={showPass ? 'eye-off' : 'eye'}
                    size={18}
                    color={Colors.textMuted}
                  />
                }
                onRightIconPress={() => setShowPass((v) => !v)}
                rightIconLabel={
                  showPass
                    ? t
                      ? 'Ocultar contraseña'
                      : 'Hide password'
                    : t
                      ? 'Mostrar contraseña'
                      : 'Show password'
                }
              />
              <View
                style={styles.rules}
                accessibilityLabel={t ? 'Requisitos de la contraseña' : 'Password requirements'}
              >
                {rules.map((r) => {
                  const active = password.length > 0;
                  const color = !active
                    ? Colors.textMuted
                    : r.ok
                      ? Colors.accentSuccess
                      : Colors.accentDanger;
                  return (
                    <View key={r.key} style={styles.ruleRow}>
                      <Feather
                        name={r.ok ? 'check-circle' : 'circle'}
                        size={13}
                        color={color}
                      />
                      <Caption tone={!active ? 'muted' : r.ok ? 'success' : 'danger'}>
                        {t ? r.es : r.en}
                      </Caption>
                    </View>
                  );
                })}
              </View>
            </FadeIn>

            <FadeIn delay={330}>
              <Input
                label={t ? 'Confirmar contraseña' : 'Confirm password'}
                placeholder={t ? 'Repítela aquí' : 'Type it again'}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoComplete="password-new"
                accessibilityLabel={t ? 'Confirmar contraseña' : 'Confirm password'}
                leftIcon={<Feather name="check" size={18} color={Colors.textMuted} />}
                error={
                  confirm && !matchOk
                    ? t
                      ? 'Las contraseñas no coinciden.'
                      : 'Passwords do not match.'
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

            <FadeIn delay={420} style={{ marginTop: Spacing[2] }}>
              <Button
                label={t ? 'Actualizar contraseña' : 'Update password'}
                onPress={handleReset}
                loading={loading}
                disabled={!passOk || !matchOk}
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<Feather name="check" size={18} color={Colors.textInverse} />}
              />
            </FadeIn>

            <View style={styles.helperRow}>
              <Body size="sm" tone="muted" align="center">
                {t
                  ? 'Después de actualizar te llevaremos a iniciar sesión.'
                  : "We'll send you to sign in after updating."}
              </Body>
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
    paddingTop: Spacing[8],
    paddingBottom: Spacing[10],
  },
  form: {
    marginTop: Spacing[8],
    gap: Spacing[4],
  },
  rules: {
    marginTop: Spacing[3],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    gap: Spacing[2],
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  helperRow: {
    marginTop: Spacing[4],
    alignItems: 'center',
  },
});
