// ─────────────────────────────────────────────
//  Delete account — Editorial Premium
//
//  Dedicated GDPR deletion flow (linked from Perfil → Mis datos):
//   · Clear explanation of what happens (deactivated now, purged in 30 days,
//     support can restore during the window)
//   · Optional reason + current password + typed confirmation word
//   · Final <ConfirmDialog confirmVariant="danger">
//   · On success: destructive haptic, toast, local logout → welcome
//   · DELETE /users/me { reason?, password? }
// ─────────────────────────────────────────────
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Button,
  Caption,
  ConfirmDialog,
  FadeIn,
  Heading,
  Input,
  Kicker,
  Lead,
  Pressy,
} from '@/components/ui';
import { toast } from '@/components/Toast';

export default function DeleteAccount() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const CONFIRM_WORD = t ? 'ELIMINAR' : 'DELETE';

  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const wordOk = confirmWord.trim().toUpperCase() === CONFIRM_WORD;
  const canContinue = wordOk && !submitting;

  const consequences = t
    ? [
        'Tu cuenta se desactiva de inmediato y se cierra sesión en todos tus dispositivos.',
        'Tus puntos, reservas, canjes, publicaciones y conversaciones dejarán de estar disponibles.',
        'A los 30 días se borra de forma definitiva. Hasta entonces, soporte puede restaurarla si nos escribes.',
        'Algunos registros (facturación, auditoría legal) pueden conservarse por obligación legal.',
      ]
    : [
        'Your account is deactivated immediately and you are signed out on every device.',
        'Your points, reservations, redemptions, posts and conversations will no longer be available.',
        'After 30 days it is permanently deleted. Until then, support can restore it if you contact us.',
        'Some records (billing, legal audit) may be retained as required by law.',
      ];

  async function performDelete() {
    setSubmitting(true);
    try {
      await usersApi.deleteAccount({
        reason: reason.trim() || undefined,
        password: password || undefined,
      });
      fb.destructive();
      setDialogOpen(false);
      toast(
        t
          ? 'Tu cuenta fue desactivada. Se eliminará definitivamente en 30 días.'
          : 'Your account was deactivated. It will be permanently deleted in 30 days.',
        'success',
      );
      await logout();
      router.replace('/(auth)/welcome' as never);
    } catch (err) {
      fb.error();
      const msg = apiError(err, t ? 'No se pudo eliminar la cuenta.' : "Couldn't delete the account.");
      const status = (err as { response?: { status?: number } })?.response?.status;
      // 401 / 400 about the password → show inline on the field.
      if (status === 401 || /password|contraseña/i.test(msg)) {
        setPasswordError(msg);
        setDialogOpen(false);
      }
      throw err; // ConfirmDialog surfaces it (toast) and stays open otherwise
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            <Kicker tone="danger">{t ? 'ZONA DE PELIGRO' : 'DANGER ZONE'}</Kicker>
            <Heading size="md">{t ? 'Eliminar cuenta' : 'Delete account'}</Heading>
            <Lead tone="secondary" style={{ marginTop: Spacing[2] }}>
              {t
                ? `Antes de continuar, ${user?.profile?.firstName ? `${user.profile.firstName}, ` : ''}queremos que sepas exactamente qué pasa.`
                : `Before you continue${user?.profile?.firstName ? `, ${user.profile.firstName}` : ''}, here is exactly what happens.`}
            </Lead>
          </FadeIn>

          <FadeIn delay={80} style={styles.consequences}>
            {consequences.map((line, i) => (
              <View key={i} style={styles.consequenceRow}>
                <View style={styles.bullet}>
                  <Feather
                    name={i === 2 ? 'clock' : i === 3 ? 'file-text' : 'alert-triangle'}
                    size={14}
                    color={Colors.accentDanger}
                  />
                </View>
                <Body size="sm" tone="secondary" style={{ flex: 1 }}>
                  {line}
                </Body>
              </View>
            ))}
          </FadeIn>

          <FadeIn delay={140} style={styles.form}>
            <Input
              label={t ? 'MOTIVO (OPCIONAL)' : 'REASON (OPTIONAL)'}
              placeholder={t ? 'Un comentario nos ayuda a mejorar.' : 'A comment helps us improve.'}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
            <Input
              label={t ? 'CONTRASEÑA ACTUAL' : 'CURRENT PASSWORD'}
              placeholder="••••••••"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (passwordError) setPasswordError(undefined);
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              error={passwordError}
              helper={
                !passwordError
                  ? t
                    ? 'Obligatoria si tu cuenta tiene contraseña.'
                    : 'Required if your account has a password.'
                  : undefined
              }
              rightIcon={
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
              }
              onRightIconPress={() => setShowPassword((s) => !s)}
              rightIconLabel={
                showPassword
                  ? t ? 'Ocultar contraseña' : 'Hide password'
                  : t ? 'Mostrar contraseña' : 'Show password'
              }
            />
            <Input
              label={t ? 'CONFIRMACIÓN' : 'CONFIRMATION'}
              placeholder={CONFIRM_WORD}
              value={confirmWord}
              onChangeText={setConfirmWord}
              autoCapitalize="characters"
              autoCorrect={false}
              required
              helper={t ? `Escribe ${CONFIRM_WORD} para activar el botón.` : `Type ${CONFIRM_WORD} to enable the button.`}
            />
          </FadeIn>

          <Caption tone="muted" style={styles.fineprint}>
            {t
              ? '¿Solo quieres un descanso? Puedes hacer tu cuenta privada o desactivar notificaciones sin eliminar nada.'
              : 'Just need a break? You can make your account private or turn off notifications without deleting anything.'}
          </Caption>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t ? 'Eliminar mi cuenta' : 'Delete my account'}
            onPress={() => setDialogOpen(true)}
            variant="danger"
            size="lg"
            fullWidth
            disabled={!canContinue}
            haptic="warning"
          />
          <Button
            label={t ? 'Conservar mi cuenta' : 'Keep my account'}
            onPress={() => router.back()}
            variant="ghost"
            size="md"
            fullWidth
            haptic="select"
          />
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={performDelete}
        title={t ? '¿Eliminar tu cuenta?' : 'Delete your account?'}
        description={
          t
            ? 'Se cerrará tu sesión ahora mismo. Tienes 30 días para pedir a soporte que la restaure; después no habrá vuelta atrás.'
            : 'You will be signed out right away. You have 30 days to ask support to restore it; after that there is no way back.'
        }
        confirmLabel={t ? 'Sí, eliminar' : 'Yes, delete'}
        cancelLabel={t ? 'Cancelar' : 'Cancel'}
        confirmVariant="danger"
      />
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
    paddingBottom: Spacing[3],
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
  consequences: {
    marginHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[4],
    padding: Spacing[5],
    gap: Spacing[4],
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,106,106,0.30)',
  },
  consequenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
  },
  bullet: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(217,106,106,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  form: {
    marginTop: Spacing[6],
    paddingHorizontal: EditorialSpacing.pageGutter,
    gap: Spacing[5],
  },
  fineprint: {
    marginTop: Spacing[6],
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
});
