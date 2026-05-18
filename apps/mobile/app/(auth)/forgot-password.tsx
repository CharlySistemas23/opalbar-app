// ─────────────────────────────────────────────
//  Forgot Password — Editorial Premium
//
//  Single-input screen: kicker, Display headline, lead paragraph and one
//  email input. No decorative icon circle — the type carries the moment.
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { otpApi } from '@/api/client';
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
            <Kicker tone="champagne">{t ? 'RECUPERAR ACCESO' : 'RECOVER ACCESS'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">
              {t ? '¿Olvidaste tu\ncontraseña?' : 'Forgot your\npassword?'}
            </Display>
          </FadeIn>
          <FadeIn delay={180} style={{ marginTop: Spacing[4], maxWidth: 340 }}>
            <Lead tone="secondary">
              {t
                ? 'Te enviamos un código a tu email para que crees una nueva.'
                : "We'll send a code to your email so you can create a new one."}
            </Lead>
          </FadeIn>

          <View style={styles.form}>
            <FadeIn delay={260}>
              <Input
                label="Email"
                placeholder={t ? 'email@ejemplo.com' : 'email@example.com'}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                accessibilityLabel={t ? 'Correo electrónico' : 'Email'}
                leftIcon={<Feather name="mail" size={18} color={Colors.textMuted} />}
              />
            </FadeIn>

            {error ? (
              <FadeIn>
                <Caption tone="danger" align="center">
                  {error}
                </Caption>
              </FadeIn>
            ) : null}

            <FadeIn delay={340} style={{ marginTop: Spacing[2] }}>
              <Button
                label={t ? 'Enviar código' : 'Send code'}
                onPress={handleSend}
                loading={loading}
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<Feather name="arrow-right" size={18} color={Colors.textInverse} />}
              />
            </FadeIn>

            <View style={styles.helperRow}>
              <Body size="sm" tone="muted" align="center">
                {t
                  ? 'Revisa tu carpeta de spam si no lo recibes pronto.'
                  : 'Check your spam folder if it doesn’t arrive soon.'}
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
