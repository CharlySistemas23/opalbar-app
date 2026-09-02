// ─────────────────────────────────────────────
//  Change Password — Editorial Premium
//
//  Magazine-style form:
//   · Header with back glyph + serif Heading
//   · Kicker + Lead intro copy
//   · Three Inputs with required dots, show/hide toggles and a live
//     requirement checklist mirroring the backend DTO regex
//     (8–64 chars, uppercase, number, special char)
//   · Primary Button submit (loading state)
//   · Success → toast + stay logged in (backend keeps THIS session and
//     revokes the rest)
// ─────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { authApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Button,
  Caption,
  FadeIn,
  Heading,
  Input,
  Kicker,
  Pressy,
} from '@/components/ui';
import { toast } from '@/components/Toast';

// Mirrors apps/api ChangePasswordDto: @MinLength(8) @MaxLength(64)
// @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/)
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

export default function ChangePassword() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});

  const checks = useMemo(
    () => [
      { ok: next.length >= 8 && next.length <= 64, label: t ? 'Entre 8 y 64 caracteres' : '8 to 64 characters' },
      { ok: /[A-Z]/.test(next), label: t ? 'Una letra mayúscula' : 'One uppercase letter' },
      { ok: /\d/.test(next), label: t ? 'Un número' : 'One number' },
      { ok: /[^A-Za-z0-9]/.test(next), label: t ? 'Un símbolo (!, #, $, …)' : 'One symbol (!, #, $, …)' },
      { ok: next.length > 0 && next !== current, label: t ? 'Distinta a la actual' : 'Different from current' },
    ],
    [next, current, t],
  );

  const nextValid = PASSWORD_RE.test(next) && next !== current;
  const canSubmit = !!current && nextValid && confirm === next && !loading;

  async function handleChange() {
    const nextErrors: typeof errors = {};
    if (!PASSWORD_RE.test(next)) {
      nextErrors.next = t ? 'Revisa los requisitos de abajo.' : 'Check the requirements below.';
    } else if (next === current) {
      nextErrors.next = t ? 'Debe ser distinta a la actual.' : 'Must differ from the current one.';
    }
    if (next !== confirm) {
      nextErrors.confirm = t ? 'No coincide con la nueva contraseña.' : "Doesn't match the new password.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      fb.success();
      toast(
        t
          ? 'Contraseña actualizada. Cerramos sesión en tus otros dispositivos.'
          : 'Password updated. Your other devices were signed out.',
        'success',
      );
      router.back();
    } catch (err) {
      fb.error();
      const msg = apiError(err, t ? 'No se pudo cambiar la contraseña.' : 'Could not change password.');
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setErrors({ current: msg });
      } else {
        toast(msg, 'danger');
      }
    } finally {
      setLoading(false);
    }
  }

  const eye = (shown: boolean) => (
    <Feather name={shown ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
  );
  const eyeLabel = (shown: boolean) =>
    shown ? (t ? 'Ocultar contraseña' : 'Hide password') : (t ? 'Mostrar contraseña' : 'Show password');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressy
            onPress={() => router.back()}
            haptic="select"
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Atrás' : 'Back'}
            hitSlop={HitSlop.expand}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressy>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn style={styles.hero}>
            <Kicker tone="muted">{t ? 'SEGURIDAD' : 'SECURITY'}</Kicker>
            <Heading size="md">{t ? 'Cambiar contraseña' : 'Change password'}</Heading>
            <Body tone="secondary" style={{ marginTop: Spacing[2] }}>
              {t
                ? 'Confirma tu contraseña actual y elige una nueva. Seguirás conectado en este dispositivo; los demás tendrán que volver a iniciar sesión.'
                : 'Confirm your current password and pick a new one. You stay signed in on this device; other devices will need to sign in again.'}
            </Body>
          </FadeIn>

          <FadeIn delay={80} style={styles.form}>
            <Input
              label={t ? 'CONTRASEÑA ACTUAL' : 'CURRENT PASSWORD'}
              value={current}
              onChangeText={(v) => {
                setCurrent(v);
                if (errors.current) setErrors((e) => ({ ...e, current: undefined }));
              }}
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              required
              error={errors.current}
              rightIcon={eye(showCurrent)}
              onRightIconPress={() => setShowCurrent((s) => !s)}
              rightIconLabel={eyeLabel(showCurrent)}
            />
            <Input
              label={t ? 'NUEVA CONTRASEÑA' : 'NEW PASSWORD'}
              value={next}
              onChangeText={(v) => {
                setNext(v);
                if (errors.next) setErrors((e) => ({ ...e, next: undefined }));
              }}
              secureTextEntry={!showNext}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              maxLength={64}
              required
              error={errors.next}
              rightIcon={eye(showNext)}
              onRightIconPress={() => setShowNext((s) => !s)}
              rightIconLabel={eyeLabel(showNext)}
            />

            <View style={styles.checklist} accessibilityRole="list">
              {checks.map((c) => (
                <View key={c.label} style={styles.checkRow}>
                  <Feather
                    name={c.ok ? 'check-circle' : 'circle'}
                    size={14}
                    color={c.ok ? Colors.accentSuccess : Colors.textMuted}
                  />
                  <Caption tone={c.ok ? 'success' : 'muted'}>{c.label}</Caption>
                </View>
              ))}
            </View>

            <Input
              label={t ? 'CONFIRMAR NUEVA CONTRASEÑA' : 'CONFIRM NEW PASSWORD'}
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined }));
              }}
              secureTextEntry={!showNext}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              maxLength={64}
              required
              error={errors.confirm}
              helper={
                !errors.confirm && confirm.length > 0 && confirm !== next
                  ? t ? 'Todavía no coincide.' : "Doesn't match yet."
                  : undefined
              }
            />
          </FadeIn>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t ? 'Cambiar contraseña' : 'Change password'}
            onPress={handleChange}
            loading={loading}
            disabled={!canSubmit}
            variant="primary"
            size="lg"
            fullWidth
            haptic="success"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: Spacing[8],
  },
  hero: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  form: {
    marginTop: Spacing[6],
    paddingHorizontal: EditorialSpacing.pageGutter,
    gap: Spacing[5],
  },
  checklist: {
    gap: Spacing[2],
    padding: Spacing[4],
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginTop: -Spacing[2],
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
  },
});
