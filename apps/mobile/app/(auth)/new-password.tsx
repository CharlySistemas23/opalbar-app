import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { authApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

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

  const passOk = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

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
      Alert.alert(
        t ? '¡Listo!' : 'Done!',
        t ? 'Contraseña actualizada. Inicia sesión.' : 'Password updated. Please sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login' as never) }],
      );
    } catch (err: any) {
      setError(apiError(err, t ? 'No se pudo actualizar.' : 'Could not update.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Feather name="shield" size={28} color={Colors.accentPrimary} />
          </View>
          <Text style={styles.title}>
            {t ? 'Nueva contraseña' : 'New password'}
          </Text>
          <Text style={styles.subtitle}>
            {t ? 'Elige una contraseña segura para tu cuenta.' : 'Choose a secure password for your account.'}
          </Text>

          <View style={[styles.inputBox, password ? (passOk ? { borderColor: Colors.accentSuccess } : { borderColor: Colors.accentDanger }) : null]}>
            <Feather name="lock" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t ? 'Nueva contraseña' : 'New password'}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={8}>
              <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.inputBox, confirm && (confirm === password ? { borderColor: Colors.accentSuccess } : { borderColor: Colors.accentDanger })]}>
            <Feather name="check" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t ? 'Confirmar contraseña' : 'Confirm password'}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.hint}>
            {t
              ? '8+ caracteres, mayúscula, número, símbolo.'
              : '8+ chars, 1 uppercase, 1 number, 1 symbol.'}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.textInverse} />
              : <>
                  <Feather name="check" size={18} color={Colors.textInverse} />
                  <Text style={styles.primaryBtnLabel}>
                    {t ? 'Actualizar contraseña' : 'Update password'}
                  </Text>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20, gap: 14 },
  iconCircle: {
    alignSelf: 'center',
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(244, 163, 64, 0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 52, paddingHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, padding: 0 },
  hint: { color: Colors.textMuted, fontSize: 11, paddingHorizontal: 2 },
  error: { color: Colors.accentDanger, fontSize: 12, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
    marginTop: 6,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '700' },
});
