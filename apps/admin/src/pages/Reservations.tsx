import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, X, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { adminApi, venuesApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, StatusPill, InlineError,
  Modal, Field, useDebounced,
} from '@/components/ui';

const STATUSES = ['', 'PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function Reservations() {
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState<{
    userId: string; userLabel: string; userSearch: string;
    venueId: string; date: string; timeSlot: string; partySize: string; notes: string;
  } | null>(null);
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

  const create = useMutation({
    mutationFn: (form: NonNullable<typeof creating>) => adminApi.createReservation({
      userId: form.userId,
      venueId: form.venueId,
      date: form.date,
      timeSlot: form.timeSlot,
      partySize: Number(form.partySize),
      notes: form.notes.trim() || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'reservations'] }); setCreating(null); },
  });

  const reservations: any[] = Array.isArray(data) ? data : (data?.data ?? data ?? []);

  return (
    <div className="page-shell">
      <PageHeader
        icon={Calendar}
        title="Reservaciones"
        subtitle={`${reservations.length} resultados${status ? ` · ${status}` : ''}${date ? ` · ${date}` : ''}`}
        actions={
          <button
            type="button"
            onClick={() => setCreating({
              userId: '', userLabel: '', userSearch: '',
              venueId: '', date: '', timeSlot: '20:00', partySize: '2', notes: '',
            })}
            className="btn-primary"
          >
            <Plus size={14} /> Nueva reserva
          </button>
        }
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

      <Modal open={!!creating} onClose={() => setCreating(null)} title="Nueva reserva manual" size="lg">
        {creating && (
          <CreateReservationForm
            form={creating}
            onChange={setCreating}
            onSubmit={() => create.mutate(creating)}
            onCancel={() => setCreating(null)}
            submitting={create.isPending}
            error={create.error ? apiError(create.error) : null}
          />
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Form de reserva manual
// ─────────────────────────────────────────────
function CreateReservationForm({
  form, onChange, onSubmit, onCancel, submitting, error,
}: {
  form: NonNullable<Parameters<typeof setStateExample>[0]> | any; // pragmático
  onChange: (f: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const debounced = useDebounced(form.userSearch, 300);

  const venuesQuery = useQuery({
    queryKey: ['venues-quick'],
    queryFn: async () => {
      const r = await venuesApi.list({ limit: 50 });
      return (r.data?.data?.data ?? r.data?.data ?? r.data ?? []) as any[];
    },
  });

  const usersQuery = useQuery({
    enabled: debounced.trim().length >= 2,
    queryKey: ['admin', 'users-search', debounced],
    queryFn: async () => {
      const r = await adminApi.users({ search: debounced.trim(), limit: 12 });
      const list: any[] = (r.data?.data?.data ?? r.data?.data ?? r.data ?? []) as any[];
      return list;
    },
  });

  const venues: any[] = Array.isArray(venuesQuery.data) ? venuesQuery.data : [];
  const userMatches: any[] = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  const canSubmit = !!form.userId && !!form.venueId && !!form.date && !!form.timeSlot && Number(form.partySize) > 0 && !submitting;

  return (
    <div className="space-y-4">
      {/* User picker */}
      <div>
        <p className="text-[11px] font-bold text-muted tracking-wider uppercase mb-2">Cliente</p>
        {form.userId ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 ring-1 ring-success/30">
            <Check size={14} className="text-success" />
            <span className="text-sm flex-1">{form.userLabel}</span>
            <button
              type="button"
              onClick={() => onChange({ ...form, userId: '', userLabel: '', userSearch: '' })}
              className="text-xs text-muted hover:text-danger"
            >
              cambiar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={form.userSearch}
                onChange={(e) => onChange({ ...form, userSearch: e.target.value })}
                placeholder="Buscar por nombre o email…"
                className="input-search"
              />
            </div>
            {debounced.trim().length >= 2 && (
              <div className="card max-h-[200px] overflow-auto">
                {usersQuery.isLoading ? (
                  <p className="p-3 text-xs text-muted">Buscando…</p>
                ) : userMatches.length === 0 ? (
                  <p className="p-3 text-xs text-muted">Sin resultados.</p>
                ) : (
                  <ul className="divide-y divide-line/60">
                    {userMatches.map((u: any) => (
                      <li
                        key={u.id}
                        onClick={() => onChange({
                          ...form,
                          userId: u.id,
                          userLabel: `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''} (${u.email})`.trim(),
                          userSearch: '',
                        })}
                        className="p-2.5 cursor-pointer hover:bg-elevated/40 text-sm"
                      >
                        <p className="font-semibold truncate">{u.profile?.firstName ?? ''} {u.profile?.lastName ?? ''}</p>
                        <p className="text-[11px] text-muted truncate">{u.email}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Venue */}
      <label className="block">
        <span className="text-[11px] font-bold text-muted tracking-wider uppercase">Venue</span>
        <select
          title="Venue"
          value={form.venueId}
          onChange={(e) => onChange({ ...form, venueId: e.target.value })}
          className="input-field mt-1.5"
        >
          <option value="">Elegí un venue</option>
          {venues.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>

      {/* Date / time / party */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Fecha" type="date" value={form.date} onChange={(v) => onChange({ ...form, date: v })} />
        <Field label="Hora (HH:MM)" value={form.timeSlot} onChange={(v) => onChange({ ...form, timeSlot: v })} placeholder="20:00" />
        <Field label="Personas" type="number" value={form.partySize} onChange={(v) => onChange({ ...form, partySize: v })} />
      </div>

      <Field label="Notas (opcional)" rows={2} value={form.notes} onChange={(v) => onChange({ ...form, notes: v })} placeholder="Pedido especial, alergias, mesa preferida…" />

      <InlineError message={error} />

      <div className="flex gap-2 pt-2 border-t border-line/60">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">Cancelar</button>
        <button type="button" onClick={onSubmit} disabled={!canSubmit} className="btn-primary flex-1">
          {submitting ? 'Creando…' : 'Crear reserva'}
        </button>
      </div>
    </div>
  );
}

// dummy para inferencia de tipo
function setStateExample(_: { userId: string; venueId: string; date: string; timeSlot: string; partySize: string; notes: string; userLabel: string; userSearch: string }) { return null; }
