// ─────────────────────────────────────────────
//  OTP Phone — Editorial Premium
//
//  Twin of otp-email but for SMS verification. Same 6-box editorial
//  layout. Masks phone number for privacy. Supports oneTimeCode auto-fill
//  on iOS via `textContentType` and Android via `autoComplete=sms-otp`.
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { otpApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import {
  Colors,
  EditorialSpacing,
  Radius,
  Spacing,
  TypePresets,
} from '@/constants/tokens';
import { HitSlop } from '@/constants/a11y';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Kicker,
  Lead,
  Pressy,
} from '@/components/ui';

const OTP_LEN = 6;

export default function OtpPhone() {
  const router = useRouter();
  const { phone, password, purpose } = useLocalSearchParams<{
    phone: string;
    email?: string;
    password?: string;
    purpose?: string;
  }>();
  const { language } = useAppStore();
  const { login } = useAuthStore();
  const t = language === 'es';

  const otpType = (purpose as string) || 'PHONE_VERIFICATION';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(60);
  const [resending, setResending] = useState(false);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < OTP_LEN && i < clean.length; i++) next[i] = clean[i];
      setDigits(next);
      const last = Math.min(OTP_LEN - 1, clean.length - 1);
      refs.current[last]?.focus();
      if (clean.length >= OTP_LEN) handleVerify(next.join(''));
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (index < OTP_LEN - 1) refs.current[index + 1]?.focus();
    if (next.every((d) => d) && next.join('').length === OTP_LEN) {
      handleVerify(next.join(''));
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(code?: string) {
    const otp = code || digits.join('');
    if (otp.length < OTP_LEN) return;
    setError('');
    setLoading(true);
    try {
      await otpApi.verify({ identifier: phone, code: otp, type: otpType });

      if (otpType === 'PHONE_VERIFICATION' && password) {
        // User was just marked ACTIVE on the backend — log in now.
        await login({ phone, password });
        router.replace('/(auth)/register/step1-profile' as never);
      } else {
        router.replace('/(auth)/login' as never);
      }
    } catch (err: any) {
      setError(apiError(err, t ? 'Código incorrecto' : 'Invalid code'));
      setDigits(Array(OTP_LEN).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (resendIn > 0 || resending) return;
    setResending(true);
    try {
      await otpApi.send({ phone, type: otpType });
      setResendIn(60);
    } catch {
      /* swallow — UX: stay quiet if resend fails, user can retry */
    } finally {
      setResending(false);
    }
  }

  const mm = String(Math.floor(resendIn / 60)).padStart(2, '0');
  const ss = String(resendIn % 60).padStart(2, '0');
  const maskedPhone = phone ? phone.slice(0, 4) + '••••' + phone.slice(-3) : '';
  const allFilled = digits.every((d) => d);

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
            <Kicker tone="champagne">{t ? 'SMS DE 6 DÍGITOS' : '6-DIGIT SMS'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">
              {t ? 'Verifica tu\nteléfono.' : 'Verify your\nphone.'}
            </Display>
          </FadeIn>
          <FadeIn delay={180} style={{ marginTop: Spacing[4], maxWidth: 360 }}>
            <Lead tone="secondary">
              {t ? 'Enviamos un código a' : 'We sent a code to'}{' '}
              <Lead tone="primary">{maskedPhone}</Lead>
            </Lead>
          </FadeIn>

          <FadeIn delay={280} style={styles.boxesWrap}>
            <View
              style={styles.boxes}
              accessibilityLabel={t ? 'Código de 6 dígitos' : '6 digit code'}
            >
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(r) => {
                    refs.current[i] = r;
                  }}
                  style={[styles.box, !!d && styles.boxFilled]}
                  value={d}
                  onChangeText={(v) => handleChange(i, v)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={OTP_LEN}
                  textAlign="center"
                  selectionColor={Colors.accentPrimary}
                  autoComplete={i === 0 ? 'sms-otp' : undefined}
                  textContentType={i === 0 ? 'oneTimeCode' : undefined}
                  accessibilityLabel={
                    t ? `Dígito ${i + 1} de ${OTP_LEN}` : `Digit ${i + 1} of ${OTP_LEN}`
                  }
                />
              ))}
            </View>
          </FadeIn>

          {error ? (
            <FadeIn>
              <Caption tone="danger" align="center" style={styles.errorText}>
                {error}
              </Caption>
            </FadeIn>
          ) : null}

          <FadeIn delay={360} style={styles.cta}>
            <Button
              label={t ? 'Verificar código' : 'Verify code'}
              onPress={() => handleVerify()}
              loading={loading}
              disabled={!allFilled}
              variant="primary"
              size="lg"
              fullWidth
            />
          </FadeIn>

          <View style={styles.resendBlock}>
            {resendIn > 0 ? (
              <Kicker tone="muted" align="center">
                {t ? `REENVIAR EN ${mm}:${ss}` : `RESEND IN ${mm}:${ss}`}
              </Kicker>
            ) : (
              <View style={styles.resendRow}>
                <Body size="sm" tone="secondary">
                  {t ? '¿No recibiste el código? ' : "Didn't get the code? "}
                </Body>
                <Pressy
                  onPress={resend}
                  disabled={resending}
                  accessibilityRole="button"
                  accessibilityLabel={t ? 'Reenviar código' : 'Resend code'}
                  haptic="select"
                >
                  <Body size="sm" tone="accent" weight="semiBold">
                    {resending
                      ? t
                        ? 'Reenviando…'
                        : 'Resending…'
                      : t
                        ? 'Reenviar'
                        : 'Resend'}
                  </Body>
                </Pressy>
              </View>
            )}
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
  boxesWrap: {
    marginTop: Spacing[10],
  },
  boxes: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  box: {
    ...TypePresets.numericSm,
    flex: 1,
    height: 64,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    color: Colors.textPrimary,
  },
  boxFilled: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.bgElevated,
  },
  errorText: {
    marginTop: Spacing[4],
  },
  cta: {
    marginTop: Spacing[8],
  },
  resendBlock: {
    marginTop: Spacing[6],
    alignItems: 'center',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
