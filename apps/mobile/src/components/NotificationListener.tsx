import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useRealtime } from '@/hooks/useRealtime';
import { showNotificationBanner } from './NotificationBanner';
import { Colors } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

function metaForType(type?: string): { icon: FeatherIcon; color: string } {
  const t = (type ?? '').toUpperCase();
  if (t.includes('FOLLOW')) return { icon: 'user-plus', color: Colors.accentSuccess };
  if (t.includes('REACTION') || t.includes('LIKE')) return { icon: 'heart', color: Colors.accentDanger };
  if (t.includes('REPLY') || t.includes('COMMENT') || t.includes('MENTION') || t.includes('MESSAGE'))
    return { icon: 'message-circle', color: Colors.accentInfo };
  if (t.includes('RESERVATION')) return { icon: 'calendar', color: Colors.accentPrimary };
  if (t.includes('EVENT')) return { icon: 'music', color: Colors.accentPrimary };
  if (t.includes('OFFER')) return { icon: 'tag', color: Colors.accentPrimary };
  if (t.includes('POINTS') || t.includes('LEVEL')) return { icon: 'star', color: Colors.accentChampagne };
  if (t.includes('STORY') || t.includes('NEW_POST') || t.includes('POST_APPROVED'))
    return { icon: 'image', color: Colors.accentPrimary };
  if (t.includes('REJECTED') || t.includes('ALERT')) return { icon: 'alert-triangle', color: Colors.accentDanger };
  if (t.includes('SYSTEM')) return { icon: 'info', color: Colors.textSecondary };
  return { icon: 'bell', color: Colors.accentPrimary };
}

function routeForNotif(n: any): string | null {
  const type = String(n?.type ?? '').toUpperCase();
  const data = n?.data ?? {};
  if (type.includes('FOLLOW') && data.actorId) return `/(app)/profile/${data.actorId}`;
  if ((type.includes('REPLY') || type.includes('REACTION') || type.includes('MENTION') || type.includes('NEW_POST')) && data.postId)
    return `/(app)/community/${data.postId}`;
  if (type.includes('MESSAGE') && data.threadId) return `/(app)/messages/${data.threadId}`;
  if (type.includes('EVENT') && data.eventId) return `/(app)/events/${data.eventId}`;
  if (type.includes('OFFER') && data.offerId) return `/(app)/offers/${data.offerId}`;
  if (type.includes('RESERVATION') && data.reservationId) return `/(app)/reservations/${data.reservationId}`;
  if (type.includes('STORY') && data.venueId) return `/(app)/venues/${data.venueId}`;
  return '/(app)/profile/notifications';
}

/**
 * Global in-app banner for incoming notifications. Subscribes to the realtime
 * `notification:created` envelope and shows the rich NotificationBanner so the
 * user sees the message even if the OS push didn't fire (no permission, Expo
 * Go, web). Mounted once in _layout.tsx, lives next to RealtimeBridge.
 */
export function NotificationListener() {
  const router = useRouter();

  useRealtime('notification', (env) => {
    if (env.action !== 'created') return;
    // env.data IS the notification record. Older code unwrapped env.data.data,
    // but that points to the Prisma JSON metadata (actorId/postId/...) which
    // has no title — so the banner showed the "Notificación" fallback.
    const n = env.data;
    if (!n || typeof n !== 'object') return;

    const { icon, color } = metaForType(n.type);
    const route = routeForNotif(n);
    const avatarUrl = n.data?.actorAvatarUrl ?? n.imageUrl ?? undefined;

    showNotificationBanner({
      notifId: n.id,
      type: n.type,
      title: n.title ?? 'Notificación',
      body: n.body,
      avatarUrl,
      accentColor: color,
      icon,
      onPress: route ? () => router.push(route as any) : undefined,
    });
  });

  return null;
}
