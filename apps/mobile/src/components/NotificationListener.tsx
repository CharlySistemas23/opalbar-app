import { useRealtime } from '@/hooks/useRealtime';
import { toast } from './Toast';

/**
 * Global in-app banner for incoming notifications. Subscribes to the realtime
 * `notification:created` envelope and surfaces a Toast so the user sees the
 * message even if the OS push didn't fire (no permission, Expo Go, web).
 *
 * Mounted once in _layout.tsx, lives next to RealtimeBridge.
 */
export function NotificationListener() {
  useRealtime('notification', (env) => {
    if (env.action !== 'created') return;
    const n = env.data?.data ?? env.data;
    const title = n?.title ?? 'Notificación';
    const body = n?.body ? `${title} — ${n.body}` : title;
    toast(body, 'info');
  });
  return null;
}
