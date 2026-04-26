// ─────────────────────────────────────────────
//  OPALBAR API Client
//  Axios instance with JWT interceptors + auto-refresh
// ─────────────────────────────────────────────
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// In release/OTA builds __DEV__ is false. If EXPO_PUBLIC_API_URL didn't make
// it into the bundle (e.g. local .env pointing to a LAN IP leaked into an
// eas update), fall back to production Railway so the app still works.
const PROD_API = 'https://opalbar-app-production.up.railway.app/api/v1';
const DEV_API = 'http://localhost:3000/api/v1';
const ENV_URL = process.env['EXPO_PUBLIC_API_URL'];
const isLanUrl = typeof ENV_URL === 'string' && /^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/.test(ENV_URL);
const BASE_URL = ENV_URL && !(!__DEV__ && isLanUrl) ? ENV_URL : (__DEV__ ? DEV_API : PROD_API);

// ── Axios instance ────────────────────────────
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 12000, // fail fast on unstable tunnels; upload client handles long operations
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Upload client con timeout más largo para imágenes ────────────────────────
export const apiClientUpload = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60 segundos para uploads de imágenes (base64 large)
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Token storage (replace with SecureStore in production) ──────
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _isRefreshing = false;
let _refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = [];

export const tokenStore = {
  setTokens(access: string, refresh: string) {
    _accessToken = access;
    _refreshToken = refresh;
  },
  getAccessToken() { return _accessToken; },
  getRefreshToken() { return _refreshToken; },
  clear() { _accessToken = null; _refreshToken = null; },
};

// Hook that the auth store can register to know when refresh fails
let _onAuthFailed: (() => void) | null = null;
export function onAuthFailed(cb: () => void) { _onAuthFailed = cb; }

// Hook that the auth store can register to persist rotated tokens
let _onTokensRefreshed: ((accessToken: string, refreshToken: string) => void) | null = null;
export function onTokensRefreshed(cb: (accessToken: string, refreshToken: string) => void) {
  _onTokensRefreshed = cb;
}

// ── Setup interceptors function ─────────────────────
function setupInterceptors(client: typeof apiClient) {
  // ── Request interceptor — attach access token ─────────────────────
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = tokenStore.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // ── Response interceptor — auto-refresh on 401 ─────────────────────
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (_isRefreshing) {
        // Queue this request until refresh completes
        return new Promise<string>((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      _isRefreshing = true;

      try {
        const refreshToken = tokenStore.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        // Backend wraps responses in { data: ... }. The refresh endpoint returns
        // tokens at the root (flat), while login nests them under `.tokens`.
        // Support both shapes so we don't crash on one-off endpoint differences.
        const payload = data?.data ?? data ?? {};
        const tokens = payload.tokens ?? payload;
        const accessToken = tokens?.accessToken;
        const newRefreshToken = tokens?.refreshToken;
        if (!accessToken || !newRefreshToken) {
          throw new Error('Refresh response missing tokens');
        }

        tokenStore.setTokens(accessToken, newRefreshToken);
        _onTokensRefreshed?.(accessToken, newRefreshToken);

        // Resolve queued requests
        _refreshQueue.forEach(({ resolve }) => resolve(accessToken));
        _refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        const refreshErr = refreshError as AxiosError;
        const refreshStatus = refreshErr.response?.status;
        const refreshTokenInvalid =
          refreshStatus === 401 ||
          refreshStatus === 403 ||
          (refreshErr as Error).message === 'No refresh token available';

        if (refreshTokenInvalid) {
          tokenStore.clear();
          _refreshQueue.forEach(({ reject }) => reject(refreshErr as Error));
          _refreshQueue = [];
          _onAuthFailed?.();
        } else {
          _refreshQueue.forEach(({ reject }) => reject(refreshErr as Error));
          _refreshQueue = [];
        }
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    },
  );
}

// ── Setup interceptors for both clients ─────────────────────
setupInterceptors(apiClient);
setupInterceptors(apiClientUpload);

// ── API modules ──────────────────────────────
export const authApi = {
  register: (data: unknown) => apiClient.post('/auth/register', data),
  login: (data: unknown) => apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
  logoutAll: () => apiClient.post('/auth/logout-all'),
  me: () => apiClient.get('/auth/me'),
  changePassword: (data: unknown) => apiClient.post('/auth/change-password', data),
  sessions: () => apiClient.get('/auth/sessions'),
  revokeSession: (id: string) => apiClient.delete(`/auth/sessions/${id}`),
};

export const otpApi = {
  send: (data: unknown) => apiClient.post('/otp/send', data),
  verify: (data: unknown) => apiClient.post('/otp/verify', data),
};

export const usersApi = {
  me: () => apiClient.get('/users/me'),
  updateProfile: (data: unknown) => apiClientUpload.patch('/users/me/profile', data),
  updateInterests: (data: unknown) => apiClient.patch('/users/me/interests', data),
  updatePrivacy: (data: unknown) => apiClient.patch('/users/me/consent', data),
  updateNotifications: (data: unknown) => apiClient.patch('/users/me/notifications', data),
  updateDmPolicy: (
    policy: 'EVERYONE' | 'FOLLOWING' | 'FRIENDS_OF_FRIENDS' | 'FRIENDS_ONLY' | 'NONE',
  ) => apiClient.patch('/users/me/dm-policy', { policy }),
  updateConsent: (data: unknown) => apiClient.patch('/users/me/consent', data),
  exportData: () => apiClient.post('/users/me/export'),
  deleteAccount: (reason?: string) => apiClient.delete('/users/me', { data: { reason } }),

  // Search & profiles
  search: (q: string, limit = 20) => apiClient.get('/users/search', { params: { q, limit } }),
  getPublic: (id: string) => apiClient.get(`/users/${id}`),

  // Follows
  followers: (id: string) => apiClient.get(`/users/${id}/followers`),
  following: (id: string) => apiClient.get(`/users/${id}/following`),
  follow: (id: string) => apiClient.post(`/users/${id}/follow`),
  unfollow: (id: string) => apiClient.delete(`/users/${id}/follow`),

  // Saved
  savedItems: (type?: string) => apiClient.get('/users/me/saved', { params: type ? { type } : {} }),
  toggleSave: (type: string, targetId: string) =>
    apiClient.post('/users/me/saved', { type, targetId }),
};

// Friendships (FB/IG hybrid)
export type FriendPolicy = 'EVERYONE' | 'FRIENDS_OF_FRIENDS' | 'NONE';
export type MentionPolicy = 'EVERYONE' | 'FRIENDS_OF_FRIENDS' | 'FRIENDS_ONLY' | 'NONE';
export type MentionInput = { userId: string; x?: number | null; y?: number | null };
export type MentionTargetType = 'POST' | 'STORY';
export type MentionStatus = 'APPROVED' | 'PENDING' | 'REJECTED';
export type FriendshipState =
  | 'self'
  | 'none'
  | 'outgoing'
  | 'incoming'
  | 'accepted'
  | 'blocked';

export const friendshipsApi = {
  list: (limit = 100) => apiClient.get('/friendships', { params: { limit } }),
  requests: (tab: 'main' | 'filtered' = 'main', limit = 50) =>
    apiClient.get('/friendships/requests', { params: { tab, limit } }),
  requestsCounts: () => apiClient.get('/friendships/requests/counts'),
  outgoing: (limit = 50) => apiClient.get('/friendships/outgoing', { params: { limit } }),
  request: (userId: string) => apiClient.post(`/friendships/request/${userId}`),
  accept: (friendshipId: string) => apiClient.post(`/friendships/${friendshipId}/accept`),
  decline: (friendshipId: string) => apiClient.post(`/friendships/${friendshipId}/decline`),
  cancel: (userId: string) => apiClient.delete(`/friendships/request/${userId}`),
  remove: (userId: string) => apiClient.delete(`/friendships/${userId}`),
  updatePolicy: (policy: FriendPolicy) =>
    apiClient.patch('/friendships/me/policy', { policy }),
};

// Mentions / tagging
export const mentionsApi = {
  pending: (limit = 50) => apiClient.get('/mentions/pending', { params: { limit } }),
  pendingCount: () => apiClient.get('/mentions/pending/count'),
  approve: (id: string) => apiClient.post(`/mentions/${id}/approve`),
  reject: (id: string) => apiClient.post(`/mentions/${id}/reject`),
  remove: (id: string) => apiClient.delete(`/mentions/${id}`),
  tagged: (userId: string, limit = 30) =>
    apiClient.get(`/mentions/tagged/${userId}`, { params: { limit } }),
  forTarget: (targetType: MentionTargetType, targetId: string) =>
    apiClient.get(`/mentions/target/${targetType}/${targetId}`),
  updatePolicy: (policy: MentionPolicy) =>
    apiClient.patch('/mentions/me/policy', { policy }),
};

// Messaging
export const messagesApi = {
  threads: () => apiClient.get('/messages/threads'),
  createThread: (userId: string) => apiClient.post('/messages/threads', { userId }),
  thread: (id: string) => apiClient.get(`/messages/threads/${id}`),
  messages: (id: string, params?: { cursor?: string; limit?: number }) =>
    apiClient.get(`/messages/threads/${id}/messages`, { params }),
  send: (
    id: string,
    payload:
      | {
          content?: string;
          imageUrl?: string;
          stickerKey?: string;
          audioUrl?: string;
          audioDurationSec?: number;
          replyToId?: string;
        }
      | string,
  ) =>
    apiClient.post(
      `/messages/threads/${id}/messages`,
      typeof payload === 'string' ? { content: payload } : payload,
    ),
  deleteMessage: (messageId: string) => apiClient.delete(`/messages/${messageId}`),
  react: (messageId: string, emoji: string) =>
    apiClient.post(`/messages/${messageId}/react`, { emoji }),
  unreact: (messageId: string, emoji: string) =>
    apiClient.delete(`/messages/${messageId}/react/${encodeURIComponent(emoji)}`),
  // Message requests (IG/FB hybrid)
  requests: () => apiClient.get('/messages/requests'),
  requestsCount: () => apiClient.get('/messages/requests/count'),
  acceptRequest: (id: string) => apiClient.post(`/messages/requests/${id}/accept`),
  declineRequest: (id: string) => apiClient.post(`/messages/requests/${id}/decline`),
  blockRequest: (id: string) => apiClient.post(`/messages/requests/${id}/block`),
};

export const eventsApi = {
  list: (params?: unknown) => apiClient.get('/events', { params }),
  categories: () => apiClient.get('/events/categories'),
  my: () => apiClient.get('/events/my'),
  get: (id: string) => apiClient.get(`/events/${id}`),
  attend: (id: string) => apiClient.post(`/events/${id}/attend`),
  cancelAttendance: (id: string) => apiClient.delete(`/events/${id}/attend`),
  attendees: (id: string) => apiClient.get(`/events/${id}/attendees`),
};

export const offersApi = {
  list: (params?: unknown) => apiClient.get('/offers', { params }),
  get: (id: string) => apiClient.get(`/offers/${id}`),
  redeem: (id: string) => apiClient.post(`/offers/${id}/redeem`),
  myRedemptions: () => apiClient.get('/offers/my'),
};

export const communityApi = {
  posts: (params?: unknown) => apiClient.get('/community/posts', { params }),
  post: (id: string) => apiClient.get(`/community/posts/${id}`),
  createPost: (data: unknown) => apiClientUpload.post('/community/posts', data),
  updatePost: (id: string, data: unknown) => apiClientUpload.patch(`/community/posts/${id}`, data),
  deletePost: (id: string) => apiClient.delete(`/community/posts/${id}`),
  comments: (postId: string) => apiClient.get(`/community/posts/${postId}/comments`),
  addComment: (postId: string, data: unknown) => apiClient.post(`/community/posts/${postId}/comments`, data),
  deleteComment: (id: string) => apiClient.delete(`/community/comments/${id}`),
  likeComment: (id: string) => apiClient.post(`/community/comments/${id}/like`),
  reportComment: (id: string, data: unknown) => apiClient.post(`/community/comments/${id}/report`, data),
  react: (postId: string, type: string) => apiClient.post(`/community/posts/${postId}/react`, { type }),
  // Backend's react endpoint toggles when called with the same type again —
  // sending the same type twice is how we "remove" a reaction.
  removeReaction: (postId: string) => apiClient.post(`/community/posts/${postId}/react`, { type: 'LIKE' }),
  reportPost: (id: string, data: unknown) => apiClient.post(`/community/posts/${id}/report`, data),
  ranking: () => apiClient.get('/community/ranking'),
  // Stories
  stories: (scope?: 'forYou' | 'following') =>
    apiClient.get('/community/stories', { params: scope ? { scope } : {} }),
  userStories: (userId: string) => apiClient.get(`/community/users/${userId}/stories`),
  createStory: (data: { mediaUrl: string; caption?: string; mentions?: MentionInput[] }) =>
    apiClientUpload.post('/community/stories', data),
  deleteStory: (id: string) => apiClient.delete(`/community/stories/${id}`),
  viewStory: (id: string) => apiClient.post(`/community/stories/${id}/view`),
};

export const walletApi = {
  wallet: () => apiClient.get('/wallet'),
  transactions: (params?: unknown) => apiClient.get('/wallet/transactions', { params }),
  levels: () => apiClient.get('/wallet/levels'),
};

// Loyalty endpoints live under /wallet on the backend. These aliases exist
// for readability in the loyalty admin screens.
export const loyaltyApi = {
  levels: () => apiClient.get('/wallet/levels'),
  myProgress: () => apiClient.get('/wallet'),
};

export const notificationsApi = {
  list: (params?: unknown) => apiClient.get('/notifications', { params }),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  updateSettings: (data: unknown) => apiClient.patch('/notifications/settings', data),
  delete: (id: string) => apiClient.delete(`/notifications/${id}`),
};

export const venueApi = {
  list: (params?: unknown) => apiClient.get('/venues', { params }),
  get: (id: string) => apiClient.get(`/venues/${id}`),
  updateConfig: (id: string, data: {
    openTime?: string; closeTime?: string;
    reservationCapacity?: number; reservationsEnabled?: boolean; slotMinutes?: number;
  }) => apiClient.patch(`/venues/${id}/config`, data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/venues/${id}`, data),
};

export const reservationsApi = {
  create: (data: unknown) => apiClient.post('/reservations', data),
  my: () => apiClient.get('/reservations/my'),
  get: (id: string) => apiClient.get(`/reservations/${id}`),
  detail: (id: string) => apiClient.get(`/reservations/${id}`),
  modify: (id: string, data: { date?: string; partySize?: number; notes?: string }) =>
    apiClient.patch(`/reservations/${id}`, data),
  cancel: (id: string) => apiClient.delete(`/reservations/${id}`),
};

export const checkinApi = {
  lookupReservation: (code: string) => apiClient.get(`/checkin/lookup/reservation/${code}`),
  lookupRedemption: (code: string) => apiClient.get(`/checkin/lookup/redemption/${code}`),
  checkinReservation: (code: string) => apiClient.post('/checkin/reservation', { code }),
  checkinRedemption: (code: string) => apiClient.post('/checkin/redemption', { code }),
};

export const supportApi = {
  createTicket: (data: unknown) => apiClient.post('/support/tickets', data),
  myTickets: () => apiClient.get('/support/tickets/my'),
  messages: (ticketId: string) => apiClient.get(`/support/tickets/${ticketId}/messages`),
  sendMessage: (ticketId: string, data: unknown) => apiClient.post(`/support/tickets/${ticketId}/messages`, data),
  quickReplies: () => apiClient.get('/support/quick-replies'),
};

export const reviewsApi = {
  create: (data: unknown) => apiClient.post('/reviews', data),
  byVenue: (venueId: string) => apiClient.get(`/reviews/venue/${venueId}`),
  venueSummary: (venueId: string) => apiClient.get(`/reviews/venue/${venueId}/summary`),
  my: () => apiClient.get('/reviews/my'),
  update: (id: string, data: unknown) => apiClient.patch(`/reviews/${id}`, data),
  delete: (id: string) => apiClient.delete(`/reviews/${id}`),
};

export const healthApi = {
  check: () => apiClient.get('/health'),
};

export const adminApi = {
  stats: () => apiClient.get('/admin/stats'),
  activity: (limit = 50) => apiClient.get('/admin/activity', { params: { limit } }),
  inbox: (limit = 50) => apiClient.get('/admin/inbox', { params: { limit } }),
  inboxCounts: () => apiClient.get('/admin/inbox/counts'),
  gdprRequests: () => apiClient.get('/admin/gdpr/requests'),
  processExport: (id: string, action: 'APPROVE' | 'REJECT') =>
    apiClient.patch(`/admin/gdpr/export/${id}`, { action }),
  processDeletion: (id: string, action: 'APPROVE' | 'REJECT') =>
    apiClient.patch(`/admin/gdpr/deletion/${id}`, { action }),
  users: (params?: any) => apiClient.get('/admin/users', { params }),
  user: (id: string) => apiClient.get(`/admin/users/${id}`),
  banUser: (id: string, reason: string) => apiClient.patch(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id: string) => apiClient.patch(`/admin/users/${id}/unban`),
  updateUserRole: (id: string, role: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN') =>
    apiClient.patch(`/admin/users/${id}/role`, { role }),
  adjustUserPoints: (id: string, delta: number, reason: string) =>
    apiClient.post(`/admin/users/${id}/points`, { delta, reason }),
  deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`),
  updateUserNote: (id: string, note: string | null) =>
    apiClient.patch(`/admin/users/${id}/note`, { note }),
  userAudit: (id: string, limit = 50) =>
    apiClient.get(`/admin/users/${id}/audit`, { params: { limit } }),
  audienceInsights: () => apiClient.get('/admin/insights/audience'),
  createLoyaltyLevel: (data: any) => apiClient.post('/admin/loyalty-levels', data),
  updateLoyaltyLevel: (id: string, data: any) => apiClient.patch(`/admin/loyalty-levels/${id}`, data),
  deleteLoyaltyLevel: (id: string) => apiClient.delete(`/admin/loyalty-levels/${id}`),
  featureFlags: () => apiClient.get('/admin/flags'),
  updateFeatureFlag: (key: string, enabled: boolean) =>
    apiClient.patch(`/admin/flags/${key}`, { enabled }),
  pendingPosts: (params?: any) => apiClient.get('/admin/posts/pending', { params }),
  approvePost: (id: string) => apiClient.patch(`/admin/posts/${id}/approve`),
  rejectPost: (id: string, reason: string) => apiClient.patch(`/admin/posts/${id}/reject`, { reason }),
  bulkApprovePosts: (ids: string[]) => apiClient.post('/admin/posts/bulk/approve', { ids }),
  bulkRejectPosts: (ids: string[], reason?: string) => apiClient.post('/admin/posts/bulk/reject', { ids, reason }),
  reports: (params?: any) => apiClient.get('/admin/reports', { params }),
  reportDetail: (id: string) => apiClient.get(`/admin/reports/${id}`),
  resolveReport: (id: string, status = 'RESOLVED') => apiClient.patch(`/admin/reports/${id}/resolve`, { status }),
  reservations: (params?: any) => apiClient.get('/admin/reservations', { params }),
  updateReservationStatus: (id: string, status: string, internalNotes?: string) =>
    apiClient.patch(`/admin/reservations/${id}/status`, { status, internalNotes }),
  tickets: (params?: any) => apiClient.get('/admin/support/tickets', { params }),
  quickReplies: () => apiClient.get('/admin/support/quick-replies'),
  createQuickReply: (data: { title: string; body: string; category?: string }) =>
    apiClient.post('/admin/support/quick-replies', data),
  updateQuickReply: (id: string, data: any) =>
    apiClient.patch(`/admin/support/quick-replies/${id}`, data),
  deleteQuickReply: (id: string) =>
    apiClient.delete(`/admin/support/quick-replies/${id}`),
  reviews: (params?: any) => apiClient.get('/admin/reviews', { params }),
  moderateReview: (id: string, status: string, reason?: string) =>
    apiClient.patch(`/admin/reviews/${id}/moderate`, { status, reason }),
  sendBroadcast: (data: { title: string; body: string; audience: 'ALL' | 'ADMINS' }) =>
    apiClient.post('/admin/notifications/broadcast', data),
  allThreads: (search?: string) =>
    apiClient.get('/admin/messages/threads', { params: { search, limit: 100 } }),
  threadDetail: (id: string) => apiClient.get(`/admin/messages/threads/${id}`),
  threadMessages: (id: string) => apiClient.get(`/admin/messages/threads/${id}/messages`),
  deleteMessage: (messageId: string) => apiClient.delete(`/admin/messages/${messageId}`),
  createEvent: (data: unknown) => apiClient.post('/events', data),
  updateEvent: (id: string, data: unknown) => apiClient.patch(`/events/${id}`, data),
  deleteEvent: (id: string) => apiClient.delete(`/events/${id}`),
  createCategory: (data: { name: string; nameEn?: string; icon?: string; color?: string }) =>
    apiClient.post('/events/categories', data),
  deleteCategory: (id: string, hard = false) =>
    apiClient.delete(`/events/categories/${id}`, { params: hard ? { hard: 'true' } : {} }),
  allCategories: () => apiClient.get('/events/categories', { params: { includeArchived: 'true' } }),
  restoreCategory: (id: string) => apiClient.post(`/events/categories/${id}/restore`),
  createOffer: (data: unknown) => apiClient.post('/offers', data),
  updateOffer: (id: string, data: unknown) => apiClient.patch(`/offers/${id}`, data),
  deleteOffer: (id: string) => apiClient.delete(`/offers/${id}`),

  // ── Venue stories (OPAL BAR PV) ──────────────────
  venueStories: {
    list: () => apiClient.get('/admin/community/stories'),
    create: (data: { mediaUrl: string; caption?: string }) =>
      apiClientUpload.post('/admin/community/stories', data),
  },

  // ── Email Marketing ─────────────────────────────
  marketing: {
    templates: () => apiClient.get('/admin/marketing/templates'),
    preview: (data: unknown) => apiClient.post('/admin/marketing/preview', data),
    audienceCount: (data: unknown) => apiClient.post('/admin/marketing/audience-count', data),
    listCampaigns: () => apiClient.get('/admin/marketing/campaigns'),
    createCampaign: (data: unknown) => apiClient.post('/admin/marketing/campaigns', data),
    campaign: (id: string) => apiClient.get(`/admin/marketing/campaigns/${id}`),
    sendNow: (id: string) => apiClient.post(`/admin/marketing/campaigns/${id}/send`),
    cancel: (id: string) => apiClient.patch(`/admin/marketing/campaigns/${id}/cancel`),
    delete: (id: string) => apiClient.delete(`/admin/marketing/campaigns/${id}`),
    uploadAsset: (dataUrl: string) =>
      apiClientUpload.post('/admin/marketing/assets', { dataUrl }),
  },
};
