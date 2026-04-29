import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, StatusPill, InlineError,
} from '@/components/ui';

const STATUSES = ['', 'PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function Reservations() {
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reservations', status, date, page],
    queryFn: async () => unwrap<any>(await adminApi.reservations({
      page, limit: 25,
      status: status || undefined,
      date: date || undefined,
    })),
  });

  const update = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      adminApi.updateReservationStatus(id, status, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reservations'] }),
  });

  const reservations: any[] = Array.isArray(data) ? data : (data?.data ?? data ?? []);

  return (
    <div className="page-shell">
      <PageHeader
        icon={Calendar}
        title="Reservaciones"
        subtitle={`${reservations.length} resultados${status ? ` · ${status}` : ''}${date ? ` · ${date}` : ''}`}
      />

      <div className="toolbar">
        <select
          title="Filtrar por estado"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-card border border-line rounded-lg px-3 py-2 text-sm focus:border-accent/60 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="date"
          aria-label="Fecha"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
          className="bg-card border border-line rounded-lg px-3 py-2 text-sm focus:border-accent/60 focus:outline-none"
        />
        {date && (
          <button type="button" onClick={() => setDate('')} className="btn-ghost py-1.5 text-xs">Limpiar fecha</button>
        )}
      </div>

      <InlineError message={update.error ? apiError(update.error) : null} />

      <div className="card flex-1 overflow-auto">
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : reservations.length === 0 ? (
          <EmptyState icon={Calendar} title="Sin reservaciones" message="No hay reservaciones que coincidan con los filtros." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Venue</th>
                <th>Fecha</th>
                <th>Personas</th>
                <th>Status</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <p className="text-sm font-bold">{r.user?.profile?.firstName ?? ''} {r.user?.profile?.lastName ?? ''}</p>
                    <p className="text-[11px] text-muted">{r.user?.email}</p>
                  </td>
                  <td className="text-sm">{r.venue?.name ?? '—'}</td>
                  <td className="text-sm whitespace-nowrap">
                    {r.date ? new Date(r.date).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '—'}
                    {r.timeSlot && <span className="text-muted ml-1.5">{r.timeSlot}</span>}
                  </td>
                  <td className="text-sm">{r.partySize}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td className="text-right whitespace-nowrap">
                    {r.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          onClick={() => update.mutate({ id: r.id, status: 'CONFIRMED' })}
                          className="text-success text-xs font-bold hover:underline inline-flex items-center gap-1 mr-3"
                        >
                          <Check size={12} /> Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => update.mutate({ id: r.id, status: 'CANCELLED' })}
                          className="text-danger text-xs font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <X size={12} /> Rechazar
                        </button>
                      </>
                    )}
                    {r.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        onClick={() => update.mutate({ id: r.id, status: 'SEATED' })}
                        className="text-accent text-xs font-bold hover:underline"
                      >
                        Marcar sentado
                      </button>
                    )}
                    {r.status === 'SEATED' && (
                      <button
                        type="button"
                        onClick={() => update.mutate({ id: r.id, status: 'COMPLETED' })}
                        className="text-accent text-xs font-bold hover:underline"
                      >
                        Completar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost py-1.5 text-xs disabled:opacity-40">
          <ChevronLeft size={12} /> Anterior
        </button>
        <span className="text-sm text-muted">Página {page}</span>
        <button type="button" disabled={reservations.length < 25} onClick={() => setPage(page + 1)} className="btn-ghost py-1.5 text-xs disabled:opacity-40">
          Siguiente <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
