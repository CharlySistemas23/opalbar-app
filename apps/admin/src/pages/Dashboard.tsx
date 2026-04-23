import { useQuery } from '@tanstack/react-query';
import { Users, Calendar, Tag, Flag, Home, MessageSquare, TrendingUp, Inbox } from 'lucide-react';
import { adminApi } from '@/api/client';

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const r = await adminApi.stats();
      return r.data?.data ?? r.data;
    },
  });

  const s = data || {};

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted text-sm mt-1">Vista general del sistema</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Usuarios" value={s.totalUsers ?? 0} icon={Users} color="text-accent" loading={isLoading} />
        <Kpi label="Eventos activos" value={s.activeEvents ?? 0} icon={Calendar} color="text-blue-400" loading={isLoading} />
        <Kpi label="Ofertas activas" value={s.activeOffers ?? 0} icon={Tag} color="text-fuchsia-400" loading={isLoading} />
        <Kpi label="Reservas pendientes" value={s.pendingReservations ?? 0} icon={Home} color="text-success" loading={isLoading} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Posts en revisión" value={s.pendingPosts ?? 0} icon={MessageSquare} color="text-amber-400" loading={isLoading} />
        <Kpi label="Reportes abiertos" value={s.openReports ?? 0} icon={Flag} color="text-danger" loading={isLoading} />
        <Kpi label="Tickets abiertos" value={s.openTickets ?? 0} icon={Inbox} color="text-blue-400" loading={isLoading} />
        <Kpi label="Signups (30d)" value={s.signupsLast30d ?? 0} icon={TrendingUp} color="text-success" loading={isLoading} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="font-bold mb-4">Actividad reciente</h3>
          <p className="text-muted text-sm">Se llenará con los últimos eventos/canjes/posts creados.</p>
        </div>
        <div className="card p-6">
          <h3 className="font-bold mb-4">Acciones rápidas</h3>
          <div className="grid grid-cols-2 gap-2">
            <a href="/admin/events/new" className="btn-primary">+ Nuevo evento</a>
            <a href="/admin/offers/new" className="btn-ghost">+ Nueva oferta</a>
            <a href="/admin/community" className="btn-ghost">Moderar posts</a>
            <a href="/admin/reports" className="btn-ghost">Ver reportes</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color, loading }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon size={20} className={color} />
      </div>
      <p className="text-3xl font-extrabold">{loading ? '…' : value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}
