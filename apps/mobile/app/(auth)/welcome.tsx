// ─────────────────────────────────────────────
//  Welcome — Figma-matched (node 12:2, 2026-06-07)
//
//  Layout = Figma exact:
//   · Status bar handled by SafeAreaView
//   · Hero: 64x64 brand mark (bgElevated, hairline border, "O" in Fraunces
//     SemiBold 24pt accent) → Kicker "OPALBAR · CLUB PRIVADO" 0.9 opacity →
//     Display LG (34/36) "Tu noche\ncomienza aquí." → Body Large 17pt
//     "Membresía, cortesías y experiencias\ncuradas para nuestros socios."
//   · Actions: 3 buttons gap 12 — primary gold solid, secondary bgCard
//     hairline border 0.12, ghost link
// ─────────────────────────────────────────────
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Body, Button, Caption, Display, FadeIn, Heading, Kicker, Pressy } from '@/components/ui';
import { OpalbarRoutes } from '@/lib/website';

export default function Welcome() {
  const router = useRouter();
  const { continueAsGuest } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const [entering, setEntering] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <FadeIn>
            <View style={styles.brandMark} accessibilityIgnoresInvertColors>
              <Heading
                size="lg"
                tone="accent"
                style={{ lineHeight: 28 }}
                accessibilityElementsHidden
              >
                O
              </Heading>
            </View>
          </FadeIn>

          <FadeIn delay={120}>
            <Kicker align="center" tone="accent" style={{ opacity: 0.9 }}>
              {t ? 'OPALBAR · CLUB PRIVADO' : 'OPALBAR · PRIVATE CLUB'}
            </Kicker>
          </FadeIn>

          <FadeIn delay={200}>
            <Display size="lg" align="center" style={styles.title}>
              {t ? 'Tu noche\ncomienza aquí.' : 'Your night\nstarts here.'}
            </Display>
          </FadeIn>

          <FadeIn delay={300}>
            <Body size="lg" align="center" tone="secondary" style={styles.lead}>
              {t
                ? 'Membresía, cortesías y experiencias\ncuradas para nuestros socios.'
                : 'Membership, perks and curated\nexperiences for our members.'}
            </Body>
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
              <Body size="sm" tone="accent">
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
          <FadeIn delay={620}>
            <Pressy
              onPress={() => OpalbarRoutes.home()}
              accessibilityRole="button"
              accessibilityLabel={t ? 'Visitar opalbar.com.mx' : 'Visit opalbar.com.mx'}
              style={styles.webLink}
            >
              <Caption tone="muted" align="center">
                {t ? 'Conoce más en ' : 'Learn more at '}
                <Caption tone="accent">opalbar.com.mx</Caption>
              </Caption>
            </Pressy>
          </FadeIn>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: 60,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,241,231,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 0,
  },
  lead: {
    maxWidth: 320,
  },
  actions: {
    gap: Spacing[3],
  },
  guestBtn: {
    paddingVertical: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  webLink: {
    paddingVertical: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
});
