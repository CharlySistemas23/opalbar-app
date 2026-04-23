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
  stats: () => apiClient.get('/admin/stats'),
  users: (params?: any) => apiClient.get('/admin/users', { params }),
  user: (id: string) => apiClient.get(`/admin/users/${id}`),
  banUser: (id: string, reason: string) => apiClient.patch(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id: string) => apiClient.patch(`/admin/users/${id}/unban`),
  posts: (params?: any) => apiClient.get('/admin/posts/pending', { params }),
  approvePost: (id: string) => apiClient.patch(`/admin/posts/${id}/approve`),
  rejectPost: (id: string, reason: string) => apiClient.patch(`/admin/posts/${id}/reject`, { reason }),
  reports: (params?: any) => apiClient.get('/admin/reports', { params }),
  reservations: (params?: any) => apiClient.get('/admin/reservations', { params }),
  updateReservationStatus: (id: string, status: string, internalNotes?: string) =>
    apiClient.patch(`/admin/reservations/${id}/status`, { status, internalNotes }),
  tickets: (params?: any) => apiClient.get('/admin/support/tickets', { params }),
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
  list: (params?: any) => apiClient.get('/offers', { params }),
  get: (id: string) => apiClient.get(`/offers/${id}`),
  create: (data: any) => apiClient.post('/offers', data),
  update: (id: string, data: any) => apiClient.patch(`/offers/${id}`, data),
};

export const venuesApi = {
  list: () => apiClient.get('/venues'),
};

export function apiError(err: any, fallback = 'Algo salió mal'): string {
  if (err?.response?.data?.message) {
    const m = err.response.data.message;
    return Array.isArray(m) ? m.join(', ') : String(m);
  }
  return err?.message || fallback;
}
