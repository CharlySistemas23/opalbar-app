// ─────────────────────────────────────────────
//  Change Password — Editorial Premium
//
//  Magazine-style form:
//   · Header with back glyph + serif Heading
//   · Kicker + Lead intro copy
//   · Three Inputs with required dots and inline validation
//   · Primary Button submit (loading state)
//   · Replaces Alert.alert with toast + inline error states.
// ─────────────────────────────────────────────
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { authApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Button,
  FadeIn,
  Heading,
  Input,
  Kicker,
  Pressy,
} from '@/components/ui';
import { toast } from '@/components/Toast';

export default function ChangePassword() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ next?: string; confirm?: string }>({});

  async function handleChange() {
    const nextErrors: typeof errors = {};
    if (next.length < 8) {
      nextErrors.next = t ? 'Mínimo 8 caracteres.' : 'At least 8 characters.';
    }
    if (next !== confirm) {
      nextErrors.confirm = t ? 'No coincide con la nueva contraseña.' : "Doesn't match new password.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      toast(t ? 'Contraseña actualizada.' : 'Password updated.', 'success');
      router.back();
    } catch (err: any) {
      toast(
        apiError(err, t ? 'No se pudo cambiar la contraseña.' : 'Could not change password.'),
        'danger',
      );
    } finally {
      setLoading(false);
    }
  }

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
                ? 'Confirma tu contraseña actual y elige una nueva con al menos 8 caracteres.'
                : 'Confirm your current password and pick a new one with at least 8 characters.'}
            </Body>
          </FadeIn>

          <FadeIn delay={80} style={styles.form}>
            <Input
              label={t ? 'CONTRASEÑA ACTUAL' : 'CURRENT PASSWORD'}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              required
            />
            <Input
              label={t ? 'NUEVA CONTRASEÑA' : 'NEW PASSWORD'}
              value={next}
              onChangeText={(v) => {
                setNext(v);
                if (errors.next) setErrors((e) => ({ ...e, next: undefined }));
              }}
              secureTextEntry
              autoCapitalize="none"
              required
              error={errors.next}
              helper={!errors.next ? (t ? 'Mínimo 8 caracteres.' : 'At least 8 characters.') : undefined}
            />
            <Input
              label={t ? 'CONFIRMAR' : 'CONFIRM'}
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined }));
              }}
              secureTextEntry
              autoCapitalize="none"
              required
              error={errors.confirm}
            />
          </FadeIn>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t ? 'Cambiar contraseña' : 'Change password'}
            onPress={handleChange}
            loading={loading}
            disabled={!current || !next || !confirm}
            variant="primary"
            size="lg"
            fullWidth
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
  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
  },
});
