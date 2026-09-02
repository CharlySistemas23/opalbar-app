// ─────────────────────────────────────────────
//  Too many attempts — rate-limit lockout (HTTP 429 on /auth/login)
//
//  `retryAfter` (seconds) comes from the Retry-After header. The primary
//  CTA stays disabled with a live countdown until it reaches zero.
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthStatusScreen } from '@/components/AuthStatusScreen';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';

const DEFAULT_RETRY_S = 300;
const MAX_RETRY_S = 60 * 60;

export default function TooManyAttempts() {
  const router = useRouter();
  const { retryAfter } = useLocalSearchParams<{ retryAfter?: string }>();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  // Anchor to an absolute deadline so the countdown stays accurate even if
  // the JS timer is throttled while the app is backgrounded.
  const deadline = useRef<number>(0);
  if (deadline.current === 0) {
    const parsed = parseInt(retryAfter ?? '', 10);
    const secs = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_RETRY_S) : DEFAULT_RETRY_S;
    deadline.current = Date.now() + secs * 1000;
  }
  const remainingNow = () => Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
  const [remaining, setRemaining] = useState<number>(remainingNow);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(remainingNow()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining > 0]);

  useEffect(() => {
    fb.error();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');
  const ready = remaining <= 0;

  return (
    <AuthStatusScreen
      icon="alert-triangle"
      variant="danger"
      kicker={t ? 'ACCESO BLOQUEADO' : 'ACCESS BLOCKED'}
      title={t ? 'Demasiados\nintentos.' : 'Too many\nattempts.'}
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
          : "If it wasn't you trying to sign in, change your password once you regain access."
      }
      primary={{
        label: ready
          ? t ? 'Reintentar' : 'Try again'
          : t ? `Espera ${mm}:${ss}` : `Wait ${mm}:${ss}`,
        onPress: () => router.replace('/(auth)/login' as never),
        disabled: !ready,
      }}
      secondary={{
        label: t ? 'Recuperar contraseña' : 'Reset password',
        onPress: () => router.replace('/(auth)/forgot-password' as never),
      }}
      onBack={() => router.replace('/(auth)/welcome' as never)}
    />
  );
}
