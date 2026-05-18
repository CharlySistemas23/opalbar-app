// ─────────────────────────────────────────────
//  Welcome — Editorial Premium
//
//  First impression. Magazine cover energy: kicker, hero title in
//  Fraunces, lead paragraph, then the actions. No icon-decorated buttons
//  — the action is the action.
// ─────────────────────────────────────────────
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Button, FadeIn, Hero, Kicker, Lead, Pressy, Body } from '@/components/ui';

export default function Welcome() {
  const router = useRouter();
  const { continueAsGuest } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const [entering, setEntering] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <FadeIn>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </FadeIn>

        <FadeIn delay={120} style={styles.kickerWrap}>
          <Kicker align="center" tone="champagne">
            {t ? 'BIENVENIDO' : 'WELCOME'}
          </Kicker>
        </FadeIn>

        <FadeIn delay={200}>
          <Hero align="center">opalbar</Hero>
        </FadeIn>

        <FadeIn delay={300} style={styles.leadWrap}>
          <Lead align="center" tone="secondary">
            {t
              ? 'Siempre hay algo pasando,\ny tú te enteras primero.'
              : "Something's always happening,\nand you hear about it first."}
          </Lead>
        </FadeIn>
      </View>

      <View style={styles.actions}>
        <FadeIn delay={420}>
          <Button
            label={t ? 'Iniciar sesión' : 'Sign in'}
            onPress={() => router.push('/(auth)/login' as never)}
            variant="primary"
            size="lg"
            fullWidth
            accessibilityHint={t ? 'Abre la pantalla de inicio de sesión' : 'Open sign in screen'}
          />
        </FadeIn>
        <FadeIn delay={490}>
          <Button
            label={t ? 'Crear cuenta' : 'Create account'}
            onPress={() => router.push('/(auth)/register' as never)}
            variant="secondary"
            size="lg"
            fullWidth
            accessibilityHint={t ? 'Abre la pantalla de registro' : 'Open registration screen'}
          />
        </FadeIn>
        <FadeIn delay={560}>
          <Pressy
            onPress={() => {
              if (entering) return;
              setEntering(true);
              continueAsGuest();
              router.replace('/(guest)/home' as never);
            }}
            disabled={entering}
            accessibilityRole="button"
            accessibilityLabel={t ? 'Continuar como invitado' : 'Continue as guest'}
            style={styles.guestBtn}
          >
            <Body tone="accent" weight="semiBold">
              {entering
                ? t
                  ? 'Entrando…'
                  : 'Entering…'
                : t
                  ? 'Continuar como invitado'
                  : 'Continue as guest'}
            </Body>
          </Pressy>
        </FadeIn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 24,
    marginBottom: Spacing[5],
  },
  kickerWrap: {
    marginTop: Spacing[2],
  },
  leadWrap: {
    marginTop: Spacing[3],
    maxWidth: 320,
  },
  actions: {
    gap: Spacing[3],
    paddingBottom: Spacing[6],
  },
  guestBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
