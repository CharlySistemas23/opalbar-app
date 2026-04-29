import { Link } from 'react-router-dom';
import { Settings, Flag, ShieldCheck, Award, UserCog, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader, StatusPill } from '@/components/ui';

const SECTIONS: Array<{
  to: string;
  icon: any;
  title: string;
  desc: string;
  requiresSuper?: boolean;
}> = [
  { to: '/admin/flags', icon: Flag, title: 'Feature flags', desc: 'Encender/apagar features sin redeploy', requiresSuper: true },
  { to: '/admin/loyalty', icon: Award, title: 'Niveles de fidelidad', desc: 'CRUD de niveles, puntos y beneficios' },
  { to: '/admin/staff', icon: UserCog, title: 'Equipo', desc: 'Promover y degradar admins/moderadores', requiresSuper: true },
  { to: '/admin/gdpr', icon: ShieldCheck, title: 'GDPR', desc: 'Solicitudes de exportación y eliminación de datos' },
  { to: '/admin/reservations/config', icon: Settings, title: 'Reservas por venue', desc: 'Horarios, capacidad y disponibilidad' },
  { to: '/admin/event-categories', icon: Flag, title: 'Categorías de eventos', desc: 'CRUD de categorías' },
];

export function Config() {
  const { user } = useAuthStore();
  const isSuper = user?.role === 'SUPER_ADMIN';

  return (
    <div className="page-shell page-shell--scroll">
      <PageHeader
        icon={Settings}
        title="Configuración"
        subtitle="Ajustes globales del sistema · agrupa los paneles de configuración"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECTIONS.map((s) => {
          const blocked = s.requiresSuper && !isSuper;
          return (
            <Link
              key={s.to}
              to={blocked ? '#' : s.to}
              onClick={(e) => blocked && e.preventDefault()}
              className={`card card-hover p-5 flex items-start gap-4 group ${blocked ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20 flex items-center justify-center shrink-0">
                <s.icon size={20} strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold tracking-tight">{s.title}</p>
                  <ArrowRight size={14} className="text-muted group-hover:text-accent group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-muted mt-1">{s.desc}</p>
                {blocked && (
                  <div className="mt-2"><StatusPill status="USER" label="Requiere SUPER_ADMIN" /></div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="card p-5">
        <p className="text-[11px] font-bold text-muted tracking-wider uppercase">Sesión actual</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <div>
            <p className="text-xs text-muted">Email</p>
            <p className="text-sm font-mono mt-0.5">{user?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Rol</p>
            <div className="mt-1"><StatusPill status={user?.role ?? '—'} /></div>
          </div>
          <div>
            <p className="text-xs text-muted">Nombre</p>
            <p className="text-sm mt-0.5">{user?.profile?.firstName ?? '—'} {user?.profile?.lastName ?? ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
