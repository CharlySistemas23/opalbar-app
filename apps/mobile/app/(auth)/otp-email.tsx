import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { otpApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

const OTP_LEN = 6;

export default function OtpEmail() {
  const router = useRouter();
  const { email, purpose, password } = useLocalSearchParams<{
    email: string;
    purpose?: string;
    password?: string;
  }>();
  const { language } = useAppStore();
  const { login } = useAuthStore();
  const t = language === 'es';

  const otpType = (purpose as string) || 'EMAIL_VERIFICATION';

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
      await otpApi.verify({ identifier: email, code: otp, type: otpType });

      // Post-verify behavior
      if (otpType === 'EMAIL_VERIFICATION' && password) {
        // After verification, log the user in automatically
        await login({ email, password });
        // Kick off onboarding: profile data → interests → permissions → welcome
        router.replace('/(auth)/register/step1-profile' as never);
      } else if (otpType === 'PASSWORD_RESET') {
        router.replace({
          pathname: '/(auth)/new-password',
          params: { email, code: otp },
        } as never);
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
      await otpApi.send({ email, type: otpType });
      setResendIn(60);
    } catch {}
    finally { setResending(false); }
  }

  const mm = String(Math.floor(resendIn / 60)).padStart(2, '0');
  const ss = String(resendIn % 60).padStart(2, '0');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>
            {t ? 'Revisa tu email' : 'Check your email'}
          </Text>
          <Text style={styles.subtitle}>
            {t ? `Enviamos un código de 6 dígitos a\n${email}` : `We sent a 6-digit code to\n${email}`}
          </Text>

          <View style={styles.boxes}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { refs.current[i] = r; }}
                style={[styles.box, d && styles.boxFilled]}
                value={d}
                onChangeText={(v) => handleChange(i, v)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={OTP_LEN}
                textAlign="center"
                selectionColor={Colors.accentPrimary}
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={() => handleVerify()}
            disabled={loading || digits.some((d) => !d)}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={styles.primaryBtnLabel}>{t ? 'Verificar código' : 'Verify code'}</Text>}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>
              {t ? '¿No recibiste el código? ' : "Didn't get the code? "}
            </Text>
            <TouchableOpacity onPress={resend} disabled={resendIn > 0} hitSlop={6}>
              <Text style={[styles.resendLink, resendIn > 0 && { opacity: 0.4 }]}>
                {t ? 'Reenviar' : 'Resend'}
              </Text>
            </TouchableOpacity>
          </View>

          {resendIn > 0 && (
            <View style={styles.timerRow}>
              <Feather name="clock" size={14} color={Colors.textMuted} />
              <Text style={styles.timerText}>
                {t ? `Reenviar en ${mm}:${ss}` : `Resend in ${mm}:${ss}`}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { paddingHorizontal: 20, paddingVertical: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 20,
  },
  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  boxes: { flexDirection: 'row', gap: 10, marginTop: 8 },
  box: {
    flex: 1,
    height: 60,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  boxFilled: { borderColor: Colors.accentPrimary },
  error: { fontSize: 13, color: Colors.accentDanger, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
    marginTop: 4,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  resendRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
  },
  resendText: { color: Colors.textSecondary, fontSize: 13 },
  resendLink: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '700' },
  timerRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6,
  },
  timerText: { color: Colors.textMuted, fontSize: 12 },
});
