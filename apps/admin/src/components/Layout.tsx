import { useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Tag, MessageSquare, MessagesSquare, Flag, Inbox, Bell, BarChart3, Settings, Shield, LogOut, Home, MapPin, Clock, Activity as ActivityIcon, UserCog, ToggleLeft, ShieldCheck, Award, Film, Star, Megaphone, Tags } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useRealtime } from '@/hooks/useRealtime';
import { useIdleLogout } from '@/hooks/useIdleLogout';
import clsx from 'clsx';

type NavItem = { to: string; label: string; icon: any; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: 'Inicio',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/activity', label: 'Actividad', icon: ActivityIcon },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/admin/events', label: 'Eventos', icon: Calendar },
      { to: '/admin/event-categories', label: 'Categorías eventos', icon: Tags },
      { to: '/admin/offers', label: 'Ofertas', icon: Tag },
      { to: '/admin/reservations', label: 'Reservaciones', icon: Home },
      { to: '/admin/reservations/config', label: 'Config reservas', icon: Settings },
      { to: '/admin/venues', label: 'Venues', icon: MapPin },
    ],
  },
  {
    label: 'Comunidad',
    items: [
      { to: '/admin/community', label: 'Moderación posts', icon: MessageSquare },
      { to: '/admin/stories', label: 'Historias', icon: Film },
      { to: '/admin/reviews', label: 'Reseñas', icon: Star },
      { to: '/admin/messages', label: 'Mensajes DM', icon: MessagesSquare },
      { to: '/admin/reports', label: 'Reportes', icon: Flag },
    ],
  },
  {
    label: 'Comunicación',
    items: [
      { to: '/admin/notifications', label: 'Push broadcast', icon: Bell },
      { to: '/admin/marketing', label: 'Marketing', icon: Megaphone },
      { to: '/admin/support', label: 'Soporte', icon: Inbox },
      { to: '/admin/support/quick-replies', label: 'Plantillas soporte', icon: MessageSquare },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/admin/users', label: 'Usuarios', icon: Users },
      { to: '/admin/staff', label: 'Equipo', icon: UserCog },
      { to: '/admin/loyalty', label: 'Loyalty', icon: Award },
      { to: '/admin/flags', label: 'Feature flags', icon: ToggleLeft },
      { to: '/admin/gdpr', label: 'GDPR', icon: ShieldCheck },
      { to: '/admin/config', label: 'Configuración', icon: Settings },
    ],
  },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  useRealtime(!!user);

  const onIdleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true, state: { idle: true } });
  }, [logout, navigate]);

  const { warning, stayActive } = useIdleLogout(!!user, onIdleLogout);

  return (
    <div className="h-screen flex overflow-hidden">
      <aside className="w-64 shrink-0 bg-zinc-950 border-r border-line flex flex-col">
        <div className="p-5 border-b border-line flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/40 flex items-center justify-center">
            <span className="text-xl font-black text-accent">O</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold">OPALBAR</p>
            <p className="text-[10px] text-muted tracking-wide uppercase">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV.map((group) => (
            <div key={group.label} className="space-y-0.5">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {group.label}
              </p>
              {group.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition',
                      isActive
                        ? 'bg-accent/15 text-accent'
                        : 'text-zinc-400 hover:bg-elevated hover:text-zinc-100',
                    )
                  }
                >
                  <n.icon size={16} strokeWidth={2} />
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-line space-y-2">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-line">
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-xs font-bold text-accent">
                {(user?.profile?.firstName?.[0] ?? user?.email?.[0] ?? 'A').toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <p className="text-sm font-semibold truncate">
                {user?.profile?.firstName ?? user?.email?.split('@')[0]}
              </p>
              <p className="text-[10px] text-muted flex items-center gap-1">
                <Shield size={10} /> {user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-danger hover:bg-danger/10 rounded-xl transition"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {warning && (
        <div className="fixed bottom-6 right-6 z-50 w-80 p-4 rounded-2xl bg-zinc-950 border border-warning/40 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-warning/15 border border-warning/40 flex items-center justify-center shrink-0">
              <Clock className="text-warning" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100">Sesión por expirar</p>
              <p className="text-xs text-muted mt-0.5">
                Cerraremos tu sesión en <span className="text-warning font-bold">{warning.secondsLeft}s</span> por inactividad.
              </p>
              <button
                type="button"
                onClick={stayActive}
                className="mt-3 w-full px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/40 text-accent text-xs font-bold hover:bg-accent/25 transition"
              >
                Sigo aquí
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
