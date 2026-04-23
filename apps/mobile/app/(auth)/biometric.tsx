import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthStatusScreen } from '@/components/AuthStatusScreen';
import { useAppStore } from '@/stores/app.store';
import { getBiometricState, authenticate, type BiometricState } from '@/lib/biometric';

export default function Biometric() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [state, setState] = useState<BiometricState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBiometricState().then(setState);
  }, []);

  async function handleUse() {
    setLoading(true);
    const ok = await authenticate(
      t ? 'Confirma tu identidad para entrar' : 'Confirm your identity to sign in',
    );
    setLoading(false);
    if (ok) {
      router.replace('/(tabs)/home' as never);
    }
  }

  function goPasswordLogin() {
    router.replace('/(auth)/login' as never);
  }

  if (!state) {
    return (
      <AuthStatusScreen
        icon="loader"
        variant="info"
        title={t ? 'Verificando dispositivo' : 'Checking device'}
        message={t ? 'Comprobando si tu dispositivo soporta biometría…' : 'Checking if your device supports biometrics…'}
      />
    );
  }

  if (!state.available) {
    return (
      <AuthStatusScreen
        icon="shield-off"
        variant="warning"
        title={t ? 'Biometría no disponible' : 'Biometrics unavailable'}
        message={
          t
            ? 'Tu dispositivo no tiene un sensor biométrico compatible. Inicia sesión con tu contraseña.'
            : 'Your device doesn\'t have a compatible biometric sensor. Sign in with your password.'
        }
        primary={{ label: t ? 'Iniciar sesión' : 'Sign in', onPress: goPasswordLogin }}
        onBack={() => router.back()}
      />
    );
  }

  if (!state.enrolled) {
    return (
      <AuthStatusScreen
        icon="shield-off"
        variant="warning"
        title={t ? 'Sin biometría configurada' : 'No biometrics enrolled'}
        message={
          t
            ? 'No tienes huellas ni Face ID registrados en este dispositivo. Configúralos desde los ajustes del sistema o usa tu contraseña.'
            : 'You have no fingerprints or Face ID enrolled on this device. Set them up from system settings, or use your password.'
        }
        primary={{ label: t ? 'Iniciar sesión' : 'Sign in', onPress: goPasswordLogin }}
        onBack={() => router.back()}
      />
    );
  }

  const icon =
    state.kind === 'face' ? 'smile'
    : state.kind === 'fingerprint' ? 'shield'
    : 'shield';
  const label =
    state.kind === 'face'
      ? t ? 'Usar Face ID' : 'Use Face ID'
      : state.kind === 'fingerprint'
        ? t ? 'Usar huella digital' : 'Use fingerprint'
        : t ? 'Usar biometría' : 'Use biometrics';

  return (
    <AuthStatusScreen
      icon={icon}
      variant="success"
      title={t ? 'Ingresa con biometría' : 'Sign in with biometrics'}
      message={
        t
          ? 'Entra rápido y de forma segura usando la biometría que ya tienes configurada en tu dispositivo.'
          : 'Sign in quickly and securely using the biometrics already set up on your device.'
      }
      hint={
        t
          ? 'Tus datos biométricos nunca salen de tu dispositivo.'
          : 'Your biometric data never leaves your device.'
      }
      primary={{ label, onPress: handleUse, loading }}
      secondary={{
        label: t ? 'Usar contraseña' : 'Use password',
        onPress: goPasswordLogin,
      }}
      onBack={() => router.back()}
    />
  );
}
