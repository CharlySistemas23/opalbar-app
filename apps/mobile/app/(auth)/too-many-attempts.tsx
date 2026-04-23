import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthStatusScreen } from '@/components/AuthStatusScreen';
import { useAppStore } from '@/stores/app.store';

export default function TooManyAttempts() {
  const router = useRouter();
  const { retryAfter } = useLocalSearchParams<{ retryAfter?: string }>();
  const { language } = useAppStore();
  const t = language === 'es';

  const initial = Math.max(parseInt(retryAfter ?? '300', 10) || 300, 0);
  const [secondsLeft, setSecondsLeft] = useState(initial);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const ss = (secondsLeft % 60).toString().padStart(2, '0');
  const ready = secondsLeft <= 0;

  return (
    <AuthStatusScreen
      icon="alert-triangle"
      variant="danger"
      title={t ? 'Demasiados intentos' : 'Too many attempts'}
      message={
        ready
          ? t
            ? 'Ya puedes volver a intentarlo. Si olvidaste tu contraseña, también puedes recuperarla.'
            : 'You can try again now. If you forgot your password, you can also reset it.'
          : t
            ? `Por seguridad bloqueamos los intentos por unos minutos. Podrás reintentar en ${mm}:${ss}.`
            : `For your security we blocked attempts for a few minutes. You can retry in ${mm}:${ss}.`
      }
      hint={
        t
          ? 'Si no fuiste tú quien intentó entrar, cambia tu contraseña cuando recuperes el acceso.'
          : 'If it wasn\'t you trying to sign in, change your password once you regain access.'
      }
      primary={{
        label: ready
          ? t ? 'Reintentar' : 'Try again'
          : t ? `Espera ${mm}:${ss}` : `Wait ${mm}:${ss}`,
        onPress: () => router.replace('/(auth)/login' as never),
        loading: false,
      }}
      secondary={{
        label: t ? 'Recuperar contraseña' : 'Reset password',
        onPress: () => router.replace('/(auth)/forgot-password' as never),
      }}
      onBack={() => router.back()}
    />
  );
}
