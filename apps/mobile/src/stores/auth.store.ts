// ─────────────────────────────────────────────
//  Auth Store — Zustand
// ─────────────────────────────────────────────
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, tokenStore } from '../api/client';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  points: number;
  isVerified: boolean;
  profile?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    language: string;
    loyaltyLevel?: { name: string; color: string; icon: string };
  };
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGuest: boolean;
  error: string | null;

  // Actions
  login: (credentials: { email?: string; phone?: string; password: string; deviceToken?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  setTokens: (tokens: AuthTokens) => void;
  continueAsGuest: () => void;
  clearError: () => void;
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

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const { data: response } = await authApi.login(credentials);
          const { user, tokens } = response.data;

          // Store tokens in memory (interceptor uses these)
          tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);

          set({
            user,
            tokens,
            isAuthenticated: true,
            isGuest: false,
            isLoading: false,
            error: null,
          });
        } catch (err: any) {
          const message = err.response?.data?.message || 'Login failed. Please try again.';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authApi.logout();
        } catch {
          // Ignore logout errors — clear local state regardless
        } finally {
          tokenStore.clear();
          set({ user: null, tokens: null, isAuthenticated: false, isGuest: false, isLoading: false, error: null });
        }
      },

      setUser: (user) => set({ user }),

      setTokens: (tokens) => {
        tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
        set({ tokens });
      },

      continueAsGuest: () => {
        set({ isGuest: true, isAuthenticated: false, user: null });
      },

      clearError: () => set({ error: null }),

      refreshUser: async () => {
        try {
          const { data: response } = await authApi.me();
          set({ user: response.data });
        } catch {
          // Silent fail
        }
      },
    }),
    {
      name: 'opalbar-auth',
      storage: createJSONStorage(() => AsyncStorage),
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
        }
      },
    },
  ),
);
