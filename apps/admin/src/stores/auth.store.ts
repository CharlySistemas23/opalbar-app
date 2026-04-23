import { create } from 'zustand';
import { authApi, tokenStore, onAuthFailed } from '@/api/client';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  profile?: { firstName: string; lastName: string; avatarUrl?: string };
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'];

export const useAuthStore = create<AuthState>((set) => {
  onAuthFailed(() => {
    tokenStore.clear();
    set({ user: null });
  });

  return {
    user: null,
    loading: false,
    initialized: false,
    error: null,

    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        const { data } = await authApi.login(email, password);
        const { user, tokens } = data.data;
        if (!STAFF_ROLES.includes(user.role)) {
          throw new Error('Esta cuenta no tiene permisos de administrador.');
        }
        tokenStore.set(tokens.accessToken, tokens.refreshToken);
        set({ user, loading: false });
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Error al iniciar sesión';
        set({ loading: false, error: Array.isArray(msg) ? msg.join(', ') : String(msg) });
        throw err;
      }
    },

    logout: async () => {
      try { await authApi.logout(); } catch {}
      tokenStore.clear();
      set({ user: null });
    },

    restore: async () => {
      if (!tokenStore.access) { set({ initialized: true }); return; }
      try {
        const { data } = await authApi.me();
        const user = data?.data ?? data;
        if (STAFF_ROLES.includes(user?.role)) set({ user });
        else tokenStore.clear();
      } catch {
        tokenStore.clear();
      } finally {
        set({ initialized: true });
      }
    },
  };
});
