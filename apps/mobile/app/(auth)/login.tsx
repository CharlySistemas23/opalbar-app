import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

export default function Login() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError(t ? 'Introduce un email válido.' : 'Enter a valid email.');
      return;
    }
    if (!password) {
      setError(t ? 'Introduce tu contraseña.' : 'Enter your password.');
      return;
    }
    try {
      await login({ email: mail, password });
      router.replace('/(tabs)/home' as never);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const retryAfter = err.response.headers?.['retry-after'] ?? '300';
        router.replace({
          pathname: '/(auth)/too-many-attempts',
          params: { retryAfter: String(retryAfter) },
        } as never);
        return;
      }
      setError(apiError(err, t ? 'Credenciales incorrectas.' : 'Invalid credentials.'));
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Back */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>O</Text>
          </View>
          <Text style={styles.brand}>OPALBAR</Text>
          <Text style={styles.tagline}>
            {t
              ? 'Siempre hay algo pasando,\ny tú te enteras primero.'
              : "Something's always happening,\nand you hear about it first."}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>{t ? 'Inicia sesión' : 'Sign in'}</Text>

          {/* Email */}
          <View style={[styles.inputBox, emailFocused && styles.inputBoxFocused]}>
            <Feather name="mail" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t ? 'email@ejemplo.com' : 'email@example.com'}
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          {/* Password */}
          <View style={[styles.inputBox, passwordFocused && styles.inputBoxFocused]}>
            <Feather name="lock" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t ? 'Contraseña' : 'Password'}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => router.push('/(auth)/forgot-password' as never)}
            hitSlop={8}
          >
            <Text style={styles.forgot}>
              {t ? '¿Olvidaste tu contraseña?' : 'Forgot your password?'}
            </Text>
          </TouchableOpacity>

          {/* Continue */}
          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <>
                <Text style={styles.primaryBtnLabel}>{t ? 'Entrar' : 'Sign in'}</Text>
                <Feather name="arrow-right" size={18} color={Colors.textInverse} />
              </>
            )}
          </TouchableOpacity>

          {/* Signup link */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>
              {t ? '¿No tienes cuenta? ' : "Don't have an account? "}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/register' as never)} hitSlop={6}>
              <Text style={styles.signupLink}>{t ? 'Regístrate' : 'Sign up'}</Text>
            </TouchableOpacity>
          </View>
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
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 8,
  },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: { color: Colors.textInverse, fontSize: 40, fontWeight: '800', lineHeight: 48 },
  brand: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: 3 },
  tagline: {
    color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4,
  },

  form: { paddingHorizontal: 24, gap: 14 },
  formTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 4 },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputBoxFocused: { borderColor: Colors.accentPrimary },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, padding: 0 },

  error: { fontSize: 12, color: Colors.accentDanger, textAlign: 'center' },

  forgotWrap: { alignSelf: 'flex-end' },
  forgot: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '500' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  signupText: { color: Colors.textSecondary, fontSize: 13 },
  signupLink: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '700' },
});
