// ─────────────────────────────────────────────
//  OPALBAR API Client
//  Axios instance with JWT interceptors + auto-refresh
// ─────────────────────────────────────────────
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1';

// ── Axios instance ────────────────────────────
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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

// ── Request interceptor — attach access token ─────────────────────
apiClient.interceptors.request.use(
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
apiClient.interceptors.response.use(
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
        return apiClient(originalRequest);
      });
    }

    _isRefreshing = true;

    try {
      const refreshToken = tokenStore.getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token available');

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = data.data.tokens;

      tokenStore.setTokens(accessToken, newRefreshToken);

      // Resolve queued requests
      _refreshQueue.forEach(({ resolve }) => resolve(accessToken));
      _refreshQueue = [];

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Refresh failed — force logout
      tokenStore.clear();
      _refreshQueue.forEach(({ reject }) => reject(refreshError as Error));
      _refreshQueue = [];
      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  },
);

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
  updateProfile: (data: unknown) => apiClient.patch('/users/me/profile', data),
  updateInterests: (data: unknown) => apiClient.patch('/users/me/interests', data),
  updateNotifications: (data: unknown) => apiClient.patch('/users/me/notifications', data),
  updateConsent: (data: unknown) => apiClient.patch('/users/me/consent', data),
  requestExport: () => apiClient.post('/users/me/export'),
  requestDeletion: (reason?: string) => apiClient.delete('/users/me', { data: { reason } }),
};

export const eventsApi = {
  list: (params?: unknown) => apiClient.get('/events', { params }),
  categories: () => apiClient.get('/events/categories'),
  my: () => apiClient.get('/events/my'),
  get: (id: string) => apiClient.get(`/events/${id}`),
  attend: (id: string) => apiClient.post(`/events/${id}/attend`),
  cancelAttendance: (id: string) => apiClient.delete(`/events/${id}/attend`),
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
  createPost: (data: unknown) => apiClient.post('/community/posts', data),
  updatePost: (id: string, data: unknown) => apiClient.patch(`/community/posts/${id}`, data),
  deletePost: (id: string) => apiClient.delete(`/community/posts/${id}`),
  comments: (postId: string) => apiClient.get(`/community/posts/${postId}/comments`),
  comment: (postId: string, data: unknown) => apiClient.post(`/community/posts/${postId}/comments`, data),
  deleteComment: (id: string) => apiClient.delete(`/community/comments/${id}`),
  react: (postId: string, data: unknown) => apiClient.post(`/community/posts/${postId}/react`, data),
  reportPost: (id: string, data: unknown) => apiClient.post(`/community/posts/${id}/report`, data),
  ranking: () => apiClient.get('/community/ranking'),
};

export const walletApi = {
  get: () => apiClient.get('/wallet'),
  transactions: (params?: unknown) => apiClient.get('/wallet/transactions', { params }),
  levels: () => apiClient.get('/wallet/levels'),
};

export const notificationsApi = {
  list: (params?: unknown) => apiClient.get('/notifications', { params }),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  delete: (id: string) => apiClient.delete(`/notifications/${id}`),
};

export const healthApi = {
  check: () => apiClient.get('/health'),
};
