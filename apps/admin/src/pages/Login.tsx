import { useState, FormEvent } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function Login() {
  const { login, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try { await login(email, password); } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/40 flex items-center justify-center">
            <span className="text-3xl font-black text-accent">O</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">OPALBAR Admin</h1>
            <p className="text-muted text-sm mt-1">Panel de administración interno</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-muted tracking-wide uppercase">Email</span>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="admin@opalbar.com"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-muted tracking-wide uppercase">Contraseña</span>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="••••••••"
              />
            </div>
          </label>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Iniciando…' : 'Iniciar sesión'}
        </button>

        <p className="text-center text-xs text-muted">
          Solo cuentas con rol <span className="text-zinc-300">ADMIN · SUPER_ADMIN · MODERATOR</span>
        </p>
      </form>
    </div>
  );
}
