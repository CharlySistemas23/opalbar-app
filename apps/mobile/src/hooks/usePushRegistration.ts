import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/auth.store';

// Expo Go (SDK 53+) no soporta push notifications remotas en Android.
// Solo cargamos expo-notifications cuando NO estamos en Expo Go para evitar
// el crash "Android Push notifications functionality was removed from Expo Go".
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (isExpoGo && Platform.OS === 'android') return null;

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token?.data ?? null;
  } catch {
    return null;
  }
}

export function usePushRegistration() {
  const { isAuthenticated, tokens } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !tokens?.accessToken) return;
    if (isExpoGo && Platform.OS === 'android') return;
    let cancelled = false;

    (async () => {
      const expoToken = await getExpoPushToken();
      if (!expoToken || cancelled) return;
      try {
        await apiClient.post('/push/register', {
          token: expoToken,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        });
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, tokens?.accessToken]);
}
