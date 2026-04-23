import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { otpApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

export default function ForgotPassword() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError(t ? 'Email inválido.' : 'Invalid email.');
      return;
    }
    setLoading(true);
    try {
      await otpApi.send({ email: mail, type: 'PASSWORD_RESET' });
      router.push({
        pathname: '/(auth)/email-sent',
        params: { email: mail, purpose: 'PASSWORD_RESET' },
      } as never);
    } catch (err: any) {
      setError(apiError(err, t ? 'No se pudo enviar el código.' : 'Could not send code.'));
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Feather name="lock" size={28} color={Colors.accentPrimary} />
          </View>
          <Text style={styles.title}>
            {t ? 'Recuperar contraseña' : 'Forgot password'}
          </Text>
          <Text style={styles.subtitle}>
            {t
              ? 'Te enviaremos un código a tu email\npara que crees una nueva contraseña.'
              : "We'll send a code to your email\nso you can create a new password."}
          </Text>

          <View style={styles.inputBox}>
            <Feather name="mail" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t ? 'email@ejemplo.com' : 'email@example.com'}
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.textInverse} />
              : <>
                  <Text style={styles.primaryBtnLabel}>
                    {t ? 'Enviar código' : 'Send code'}
                  </Text>
                  <Feather name="arrow-right" size={18} color={Colors.textInverse} />
                </>}
          </TouchableOpacity>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  iconCircle: {
    alignSelf: 'center',
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(244, 163, 64, 0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 52, paddingHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, padding: 0 },
  error: { color: Colors.accentDanger, fontSize: 12, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
    marginTop: 8,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '700' },
});
