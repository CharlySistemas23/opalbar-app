import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { authApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

export default function Register() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passOk = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
  const phoneOk = phone.trim().length === 0 || /^\+[1-9]\d{7,14}$/.test(phone.trim());

  async function handleRegister() {
    setError(null);
    if (firstName.trim().length < 2) {
      setError(t ? 'Nombre muy corto.' : 'First name too short.');
      return;
    }
    if (lastName.trim().length < 2) {
      setError(t ? 'Apellido muy corto.' : 'Last name too short.');
      return;
    }
    const mail = email.trim().toLowerCase();
    if (!emailOk) {
      setError(t ? 'Email inválido.' : 'Invalid email.');
      return;
    }
    const cleanPhone = phone.trim();
    if (cleanPhone && !phoneOk) {
      setError(
        t
          ? 'Teléfono inválido. Usa formato internacional, ej. +525512345678.'
          : 'Invalid phone. Use international format, e.g. +525512345678.',
      );
      return;
    }
    if (!passOk) {
      setError(
        t
          ? 'Mínimo 8 chars, 1 mayúscula, 1 número y 1 símbolo.'
          : 'Min 8 chars, 1 uppercase, 1 number, 1 symbol.',
      );
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: mail,
        phone: cleanPhone || undefined,
        password,
        language,
      });
      // Backend auto-sends EMAIL_VERIFICATION OTP on register — no need to re-send here
      router.push({
        pathname: '/(auth)/otp-email',
        params: { email: mail, password, purpose: 'EMAIL_VERIFICATION' },
      } as never);
    } catch (err: any) {
      setError(apiError(err, t ? 'No se pudo crear la cuenta.' : 'Could not create account.'));
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

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>O</Text>
            </View>
            <Text style={styles.title}>
              {t ? 'Crea tu cuenta' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {t ? 'Empieza a descubrir todo lo que pasa.' : 'Start discovering everything happening.'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field
                  icon="user"
                  placeholder={t ? 'Nombre' : 'First name'}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  placeholder={t ? 'Apellido' : 'Last name'}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={[styles.inputBox, email ? (emailOk ? styles.inputBoxOk : styles.inputBoxWarn) : null]}>
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
              />
            </View>
            <Text style={styles.hint}>
              {t
                ? 'Te enviaremos un email con un código de 6 dígitos.'
                : "We'll email you a 6-digit verification code."}
            </Text>

            <View style={[styles.inputBox, phone.length > 0 ? (phoneOk ? styles.inputBoxOk : styles.inputBoxWarn) : null]}>
              <Feather name="phone" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ''))}
                placeholder={t ? '+525512345678 (opcional)' : '+525512345678 (optional)'}
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={16}
              />
            </View>

            <View style={[styles.inputBox, password ? (passOk ? styles.inputBoxOk : styles.inputBoxWarn) : null]}>
              <Feather name="lock" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t ? 'Contraseña' : 'Password'}
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.hint, password && !passOk && { color: Colors.accentDanger }]}>
              {t
                ? 'Mínimo 8 caracteres, 1 mayúscula, 1 número y 1 símbolo.'
                : 'Min 8 chars, 1 uppercase, 1 number, 1 symbol.'}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <>
                  <Text style={styles.primaryBtnLabel}>
                    {t ? 'Crear cuenta' : 'Create account'}
                  </Text>
                  <Feather name="arrow-right" size={18} color={Colors.textInverse} />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.legal}>
              {t
                ? 'Al continuar aceptas la Política de Privacidad\ny Términos de OPALBAR.'
                : 'By continuing you accept our Privacy Policy\nand OPALBAR Terms.'}
            </Text>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                {t ? '¿Ya tienes cuenta? ' : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login' as never)} hitSlop={6}>
                <Text style={styles.loginLink}>{t ? 'Inicia sesión' : 'Sign in'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  icon, ...props
}: React.ComponentProps<typeof TextInput> & { icon?: React.ComponentProps<typeof Feather>['name'] }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
      {icon && <Feather name={icon} size={18} color={Colors.textMuted} />}
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor={Colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
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

  scroll: { paddingBottom: 24 },

  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 6,
  },
  logo: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  logoText: { color: Colors.textInverse, fontSize: 34, fontWeight: '800', lineHeight: 40 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 4 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },

  form: { paddingHorizontal: 24, gap: 12 },

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
  inputBoxOk: { borderColor: Colors.accentSuccess },
  inputBoxWarn: { borderColor: Colors.accentDanger },
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
  btnDisabled: { opacity: 0.6 },

  legal: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginText: { color: Colors.textSecondary, fontSize: 13 },
  loginLink: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '700' },
});
