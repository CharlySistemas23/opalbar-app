import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Tag, MessageSquare, Flag, Inbox, Bell, BarChart3, Settings, Shield, LogOut, Home } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import clsx from 'clsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/events', label: 'Eventos', icon: Calendar },
  { to: '/admin/offers', label: 'Ofertas', icon: Tag },
  { to: '/admin/reservations', label: 'Reservaciones', icon: Home },
  { to: '/admin/community', label: 'Moderación', icon: MessageSquare },
  { to: '/admin/reports', label: 'Reportes', icon: Flag },
  { to: '/admin/support', label: 'Soporte', icon: Inbox },
  { to: '/admin/notifications', label: 'Push', icon: Bell },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/users', label: 'Usuarios', icon: Users },
  { to: '/admin/config', label: 'Configuración', icon: Settings },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
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

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-zinc-400 hover:bg-elevated hover:text-zinc-100',
                )
              }
            >
              <n.icon size={17} strokeWidth={2} />
              {n.label}
            </NavLink>
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
    </div>
  );
}
