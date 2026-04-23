import { useRouter } from 'expo-router';
import { AuthStatusScreen } from '@/components/AuthStatusScreen';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';

export default function SessionExpired() {
  const router = useRouter();
  const { clearSessionExpired } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

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
      title={t ? 'Tu sesión ha expirado' : 'Your session expired'}
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
