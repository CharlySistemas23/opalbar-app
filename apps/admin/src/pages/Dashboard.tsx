import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Calendar, Tag, Flag, Home, MessageSquare, TrendingUp, Inbox,
  Plus, Megaphone, Star, ArrowRight, LayoutDashboard,
} from 'lucide-react';
import { adminApi } from '@/api/client';
import { PageHeader, StatCard, EmptyState, SkeletonRows } from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function Dashboard() {
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => unwrap<any>(await adminApi.stats()),
  });

  const activityQuery = useQuery({
    queryKey: ['admin', 'activity', 'recent'],
    queryFn: async () => unwrap<any[]>(await adminApi.activity(10)),
  });

  const s = statsQuery.data || {};
  const recent: any[] = Array.isArray(activityQuery.data) ? activityQuery.data : [];

  return (
    <div className="page-shell page-shell--scroll">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Vista general del sistema en tiempo real"
      />

      {/* Top row — usage */}
      <section className="space-y-2">
        <h2 className="section-title">Operaciones</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Usuarios" value={statsQuery.isLoading ? '…' : s.totalUsers ?? 0} tone="accent" />
          <StatCard icon={Calendar} label="Eventos activos" value={statsQuery.isLoading ? '…' : s.activeEvents ?? 0} tone="info" />
          <StatCard icon={Tag} label="Ofertas activas" value={statsQuery.isLoading ? '…' : s.activeOffers ?? 0} tone="warning" />
          <StatCard icon={Home} label="Reservas pendientes" value={statsQuery.isLoading ? '…' : s.pendingReservations ?? 0} tone="success" />
        </div>
      </section>

      {/* Bottom row — moderation queue */}
      <section className="space-y-2">
        <h2 className="section-title">En cola de moderación</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={MessageSquare} label="Posts en revisión" value={statsQuery.isLoading ? '…' : s.pendingPosts ?? 0} tone="warning" />
          <StatCard icon={Flag} label="Reportes abiertos" value={statsQuery.isLoading ? '…' : s.openReports ?? 0} tone="danger" />
          <StatCard icon={Inbox} label="Tickets abiertos" value={statsQuery.isLoading ? '…' : s.openTickets ?? 0} tone="info" />
          <StatCard icon={TrendingUp} label="Signups (30d)" value={statsQuery.isLoading ? '…' : s.signupsLast30d ?? 0} tone="success" />
        </div>
      </section>

      {/* Two column: recent activity + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2 space-y-3 min-h-[260px]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">Actividad reciente</h3>
            <Link to="/admin/activity" className="text-xs text-accent font-bold inline-flex items-center gap-1 hover:underline">
              Ver todo <ArrowRight size={12} />
            </Link>
          </div>
          {activityQuery.isLoading ? (
            <SkeletonRows rows={5} height={36} />
          ) : recent.length === 0 ? (
            <EmptyState title="Sin actividad reciente" message="Las acciones del equipo aparecerán acá." />
          ) : (
            <ul className="space-y-1.5">
              {recent.slice(0, 8).map((a: any) => (
                <li key={a.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-elevated/40 transition">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="text-xs text-muted whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-xs font-semibold truncate flex-1">
                    {a.actor?.profile?.firstName || a.actor?.email || '—'}
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-elevated text-muted">
                    {a.action}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold tracking-tight">Acciones rápidas</h3>
          <div className="grid gap-2">
            <Link to="/admin/events/new" className="btn-primary w-full justify-start"><Plus size={14} /> Nuevo evento</Link>
            <Link to="/admin/offers/new" className="btn-ghost w-full justify-start"><Tag size={14} /> Nueva oferta</Link>
            <Link to="/admin/marketing" className="btn-ghost w-full justify-start"><Megaphone size={14} /> Campaña push</Link>
            <Link to="/admin/community" className="btn-ghost w-full justify-start"><MessageSquare size={14} /> Moderar posts</Link>
            <Link to="/admin/reports" className="btn-ghost w-full justify-start"><Flag size={14} /> Ver reportes</Link>
            <Link to="/admin/reviews" className="btn-ghost w-full justify-start"><Star size={14} /> Reseñas pendientes</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
