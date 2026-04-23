import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Calendar, MapPin, Users } from 'lucide-react';
import { eventsApi } from '@/api/client';

export function EventsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['events', 'admin-list'],
    queryFn: async () => {
      const r = await eventsApi.list({ limit: 100 });
      return r.data?.data?.data ?? r.data?.data ?? [];
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-muted text-sm mt-1">{(data ?? []).length} eventos</p>
        </div>
        <Link to="/admin/events/new" className="btn-primary">
          <Plus size={16} />
          Nuevo evento
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted">Cargando…</p>
      ) : (data ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar size={40} className="mx-auto text-muted mb-3" />
          <p className="text-muted">No hay eventos. Crea el primero.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-elevated">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase tracking-wide px-4 py-3">Título</th>
                <th className="text-left text-xs font-bold text-muted uppercase tracking-wide px-4 py-3">Venue</th>
                <th className="text-left text-xs font-bold text-muted uppercase tracking-wide px-4 py-3">Fecha</th>
                <th className="text-left text-xs font-bold text-muted uppercase tracking-wide px-4 py-3">Cupo</th>
                <th className="text-left text-xs font-bold text-muted uppercase tracking-wide px-4 py-3">Status</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((e: any) => (
                <tr key={e.id} className="hover:bg-elevated/50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm">{e.title}</p>
                    {e.isFree && <span className="pill bg-success/15 text-success">Entrada libre</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                      <MapPin size={12} /> {e.venue?.name ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {e.startDate ? new Date(e.startDate).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                      <Users size={12} /> {e.currentCapacity ?? 0}{e.maxCapacity ? ` / ${e.maxCapacity}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/events/${e.id}`} className="text-accent text-sm font-semibold hover:underline">Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: 'bg-success/15 text-success',
    DRAFT: 'bg-muted/15 text-muted',
    CANCELLED: 'bg-danger/15 text-danger',
    COMPLETED: 'bg-blue-500/15 text-blue-400',
  };
  return <span className={`pill ${map[status] ?? 'bg-muted/15 text-muted'}`}>{status}</span>;
}
