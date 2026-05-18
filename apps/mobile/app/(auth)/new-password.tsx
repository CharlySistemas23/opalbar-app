// ─────────────────────────────────────────────
//  New Password — Editorial Premium
//
//  Reset flow final step. Kicker + Display title, two password inputs,
//  inline rule line. Single eye toggle covers both fields. Success
//  emits a toast and redirects to login.
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

import { toast } from '@/components/Toast';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { authApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
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

export default function NewPassword() {
  const router = useRouter();
  const { email, code } = useLocalSearchParams<{ email: string; code: string }>();
  const { language } = useAppStore();
  const t = language === 'es';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passOk =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const matchOk = confirm.length > 0 && confirm === password;

  async function handleReset() {
    setError(null);
    if (!passOk) {
      setError(t ? 'Contraseña muy débil.' : 'Password too weak.');
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
      toast(
        t ? 'Contraseña actualizada. Inicia sesión.' : 'Password updated. Please sign in.',
        'success',
      );
      router.replace('/(auth)/login' as never);
    } catch (err: any) {
      setError(apiError(err, t ? 'No se pudo actualizar.' : 'Could not update.'));
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
            <Kicker tone="champagne">{t ? 'NUEVA CLAVE' : 'NEW SECRET'}</Kicker>
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
                helper={
                  t
                    ? '8+ caracteres, mayúscula, número y símbolo.'
                    : '8+ chars, 1 uppercase, 1 number, 1 symbol.'
                }
                error={
                  password && !passOk
                    ? t
                      ? 'Aún no cumple los requisitos.'
                      : 'Does not meet requirements yet.'
                    : undefined
                }
              />
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
  helperRow: {
    marginTop: Spacing[4],
    alignItems: 'center',
  },
});
