// ─────────────────────────────────────────────
//  Session expired — shown by SessionGuard when the refresh token dies.
//  Both CTAs clear `sessionExpired` so the guard stops redirecting here.
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthStatusScreen } from '@/components/AuthStatusScreen';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';

export default function SessionExpired() {
  const router = useRouter();
  const { clearSessionExpired } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  useEffect(() => {
    fb.warning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goLogin() {
    clearSessionExpired();
    router.replace('/(auth)/login' as never);
  }

  function goWelcome() {
    clearSessionExpired();
    router.replace('/(auth)/welcome' as never);
  }

  return (
    <AuthStatusScreen
      icon="clock"
      variant="warning"
      kicker={t ? 'SESIÓN EXPIRADA' : 'SESSION EXPIRED'}
      title={t ? 'Te cerramos\nla sesión.' : 'We signed\nyou out.'}
      message={
        t
          ? 'Por tu seguridad cerramos tu sesión después de un tiempo de inactividad. Vuelve a iniciar sesión para continuar.'
          : 'For your security we closed your session after a period of inactivity. Log in again to continue.'
      }
      hint={
        t
          ? 'Tus datos, puntos y reservas siguen a salvo en tu cuenta.'
          : 'Your data, points and bookings remain safe in your account.'
      }
      primary={{
        label: t ? 'Iniciar sesión' : 'Log in',
        onPress: goLogin,
      }}
      secondary={{
        label: t ? 'Volver al inicio' : 'Back to start',
        onPress: goWelcome,
      }}
    />
  );
}
