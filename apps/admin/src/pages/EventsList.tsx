import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Calendar, MapPin, Users, Pencil } from 'lucide-react';
import { eventsApi } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, StatusPill, Toolbar, useDebounced,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data?.data ?? p?.data?.data ?? p?.data ?? p) as T;
}

export function EventsList() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);

  const { data, isLoading } = useQuery({
    queryKey: ['events', 'admin-list'],
    queryFn: async () => unwrap<any[]>(await eventsApi.list({ limit: 100 })),
  });

  const events: any[] = Array.isArray(data) ? data : [];
  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e: any) =>
      [e.title, e.venue?.name, e.status].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [events, debounced]);

  return (
    <div className="page-shell">
      <PageHeader
        icon={Calendar}
        title="Eventos"
        subtitle={`${filtered.length} de ${events.length} eventos`}
        actions={
          <Link to="/admin/events/new" className="btn-primary">
            <Plus size={14} /> Nuevo evento
          </Link>
        }
      />

      <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Buscar evento, venue o status…" />

      <div className="card flex-1 overflow-auto">
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={events.length === 0 ? 'No hay eventos' : 'Sin resultados'}
            message={events.length === 0 ? 'Creá tu primer evento para empezar.' : 'Probá con otro término de búsqueda.'}
            action={events.length === 0 ? (
              <Link to="/admin/events/new" className="btn-primary"><Plus size={14} /> Crear evento</Link>
            ) : undefined}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Venue</th>
                <th>Fecha</th>
                <th>Cupo</th>
                <th>Status</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e: any) => (
                <tr key={e.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{e.title}</p>
                      {e.isFree && <span className="pill-success">Free</span>}
                    </div>
                  </td>
                  <td className="text-sm text-zinc-400">
                    <div className="inline-flex items-center gap-1.5">
                      <MapPin size={12} className="text-muted" /> {e.venue?.name ?? '—'}
                    </div>
                  </td>
                  <td className="text-sm text-muted whitespace-nowrap">
                    {e.startDate ? new Date(e.startDate).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="text-sm text-zinc-400">
                    <div className="inline-flex items-center gap-1.5">
                      <Users size={12} className="text-muted" />
                      {e.currentCapacity ?? 0}{e.maxCapacity ? ` / ${e.maxCapacity}` : ''}
                    </div>
                  </td>
                  <td><StatusPill status={e.status} /></td>
                  <td className="text-right">
                    <Link to={`/admin/events/${e.id}`} className="inline-flex items-center gap-1 text-accent text-sm font-semibold hover:underline">
                      <Pencil size={12} /> Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
