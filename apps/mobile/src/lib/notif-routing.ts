/**
 * Single source of truth for turning a notification's flat `data` payload into
 * an in-app route. Used by the in-app banner (NotificationListener), the
 * notifications inbox and the OS push-tap handler (usePushTapRouting) so a
 * notification lands on the SAME screen whichever way it arrives.
 *
 * The server sends a FLAT data object, e.g. `{ type: 'MESSAGE_NEW', threadId,
 * actorId }` (see api notifications.service). Some payloads include an explicit
 * `deepLink` (support replies, admin pushes) which always wins.
 *
 * Every branch below is an explicit `NotificationType` (prisma enum). Unknown
 * or incomplete payloads fall back to the inbox, which always exists.
 */
export const NOTIF_INBOX_ROUTE = '/(app)/profile/notifications';

export function routeForNotifData(data: Record<string, any> | null | undefined): string {
  const d = data ?? {};

  // Explicit deep link from the server takes precedence.
  if (typeof d.deepLink === 'string' && d.deepLink.startsWith('/')) return d.deepLink;

  const type = String(d.type ?? '').toUpperCase();
  const postId: string | undefined = d.postId ?? (d.targetType === 'POST' ? d.targetId : undefined);
  const actorId: string | undefined = d.actorId ?? d.userId;

  switch (type) {
    // ── Messages ──
    case 'MESSAGE_REQUEST':
      return '/(app)/messages/requests';
    case 'MESSAGE_NEW':
      return d.threadId ? `/(app)/messages/${d.threadId}` : '/(app)/messages';

    // ── Friends / follows ──
    case 'FRIEND_REQUEST':
      return '/(app)/profile/friend-requests';
    case 'FRIEND_ACCEPTED':
    case 'COMMUNITY_FOLLOW':
      return actorId ? `/(app)/users/${actorId}` : NOTIF_INBOX_ROUTE;

    // ── Mentions needing approval ──
    case 'MENTION_APPROVAL_NEEDED':
    case 'STORY_MENTION':
      return '/(app)/profile/mention-requests';

    // ── Posts & comments ──
    case 'POST_APPROVED':
    case 'POST_REJECTED':
    case 'POST_MENTION':
    case 'COMMENT_MENTION':
    case 'COMMUNITY_REPLY':
    case 'COMMUNITY_REACTION':
    case 'COMMUNITY_MENTION':
    case 'COMMUNITY_NEW_POST': {
      const id = postId ?? d.targetId;
      if (id) return `/(app)/community/posts/${id}`;
      if (type === 'COMMUNITY_NEW_POST' && actorId) return `/(app)/users/${actorId}`;
      return NOTIF_INBOX_ROUTE;
    }

    // ── Loyalty ──
    case 'LEVEL_UP':
    case 'POINTS_EARNED':
    case 'POINTS_REDEEMED':
      return '/(app)/profile/wallet';

    // ── Venue / events / offers ──
    case 'VENUE_STORY_NEW':
      return '/(app)/community/story-viewer?venue=1';
    case 'EVENT_NEW':
    case 'EVENT_REMINDER':
      return d.eventId ? `/(app)/events/${d.eventId}` : '/(tabs)/home';
    case 'OFFER_NEW':
    case 'OFFER_EXPIRING':
      return d.offerId ? `/(app)/offers/${d.offerId}` : '/(app)/offers';

    // ── Account ──
    case 'ACCOUNT_ALERT':
      return '/(app)/profile/sessions';

    case 'SYSTEM':
      // Only a deepLink (handled above) can route SYSTEM rows; otherwise
      // they are informational → inbox.
      if (d.ticketId) return `/(app)/support/chat/${d.ticketId}`;
      if (d.reservationId) return `/(app)/reservations/${d.reservationId}`;
      return NOTIF_INBOX_ROUTE;

    default:
      break;
  }

  // Push-only payload types that aren't `NotificationType` members (e.g.
  // RESERVATION_* from push.service) — resolve by the id they carry.
  if (d.reservationId) return `/(app)/reservations/${d.reservationId}`;
  if (d.threadId) return `/(app)/messages/${d.threadId}`;
  if (postId) return `/(app)/community/posts/${postId}`;
  if (d.eventId) return `/(app)/events/${d.eventId}`;
  if (d.offerId) return `/(app)/offers/${d.offerId}`;
  if (d.ticketId) return `/(app)/support/chat/${d.ticketId}`;

  return NOTIF_INBOX_ROUTE;
}
