import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, X } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

const STATUSES = ['', 'PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export function Reservations() {
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reservations', status, date, page],
    queryFn: async () => {
      const r = await adminApi.reservations({ page, limit: 25, status: status || undefined, date: date || undefined });
      return r.data?.data ?? r.data;
    },
  });

  const update = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      adminApi.updateReservationStatus(id, status, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reservations'] }),
  });

  const reservations: any[] = data?.data ?? data ?? [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reservaciones</h1>
          <p className="text-muted text-sm mt-1">{reservations.length} resultados</p>
        </div>
      </div>

      <div className="card p-4 flex gap-3 flex-wrap">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field max-w-[200px]">
          <option value="">Todos los estados</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} className="input-field max-w-[200px]" />
        {date && <button onClick={() => setDate('')} className="btn-ghost text-xs">Limpiar</button>}
      </div>

      {isLoading ? (
        <p className="text-muted">Cargando…</p>
      ) : reservations.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar size={40} className="mx-auto text-muted mb-3" />
          <p className="text-muted">Sin reservaciones.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-elevated">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Cliente</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Venue</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Fecha</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Personas</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reservations.map((r: any) => (
                <tr key={r.id} className="hover:bg-elevated/50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{r.user?.profile?.firstName} {r.user?.profile?.lastName}</p>
                    <p className="text-xs text-muted">{r.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{r.venue?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {r.date ? new Date(r.date).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '—'}
                    {' '}
                    <span className="text-muted">{r.timeSlot}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{r.partySize}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {r.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => update.mutate({ id: r.id, status: 'CONFIRMED' })}
                            className="text-success text-xs font-bold hover:underline flex items-center gap-1"
                          >
                            <Check size={12} /> Confirmar
                          </button>
                          <button
                            onClick={() => update.mutate({ id: r.id, status: 'CANCELLED' })}
                            className="text-danger text-xs font-bold hover:underline flex items-center gap-1"
                          >
                            <X size={12} /> Rechazar
                          </button>
                        </>
                      )}
                      {r.status === 'CONFIRMED' && (
                        <button
                          onClick={() => update.mutate({ id: r.id, status: 'SEATED' })}
                          className="text-accent text-xs font-bold hover:underline"
                        >
                          Marcar sentado
                        </button>
                      )}
                      {r.status === 'SEATED' && (
                        <button
                          onClick={() => update.mutate({ id: r.id, status: 'COMPLETED' })}
                          className="text-accent text-xs font-bold hover:underline"
                        >
                          Completar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {update.error && <p className="text-danger text-sm">{apiError(update.error)}</p>}

      <div className="flex items-center gap-3">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost text-xs disabled:opacity-40">‹ Anterior</button>
        <span className="text-sm text-muted">Página {page}</span>
        <button disabled={reservations.length < 25} onClick={() => setPage(page + 1)} className="btn-ghost text-xs disabled:opacity-40">Siguiente ›</button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-500/15 text-amber-400',
    CONFIRMED: 'bg-success/15 text-success',
    SEATED: 'bg-accent/15 text-accent',
    COMPLETED: 'bg-blue-500/15 text-blue-400',
    CANCELLED: 'bg-danger/15 text-danger',
    NO_SHOW: 'bg-muted/15 text-muted',
  };
  return <span className={`pill ${map[status] ?? 'bg-muted/15 text-muted'}`}>{status ?? '—'}</span>;
}
