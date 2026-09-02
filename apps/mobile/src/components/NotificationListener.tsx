import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useRealtime } from '@/hooks/useRealtime';
import { showNotificationBanner } from './NotificationBanner';
import { Colors } from '@/constants/tokens';
import { routeForNotifData } from '@/lib/notif-routing';
import { notificationsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { useUnreadStore } from '@/stores/unread.store';

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

/**
 * Global in-app banner for incoming notifications. Subscribes to the realtime
 * `notification:created` envelope and shows the rich NotificationBanner so the
 * user sees the message even if the OS push didn't fire (no permission, Expo
 * Go, web). Mounted once in _layout.tsx, lives next to RealtimeBridge.
 */
export function NotificationListener() {
  const router = useRouter();
  const language = useAppStore((s) => s.language);

  useRealtime('notification', (env) => {
    if (env.action !== 'created') return;
    // env.data IS the notification record. Older code unwrapped env.data.data,
    // but that points to the Prisma JSON metadata (actorId/postId/...) which
    // has no title — so the banner showed the fallback.
    const n = env.data;
    if (!n || typeof n !== 'object') return;

    const es = language === 'es';
    const { icon, color } = metaForType(n.type);
    const route = routeForNotifData({ type: n.type, ...(n.data ?? {}) });
    const avatarUrl = n.data?.actorAvatarUrl ?? n.imageUrl ?? undefined;
    const title = (es ? n.title : n.titleEn ?? n.title) || (es ? 'Notificación' : 'Notification');
    const body = es ? n.body : n.bodyEn ?? n.body;

    showNotificationBanner({
      notifId: n.id,
      type: n.type,
      title,
      body,
      avatarUrl,
      accentColor: color,
      icon,
      onPress: () => {
        // Tapping the banner = seen. Optimistic badge decrement, then the
        // server truth via refresh(). Navigation never waits on the network.
        if (n.id) {
          const unread = useUnreadStore.getState();
          unread.set({ notifications: Math.max(0, unread.notifications - 1) });
          notificationsApi.markRead(n.id)
            .then(() => unread.refresh())
            .catch(() => unread.refresh().catch(() => {}));
        }
        router.push(route as any);
      },
    });
  });

  return null;
}
