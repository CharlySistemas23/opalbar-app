import { useRouter } from 'expo-router';
import { AuthStatusScreen } from '@/components/AuthStatusScreen';
import { useAppStore } from '@/stores/app.store';

export default function RegistrationComplete() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  return (
    <AuthStatusScreen
      icon="check-circle"
      variant="success"
      title={t ? '¡Cuenta creada!' : 'Account created!'}
      message={
        t
          ? 'Tu cuenta ha sido verificada exitosamente. Ya puedes acceder a todos los beneficios de OPALBAR.'
          : 'Your account has been verified successfully. You can now access all OPALBAR benefits.'
      }
      hint={
        t
          ? 'A continuación elige tus intereses y ajusta los permisos que quieras conceder.'
          : 'Next, pick your interests and choose which permissions you want to grant.'
      }
      primary={{
        label: t ? 'Continuar' : 'Continue',
        onPress: () => router.replace('/(auth)/register/step1-profile' as never),
      }}
    />
  );
}
