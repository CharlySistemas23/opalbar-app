import { useState, FormEvent, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ShieldCheck, ArrowLeft, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function Login() {
  const { login, verify2FA, cancel2FA, loading, error, pendingTwoFactor } = useAuthStore();
  const location = useLocation();
  const idleNotice = (location.state as { idle?: boolean } | null)?.idle === true;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!pendingTwoFactor) { setSecondsLeft(0); setCode(''); return; }
    const tick = () => {
      const s = Math.max(0, Math.floor((pendingTwoFactor.expiresAt - Date.now()) / 1000));
      setSecondsLeft(s);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pendingTwoFactor]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try { await login(email, password); } catch {}
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    try { await verify2FA(code); } catch {}
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      {!pendingTwoFactor ? (
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

          {idleNotice && !error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30 text-warning text-sm">
              <Clock size={16} className="mt-0.5 shrink-0" />
              <span>Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.</span>
            </div>
          )}

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
      ) : (
        <form onSubmit={onVerify} className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/40 flex items-center justify-center">
              <ShieldCheck className="text-accent" size={28} />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold">Verificación 2FA</h1>
              <p className="text-muted text-sm mt-1">
                Te enviamos un código a <span className="text-zinc-300">{pendingTwoFactor.identifier}</span>
              </p>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-muted tracking-wide uppercase">Código de verificación</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input-field mt-1.5 text-center tracking-[0.5em] text-xl font-mono"
              placeholder="••••••"
            />
            <p className="text-xs text-muted mt-2 text-center">
              {secondsLeft > 0
                ? <>Expira en <span className="text-zinc-300">{minutes}:{seconds}</span></>
                : <span className="text-danger">Código expirado — vuelve a iniciar sesión</span>}
            </p>
          </label>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 6 || secondsLeft === 0}
            className="btn-primary w-full"
          >
            {loading ? 'Verificando…' : 'Verificar e iniciar sesión'}
          </button>

          <button
            type="button"
            onClick={cancel2FA}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted hover:text-zinc-200"
          >
            <ArrowLeft size={14} /> Cancelar y volver
          </button>
        </form>
      )}
    </div>
  );
}
