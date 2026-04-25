import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/auth.store';
import { toast } from '../components/Toast';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type Diagnostic =
  | { ok: true; token: string }
  | { ok: false; reason: string };

async function getExpoPushToken(): Promise<Diagnostic> {
  if (!Device.isDevice) return { ok: false, reason: 'emulador (Device.isDevice=false)' };
  if (isExpoGo && Platform.OS === 'android') {
    return { ok: false, reason: 'Expo Go en Android no soporta push' };
  }

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
    if (status !== 'granted') return { ok: false, reason: `permiso=${status}` };

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
    if (!projectId) return { ok: false, reason: 'no projectId en EAS config' };

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!tokenRes?.data) return { ok: false, reason: 'getExpoPushTokenAsync sin data' };
    return { ok: true, token: tokenRes.data };
  } catch (err: any) {
    return { ok: false, reason: `excepción: ${err?.message ?? String(err)}` };
  }
}

export function usePushRegistration() {
  const { isAuthenticated, tokens } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !tokens?.accessToken) return;
    let cancelled = false;

    (async () => {
      const result = await getExpoPushToken();
      if (cancelled) return;

      if (!result.ok) {
        // Surface the reason so the user knows why push silently disappeared.
        // Without this, "no llegó la notif" is undebuggable from a release build.
        toast(`Push no disponible: ${result.reason}`, 'danger');
        try {
          await apiClient.post('/push/register-failed', { reason: result.reason }).catch(() => {});
        } catch {}
        return;
      }

      try {
        await apiClient.post('/push/register', {
          token: result.token,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        });
      } catch (err: any) {
        toast(`Push register API error: ${err?.message ?? 'unknown'}`, 'danger');
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, tokens?.accessToken]);
}
