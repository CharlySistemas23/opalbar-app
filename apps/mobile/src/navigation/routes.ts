// ─────────────────────────────────────────────
//  Navigation Routes — all route names as constants
// ─────────────────────────────────────────────

export const Routes = {
  // ── Auth Stack ─────────────────────────────
  WELCOME: '/(auth)/welcome',
  LOGIN: '/(auth)/login',
  REGISTER: '/(auth)/register',
  REGISTER_STEP2: '/(auth)/register/step2-interests',
  OTP_EMAIL: '/(auth)/otp-email',
  OTP_PHONE: '/(auth)/otp-phone',
  FORGOT_PASSWORD: '/(auth)/forgot-password',
  NEW_PASSWORD: '/(auth)/new-password',
  REGISTRATION_COMPLETE: '/(auth)/registration-complete',

  // ── Main Tabs ──────────────────────────────
  HOME: '/(tabs)/home',
  EVENTS: '/(tabs)/events',
  BAR: '/(tabs)/bar',
  COMMUNITY: '/(tabs)/community',
  PROFILE: '/(tabs)/profile',

  // ── Offers (stack, not tab) ───────────────
  OFFERS: '/(app)/offers',

  // ── Events ────────────────────────────────
  EVENT_DETAIL: '/(app)/events/[id]',
  EVENT_FILTER: '/(app)/events/filter',

  // ── Offers ────────────────────────────────
  OFFER_DETAIL: '/(app)/offers/[id]',

  // ── Community ─────────────────────────────
  POST_DETAIL: '/(app)/community/posts/[id]',
  NEW_POST: '/(app)/community/new-post',

  // ── Profile ───────────────────────────────
  EDIT_PROFILE: '/(app)/profile/edit',
  WALLET: '/(app)/profile/wallet',
  LOYALTY_LEVELS: '/(app)/profile/loyalty-levels',
  NOTIFICATIONS: '/(app)/profile/notifications',
  NOTIFICATION_SETTINGS: '/(app)/profile/notification-settings',
  ACTIVE_SESSIONS: '/(app)/profile/sessions',
  CHANGE_PASSWORD: '/(app)/profile/change-password',
  CHANGE_EMAIL: '/(app)/profile/change-email',
  CHANGE_PHONE: '/(app)/profile/change-phone',
  PRIVACY_SETTINGS: '/(app)/profile/privacy',
  GDPR: '/(app)/profile/gdpr',
  ABOUT: '/(app)/profile/about',

  // ── Venue ─────────────────────────────────
  VENUE_DETAIL: '/(app)/venue/[id]',

  // ── Reservations ──────────────────────────
  MAKE_RESERVATION: '/(app)/reservations/new',
  MY_RESERVATIONS: '/(app)/reservations/my',
  RESERVATION_DETAIL: '/(app)/reservations/[id]',

  // ── Support ───────────────────────────────
  SUPPORT: '/(app)/support',
  SUPPORT_CHAT: '/(app)/support/chat/[id]',
  NEW_TICKET: '/(app)/support/new-ticket',

  // ── Reviews ───────────────────────────────
  WRITE_REVIEW: '/(app)/venue/[id]/review',
  MY_REVIEWS: '/(app)/profile/my-reviews',

  // ── Guest ─────────────────────────────────
  GUEST_HOME: '/(guest)/home',
} as const;

export type RouteName = (typeof Routes)[keyof typeof Routes];
