import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { closeRtSocket, refreshRtToken } from './rt-socket';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

let _access: string | null = null;
let _refresh: string | null = null;

export const tokenStore = {
  set(a: string, r: string) {
    _access = a;
    _refresh = r;
    localStorage.setItem('opalbar_admin_access', a);
    localStorage.setItem('opalbar_admin_refresh', r);
  },
  load() {
    _access = localStorage.getItem('opalbar_admin_access');
    _refresh = localStorage.getItem('opalbar_admin_refresh');
  },
  clear() {
    _access = null;
    _refresh = null;
    localStorage.removeItem('opalbar_admin_access');
    localStorage.removeItem('opalbar_admin_refresh');
  },
  get access() { return _access; },
  get refresh() { return _refresh; },
};
tokenStore.load();

let _onAuthFailed: (() => void) | null = null;
export const onAuthFailed = (cb: () => void) => { _onAuthFailed = cb; };

let _refreshing = false;
let _queue: { resolve: (t: string) => void; reject: (e: Error) => void }[] = [];

apiClient.interceptors.request.use((cfg) => {
  if (_access) cfg.headers.Authorization = `Bearer ${_access}`;
  return cfg;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);
    original._retry = true;

    if (_refreshing) {
      return new Promise<string>((resolve, reject) => _queue.push({ resolve, reject }))
        .then((t) => { original.headers.Authorization = `Bearer ${t}`; return apiClient(original); });
    }

    _refreshing = true;
    try {
      if (!_refresh) throw new Error('no refresh');
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: _refresh });
      const { accessToken, refreshToken } = data.data.tokens;
      tokenStore.set(accessToken, refreshToken);
      // Audit fix: el socket /rt nunca se sincronizaba en el admin web tras
      // un refresh — el socket se quedaba con el token viejo (expirado) y el
      // server lo rechazaba en el siguiente reconnect, dejando al admin sin
      // notificaciones realtime hasta que recargara la pagina manualmente.
      refreshRtToken();
      _queue.forEach((q) => q.resolve(accessToken));
      _queue = [];
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch (e) {
      tokenStore.clear();
      // Si el refresh falla del todo (sesion muerta), tambien cerramos el
      // socket /rt para no dejar conexiones zombies.
      closeRtSocket();
      _queue.forEach((q) => q.reject(e as Error));
      _queue = [];
      _onAuthFailed?.();
      return Promise.reject(e);
    } finally { _refreshing = false; }
  },
);

export const authApi = {
  login: (email: string, password: string) => apiClient.post('/auth/login', { email, password }),
  verify2FA: (identifier: string, code: string) =>
    apiClient.post('/auth/login/2fa', { identifier, code }),
  me: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
};

export const adminApi = {
  // Dashboard / insights
  stats: () => apiClient.get('/admin/stats'),
  activity: (limit = 50) => apiClient.get('/admin/activity', { params: { limit } }),
  inbox: (limit = 50) => apiClient.get('/admin/inbox', { params: { limit } }),
  inboxCounts: () => apiClient.get('/admin/inbox/counts'),
  audienceInsights: () => apiClient.get('/admin/insights/audience'),

  // Users
  users: (params?: any) => apiClient.get('/admin/users', { params }),
  user: (id: string) => apiClient.get(`/admin/users/${id}`),
  userAudit: (id: string, limit = 50) => apiClient.get(`/admin/users/${id}/audit`, { params: { limit } }),
  createUser: (data: { email: string; firstName?: string; lastName?: string; role?: string; phone?: string }) =>
    apiClient.post('/admin/users', data),
  resetUserPassword: (id: string) => apiClient.post(`/admin/users/${id}/reset-password`),
  resendUserVerification: (id: string) => apiClient.post(`/admin/users/${id}/resend-verification`),
  banUser: (id: string, reason: string) => apiClient.patch(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id: string) => apiClient.patch(`/admin/users/${id}/unban`),
  deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`),
  updateRole: (id: string, role: string) => apiClient.patch(`/admin/users/${id}/role`, { role }),
  adjustPoints: (id: string, delta: number, reason: string) =>
    apiClient.post(`/admin/users/${id}/points`, { delta, reason }),
  updateNote: (id: string, note: string | null) => apiClient.patch(`/admin/users/${id}/note`, { note }),
  // Reservations admin-create + pin
  createReservation: (data: { userId: string; venueId: string; date: string; timeSlot: string; partySize: number; notes?: string; internalNotes?: string }) =>
    apiClient.post('/admin/reservations', data),
  pinPost: (id: string, pinned: boolean) => apiClient.patch(`/admin/posts/${id}/pin`, { pinned }),
  // Tanda 2: tickets · reviews · messages · events
  createTicketForUser: (data: { userId: string; subject: string; description: string; priority?: string; category?: string }) =>
    apiClient.post('/admin/support/tickets', data),
  hardDeleteReview: (id: string) => apiClient.delete(`/admin/reviews/${id}`),
  sendMessageAsAdmin: (data: { userId: string; content: string }) =>
    apiClient.post('/admin/messages/send', data),
  duplicateEvent: (id: string) => apiClient.post(`/admin/events/${id}/duplicate`),
  // Tanda 3: sessions · broadcasts history · bulk reviews · venue blocks
  listUserSessions: (id: string) => apiClient.get(`/admin/users/${id}/sessions`),
  revokeUserSession: (id: string, sessionId: string) =>
    apiClient.post(`/admin/users/${id}/sessions/${sessionId}/revoke`),
  revokeAllUserSessions: (id: string) =>
    apiClient.post(`/admin/users/${id}/sessions/revoke-all`),
  listBroadcasts: () => apiClient.get('/admin/notifications/broadcasts'),
  bulkDeleteReviews: (ids: string[]) =>
    apiClient.post('/admin/reviews/bulk-delete', { ids }),
  listVenueBlocks: (venueId: string) =>
    apiClient.get(`/admin/venues/${venueId}/blocks`),
  createVenueBlock: (venueId: string, data: { startsAt: string; endsAt: string; reason?: string }) =>
    apiClient.post(`/admin/venues/${venueId}/blocks`, data),
  deleteVenueBlock: (venueId: string, blockId: string) =>
    apiClient.delete(`/admin/venues/${venueId}/blocks/${blockId}`),

  // Community moderation
  posts: (params?: any) => apiClient.get('/admin/posts/pending', { params }),
  approvePost: (id: string) => apiClient.patch(`/admin/posts/${id}/approve`),
  rejectPost: (id: string, reason: string) => apiClient.patch(`/admin/posts/${id}/reject`, { reason }),
  bulkApprove: (ids: string[]) => apiClient.post('/admin/posts/bulk/approve', { ids }),
  bulkReject: (ids: string[], reason?: string) => apiClient.post('/admin/posts/bulk/reject', { ids, reason }),

  // Reports
  reports: (params?: any) => apiClient.get('/admin/reports', { params }),
  reportDetail: (id: string) => apiClient.get(`/admin/reports/${id}`),
  resolveReport: (id: string, status: string) => apiClient.patch(`/admin/reports/${id}/resolve`, { status }),

  // Reviews
  reviews: (params?: any) => apiClient.get('/admin/reviews', { params }),
  moderateReview: (id: string, action: 'APPROVED' | 'REJECTED', reason?: string) =>
    apiClient.patch(`/admin/reviews/${id}/moderate`, { status: action, reason }),

  // Reservations
  reservations: (params?: any) => apiClient.get('/admin/reservations', { params }),
  updateReservationStatus: (id: string, status: string, internalNotes?: string) =>
    apiClient.patch(`/admin/reservations/${id}/status`, { status, internalNotes }),

  // Support
  tickets: (params?: any) => apiClient.get('/admin/support/tickets', { params }),
  updateTicket: (id: string, data: { status?: string; priority?: string; assignedToId?: string }) =>
    apiClient.patch(`/admin/support/tickets/${id}`, data),
  ticketMessages: (id: string) => apiClient.get(`/support/tickets/${id}/messages`),
  sendTicketMessage: (id: string, content: string) =>
    apiClient.post(`/support/tickets/${id}/messages`, { content }),
  quickReplies: () => apiClient.get('/admin/support/quick-replies'),
  createQuickReply: (data: { title: string; body: string; category?: string }) =>
    apiClient.post('/admin/support/quick-replies', data),
  updateQuickReply: (id: string, data: any) => apiClient.patch(`/admin/support/quick-replies/${id}`, data),
  deleteQuickReply: (id: string) => apiClient.delete(`/admin/support/quick-replies/${id}`),

  // Push broadcast
  broadcast: (title: string, body: string, audience: 'ALL' | 'ADMINS' = 'ALL') =>
    apiClient.post('/admin/notifications/broadcast', { title, body, audience }),

  // Feature flags
  flags: () => apiClient.get('/admin/flags'),
  createFlag: (data: { key: string; description?: string; enabled?: boolean }) =>
    apiClient.post('/admin/flags', data),
  toggleFlag: (key: string, enabled: boolean) => apiClient.patch(`/admin/flags/${key}`, { enabled }),
  updateFlag: (key: string, data: { enabled?: boolean; description?: string }) =>
    apiClient.patch(`/admin/flags/${key}`, data),
  deleteFlag: (key: string) => apiClient.delete(`/admin/flags/${key}`),

  // Loyalty
  loyaltyLevels: () => apiClient.get('/wallet/levels'),
  createLoyaltyLevel: (data: any) => apiClient.post('/admin/loyalty-levels', data),
  updateLoyaltyLevel: (id: string, data: any) => apiClient.patch(`/admin/loyalty-levels/${id}`, data),
  deleteLoyaltyLevel: (id: string) => apiClient.delete(`/admin/loyalty-levels/${id}`),

  // GDPR
  gdprRequests: () => apiClient.get('/admin/gdpr/requests'),
  processExport: (id: string, action: 'APPROVE' | 'REJECT') =>
    apiClient.patch(`/admin/gdpr/export/${id}`, { action }),
  processDeletion: (id: string, action: 'APPROVE' | 'REJECT') =>
    apiClient.patch(`/admin/gdpr/deletion/${id}`, { action }),

  // Event categories
  allCategories: () => apiClient.get('/events/categories', { params: { includeArchived: 'true' } }),
  createCategory: (data: { name: string; nameEn?: string; icon?: string; color?: string }) =>
    apiClient.post('/events/categories', data),
  deleteCategory: (id: string, hard = false) =>
    apiClient.delete(`/events/categories/${id}`, { params: hard ? { hard: 'true' } : {} }),
  restoreCategory: (id: string) => apiClient.post(`/events/categories/${id}/restore`),

  // Stories moderation (venue + user)
  listStories: () => apiClient.get('/admin/community/stories'),
  createVenueStory: (data: { mediaUrl: string; caption?: string }) =>
    apiClient.post('/admin/community/stories', data),
  deleteStory: (id: string) => apiClient.delete(`/community/stories/${id}`),

  // Marketing campaigns
  marketingTemplates: () => apiClient.get('/admin/marketing/templates'),
  marketingListCampaigns: () => apiClient.get('/admin/marketing/campaigns'),
  marketingCampaign: (id: string) => apiClient.get(`/admin/marketing/campaigns/${id}`),
  marketingCreateCampaign: (data: any) => apiClient.post('/admin/marketing/campaigns', data),
  marketingSendNow: (id: string) => apiClient.post(`/admin/marketing/campaigns/${id}/send`),
  marketingCancelCampaign: (id: string) => apiClient.patch(`/admin/marketing/campaigns/${id}/cancel`),
  marketingDeleteCampaign: (id: string) => apiClient.delete(`/admin/marketing/campaigns/${id}`),
  marketingAudienceCount: (data: any) => apiClient.post('/admin/marketing/audience-count', data),
  marketingUploadAsset: (dataUrl: string) => apiClient.post('/admin/marketing/assets', { dataUrl }),
};

export const eventsApi = {
  list: (params?: any) => apiClient.get('/events', { params }),
  categories: () => apiClient.get('/events/categories'),
  get: (id: string) => apiClient.get(`/events/${id}`),
  create: (data: any) => apiClient.post('/events', data),
  update: (id: string, data: any) => apiClient.patch(`/events/${id}`, data),
  delete: (id: string) => apiClient.delete(`/events/${id}`),
  attendees: (id: string) => apiClient.get(`/events/${id}/attendees`),
};

export const offersApi = {
  list: (params?: any) => apiClient.get('/offers', { params: { ...params, includeAll: true } }),
  get: (id: string) => apiClient.get(`/offers/${id}`),
  create: (data: any) => apiClient.post('/offers', data),
  update: (id: string, data: any) => apiClient.patch(`/offers/${id}`, data),
  delete: (id: string) => apiClient.delete(`/offers/${id}`),
};

export const messagesApi = {
  listThreads: (search?: string, limit = 100) =>
    apiClient.get('/admin/messages/threads', { params: { search: search || undefined, limit } }),
  getThread: (id: string) => apiClient.get(`/admin/messages/threads/${id}`),
  listMessages: (id: string) => apiClient.get(`/admin/messages/threads/${id}/messages`),
  deleteMessage: (id: string) => apiClient.delete(`/admin/messages/${id}`),
};

export const venuesApi = {
  list: (params?: any) => apiClient.get('/venues', { params }),
  get: (id: string) => apiClient.get(`/venues/${id}`),
  create: (data: any) => apiClient.post('/venues', data),
  update: (id: string, data: any) => apiClient.patch(`/venues/${id}`, data),
  updateConfig: (id: string, data: any) => apiClient.patch(`/venues/${id}/config`, data),
};

export function apiError(err: any, fallback = 'Algo salió mal'): string {
  if (err?.response?.data?.message) {
    const m = err.response.data.message;
    return Array.isArray(m) ? m.join(', ') : String(m);
  }
  return err?.message || fallback;
}
