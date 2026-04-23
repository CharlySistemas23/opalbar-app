import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthStatusScreen } from '@/components/AuthStatusScreen';
import { useAppStore } from '@/stores/app.store';

export default function EmailSent() {
  const router = useRouter();
  const { email, purpose } = useLocalSearchParams<{ email?: string; purpose?: string }>();
  const { language } = useAppStore();
  const t = language === 'es';

  const mail = email ?? '';

  return (
    <AuthStatusScreen
      icon="mail"
      variant="success"
      title={t ? 'Correo enviado' : 'Email sent'}
      message={
        t
          ? `Te enviamos un código de 6 dígitos a ${mail}. Revisa tu bandeja y la carpeta de spam.`
          : `We sent a 6-digit code to ${mail}. Check your inbox and spam folder.`
      }
      hint={
        t
          ? 'El código expira en 10 minutos. Si no lo recibes en un minuto, puedes solicitarlo de nuevo.'
          : 'The code expires in 10 minutes. If you don\'t receive it within a minute, you can request another.'
      }
      primary={{
        label: t ? 'Ingresar código' : 'Enter code',
        onPress: () =>
          router.replace({
            pathname: '/(auth)/otp-email',
            params: { email: mail, purpose: purpose ?? 'PASSWORD_RESET' },
          } as never),
      }}
      secondary={{
        label: t ? 'Usar otro correo' : 'Use another email',
        onPress: () => router.back(),
      }}
      onBack={() => router.back()}
    />
  );
}
