import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

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
      _queue.forEach((q) => q.resolve(accessToken));
      _queue = [];
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch (e) {
      tokenStore.clear();
      _queue.forEach((q) => q.reject(e as Error));
      _queue = [];
      _onAuthFailed?.();
      return Promise.reject(e);
    } finally { _refreshing = false; }
  },
);

export const authApi = {
  login: (email: string, password: string) => apiClient.post('/auth/login', { email, password }),
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
  banUser: (id: string, reason: string) => apiClient.patch(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id: string) => apiClient.patch(`/admin/users/${id}/unban`),
  deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`),
  updateRole: (id: string, role: string) => apiClient.patch(`/admin/users/${id}/role`, { role }),
  adjustPoints: (id: string, delta: number, reason: string) =>
    apiClient.post(`/admin/users/${id}/points`, { delta, reason }),
  updateNote: (id: string, note: string | null) => apiClient.patch(`/admin/users/${id}/note`, { note }),

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
  toggleFlag: (key: string, enabled: boolean) => apiClient.patch(`/admin/flags/${key}`, { enabled }),

  // Loyalty
  createLoyaltyLevel: (data: any) => apiClient.post('/admin/loyalty-levels', data),
  updateLoyaltyLevel: (id: string, data: any) => apiClient.patch(`/admin/loyalty-levels/${id}`, data),
  deleteLoyaltyLevel: (id: string) => apiClient.delete(`/admin/loyalty-levels/${id}`),

  // GDPR
  gdprRequests: () => apiClient.get('/admin/gdpr/requests'),
  processExport: (id: string, action: 'APPROVE' | 'REJECT') =>
    apiClient.patch(`/admin/gdpr/export/${id}`, { action }),
  processDeletion: (id: string, action: 'APPROVE' | 'REJECT') =>
    apiClient.patch(`/admin/gdpr/deletion/${id}`, { action }),
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

export const venuesApi = {
  list: (params?: any) => apiClient.get('/venues', { params }),
  get: (id: string) => apiClient.get(`/venues/${id}`),
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
