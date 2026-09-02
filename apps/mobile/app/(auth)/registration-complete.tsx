// ─────────────────────────────────────────────
//  Registration complete — Editorial Premium
//
//  Reached right after the OTP screen verifies the account AND the
//  auto-login succeeds (otp-email / otp-phone). Celebration beat before
//  the onboarding steps (profile → interests → permissions → welcome).
//  Listed in ONBOARDING_FLOW_SEGMENTS (app/_layout.tsx) so the session
//  guard doesn't bounce the now-authenticated user to home.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { AuthStatusScreen } from '@/components/AuthStatusScreen';
import { Confetti } from '@/components/ui';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { useFeedback } from '@/hooks/useFeedback';

export default function RegistrationComplete() {
  const router = useRouter();
  const { language } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const t = language === 'es';
  const fb = useFeedback();
  const [party, setParty] = useState(true);

  const firstName = user?.profile?.firstName?.trim();

  useEffect(() => {
    fb.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleContinue() {
    fb.tap();
    router.replace('/(auth)/register/step1-profile' as never);
  }

  return (
    <>
      <AuthStatusScreen
        icon="check-circle"
        variant="success"
        kicker={t ? 'CUENTA VERIFICADA' : 'ACCOUNT VERIFIED'}
        title={
          firstName
            ? t
              ? `Bienvenido\nal club, ${firstName}.`
              : `Welcome to\nthe club, ${firstName}.`
            : t
              ? 'Bienvenido\nal club.'
              : 'Welcome to\nthe club.'
        }
        message={
          t
            ? 'Tu cuenta está activa. Ahora personalicemos tu experiencia en OPALBAR: toma menos de un minuto.'
            : 'Your account is active. Now let’s personalise your OPALBAR experience — it takes under a minute.'
        }
        hint={
          t
            ? 'A continuación elige tus intereses y ajusta los permisos que quieras conceder. Puedes cambiarlos después desde tu perfil.'
            : 'Next, pick your interests and choose which permissions to grant. You can change them later from your profile.'
        }
        primary={{
          label: t ? 'Continuar' : 'Continue',
          onPress: handleContinue,
        }}
      />
      <Confetti visible={party} onDone={() => setParty(false)} />
    </>
  );
}
