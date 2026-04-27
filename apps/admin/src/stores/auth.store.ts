import { create } from 'zustand';
import { authApi, tokenStore, onAuthFailed } from '@/api/client';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  profile?: { firstName: string; lastName: string; avatarUrl?: string };
}

interface PendingTwoFactor {
  identifier: string;
  expiresAt: number;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  pendingTwoFactor: PendingTwoFactor | null;
  login: (email: string, password: string) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  cancel2FA: () => void;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'];

function unwrap<T = any>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

export const useAuthStore = create<AuthState>((set, get) => {
  onAuthFailed(() => {
    tokenStore.clear();
    set({ user: null, pendingTwoFactor: null });
  });

  return {
    user: null,
    loading: false,
    initialized: false,
    error: null,
    pendingTwoFactor: null,

    login: async (email, password) => {
      set({ loading: true, error: null, pendingTwoFactor: null });
      try {
        const { data } = await authApi.login(email, password);
        const body = unwrap<any>(data);

        if (body?.requires2FA) {
          const expiresIn = Number(body.expiresIn ?? 300);
          set({
            loading: false,
            pendingTwoFactor: {
              identifier: body.identifier ?? email,
              expiresAt: Date.now() + expiresIn * 1000,
            },
          });
          return;
        }

        const { user, tokens } = body;
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

    verify2FA: async (code) => {
      const pending = get().pendingTwoFactor;
      if (!pending) throw new Error('No hay verificación 2FA en curso');
      set({ loading: true, error: null });
      try {
        const { data } = await authApi.verify2FA(pending.identifier, code.trim());
        const { user, tokens } = unwrap<any>(data);
        if (!STAFF_ROLES.includes(user.role)) {
          throw new Error('Esta cuenta no tiene permisos de administrador.');
        }
        tokenStore.set(tokens.accessToken, tokens.refreshToken);
        set({ user, loading: false, pendingTwoFactor: null });
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Código inválido';
        set({ loading: false, error: Array.isArray(msg) ? msg.join(', ') : String(msg) });
        throw err;
      }
    },

    cancel2FA: () => set({ pendingTwoFactor: null, error: null }),

    logout: async () => {
      try { await authApi.logout(); } catch {}
      tokenStore.clear();
      set({ user: null, pendingTwoFactor: null });
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
