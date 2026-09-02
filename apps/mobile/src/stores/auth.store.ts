// ─────────────────────────────────────────────
//  Auth Store — Zustand
// ─────────────────────────────────────────────
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { apiClient, authApi, usersApi, tokenStore, onAuthFailed, onTokensRefreshed } from '../api/client';
import { apiError } from '../api/errors';
import { closeSocket, updateSocketToken } from '../api/socket';
import { closeRtSocket, getRtSocket, updateRtToken } from '../api/rt-socket';
import { setUser as setErrorReporterUser } from '../lib/error-reporter';
import { useAppStore } from './app.store';

// Cross-platform storage: localStorage on web, AsyncStorage on native
function getPlatformStorage() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage;
    }
    // SSR noop storage
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@react-native-async-storage/async-storage').default;
}

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  points: number;
  isVerified: boolean;
  createdAt?: string;
  profile?: {
    firstName: string;
    lastName: string;
    bio?: string;
    avatarUrl?: string;
    coverUrl?: string;
    language: string;
    loyaltyLevel?: { id?: string; name: string; color: string; icon: string };
  };
  _count?: {
    reservations?: number;
    offerRedemptions?: number;
    followers?: number;
    following?: number;
    posts?: number;
  };
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email?: string;
  phone?: string;
  password: string;
  deviceToken?: string;
  /** e.g. "iPhone 15" — shown in Profile → Sesiones activas. */
  deviceName?: string;
  /** e.g. "iOS 17.4". */
  deviceOs?: string;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGuest: boolean;
  error: string | null;
  sessionExpired: boolean;
  _hasHydrated: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  setTokens: (tokens: AuthTokens) => void;
  completeOtpLogin: (user: AuthUser, tokens: AuthTokens) => void;
  continueAsGuest: () => void;
  clearError: () => void;
  clearSessionExpired: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      isGuest: false,
      error: null,
      sessionExpired: false,
      _hasHydrated: false,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const { data: response } = await authApi.login(credentials);

          if (response?.data?.requires2FA) {
            const es = useAppStore.getState().language !== 'en';
            const msg = es
              ? 'Esta cuenta requiere 2FA. Inicia sesión desde el panel admin web.'
              : 'This account requires 2FA. Sign in from the admin web panel.';
            set({ isLoading: false, error: msg });
            throw new Error(msg);
          }

          // Backend devuelve este flag cuando el usuario se registró pero
          // nunca verificó su email. Lanzamos un Error con shape estable
          // para que la pantalla de login lo detecte y rutee al OTP screen.
          if (response?.data?.requiresEmailVerification) {
            set({ isLoading: false, error: null });
            const verifyErr: any = new Error('EMAIL_NOT_VERIFIED');
            verifyErr.code = 'EMAIL_NOT_VERIFIED';
            verifyErr.identifier = response.data.identifier;
            throw verifyErr;
          }

          const { user, tokens } = response.data;

          // Store tokens in memory (interceptor uses these)
          tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
          // Sincroniza el socket /rt para que NotificationListener reciba
          // banners en tiempo real apenas el usuario entra. Sin esta linea
          // el socket queda con auth vacia → eventos no llegan.
          updateRtToken(tokens.accessToken);
          getRtSocket();

          // Tag client-error reports with the authenticated user so the
          // server-side Sentry inbox correlates by ID (no PII in extras).
          setErrorReporterUser(user.id, user.email);

          set({
            user,
            tokens,
            isAuthenticated: true,
            isGuest: false,
            isLoading: false,
            error: null,
          });
        } catch (err: any) {
          // EMAIL_NOT_VERIFIED is a routing signal, not an error to display —
          // the login screen sends the user to the OTP screen.
          if (err?.code === 'EMAIL_NOT_VERIFIED') {
            set({ isLoading: false, error: null });
            throw err;
          }
          set({ isLoading: false, error: apiError(err) });
          throw err;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        // Unregister push token BEFORE clearing auth state so the API call
        // is still authenticated. Audit ref: P1 #5 (logout cleanup), 2026-05-18.
        try {
          const { pushTokenStore } = await import('../api/push-token-store');
          const token = await pushTokenStore.get();
          if (token) {
            await apiClient.delete('/push/unregister', { data: { token } }).catch(() => {
              /* best-effort — backend has a DeviceNotRegistered sweep anyway */
            });
            await pushTokenStore.clear();
          }
        } catch {
          /* ignore */
        }
        try {
          await authApi.logout();
        } catch {
          // Ignore logout errors — clear local state regardless
        } finally {
          tokenStore.clear();
          closeSocket();
          closeRtSocket();
          setErrorReporterUser(null);
          set({ user: null, tokens: null, isAuthenticated: false, isGuest: false, isLoading: false, error: null });
        }
      },

      setUser: (user) => set({ user }),

      setTokens: (tokens) => {
        tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
        set({ tokens });
      },

      completeOtpLogin: (user, tokens) => {
        tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
        updateRtToken(tokens.accessToken);
        getRtSocket();
        setErrorReporterUser(user.id, user.email);
        set({
          user,
          tokens,
          isAuthenticated: true,
          isGuest: false,
          isLoading: false,
          error: null,
        });
      },

      continueAsGuest: () => {
        set({ isGuest: true, isAuthenticated: false, user: null });
      },

      clearError: () => set({ error: null }),
      clearSessionExpired: () => set({ sessionExpired: false }),

      refreshUser: async () => {
        if (!get().isAuthenticated) return;
        try {
          // /users/me is the rich profile (profile.loyaltyLevel, _count,
          // notificationSettings) — /auth/me is the bare JWT principal.
          const { data: response } = await usersApi.me();
          const fresh = response?.data as AuthUser | undefined;
          if (!fresh?.id) return;
          // Keep error-reporter user context in sync (id/email can change on
          // first profile completion during onboarding).
          setErrorReporterUser(fresh.id, fresh.email);
          set({ user: fresh });
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            // Session is truly dead (refresh already failed inside the
            // interceptor) → drop local state so we stop acting logged-in.
            await get().logout();
            return;
          }
          // Network / 5xx: keep the cached user, callers show their own error.
        }
      },
    }),
    {
      name: 'opalbar-auth',
      storage: createJSONStorage(() => getPlatformStorage()),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
      }),
      onRehydrateStorage: () => (state) => {
        // Restore tokens to memory on app start
        if (state?.tokens) {
          tokenStore.setTokens(state.tokens.accessToken, state.tokens.refreshToken);
          // Pre-arma el socket /rt con el token persistido para que cuando
          // NotificationListener monte, ya este conectado y autenticado.
          updateRtToken(state.tokens.accessToken);
          if (state.isAuthenticated) getRtSocket();
        }
        // Restore error-reporter user context so reports after cold-start are
        // correlated to the rehydrated session.
        if (state?.user?.id && state.isAuthenticated) {
          setErrorReporterUser(state.user.id, state.user.email);
        }
        // Persist rotated tokens so a reload doesn't reuse a spent refresh token
        onTokensRefreshed((accessToken, refreshToken) => {
          const current = useAuthStore.getState().tokens;
          useAuthStore.setState({
            tokens: {
              accessToken,
              refreshToken,
              expiresIn: current?.expiresIn ?? 900,
            },
          });
          // Keep both sockets (legacy + /rt) in sync con el token rotado
          updateSocketToken(accessToken);
          updateRtToken(accessToken);
        });
        // Refresh truly rejected (401/403 from /auth/refresh) → tokens are dead.
        // Clear them so we stop using bad tokens, but DON'T force a redirect.
        // The user stays where they are. Their next authenticated action will
        // fail with `apiError("No pudimos conectar...")` → ErrorState shows
        // a Retry button. If they explicitly log out from Profile, then they
        // navigate to /(auth)/welcome.
        //
        // We never set `sessionExpired = true` automatically. That flag exists
        // for deep-link cases (e.g. server emails a "your session was revoked"
        // link); auto-logout mid-typing is the worst UX.
        onAuthFailed(() => {
          // Tokens are dead. Clear them + socket, but flip user to GUEST mode
          // instead of logged-out. This way SessionGuard sees `hasAccess=true`
          // and stays on the current screen. The user's next authenticated
          // action will fail with a friendly API error (they can then log in
          // manually from Profile). This avoids the "estaba usando la app y
          // de repente me sacó" UX.
          const hadSession = useAuthStore.getState().isAuthenticated;
          tokenStore.clear();
          closeSocket();
          closeRtSocket();
          setErrorReporterUser(null);
          useAuthStore.setState({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isGuest: true, // ← key change: prevents auto-redirect to welcome
            sessionExpired: hadSession,
            error: null,
          });
          // A real session died (refresh token revoked/expired): tell the
          // user instead of silently degrading every action into an error.
          if (hadSession) {
            import('expo-router')
              .then(({ router }) => router.replace('/(auth)/session-expired' as never))
              .catch(() => {});
          }
        });
        // Mark hydration as complete so auth guard can safely navigate
        useAuthStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
