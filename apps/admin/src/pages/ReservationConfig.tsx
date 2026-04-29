import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Clock, Users, MapPin, Check, Ban, Plus, Trash2 } from 'lucide-react';
import { venuesApi, adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Switch, Field, Modal, ConfirmDialog,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

interface VenueConfig {
  openTime?: string;
  closeTime?: string;
  reservationCapacity?: number;
  reservationsEnabled?: boolean;
  slotMinutes?: number;
}

export function ReservationConfig() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VenueConfig>({});

  const venuesQuery = useQuery({
    queryKey: ['admin', 'venues'],
    queryFn: async () => unwrap<any[]>(await venuesApi.list()),
  });

  const raw = venuesQuery.data as any;
  const venues: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const selected = venues.find((v: any) => v.id === selectedId) ?? venues[0];

  useEffect(() => {
    if (!selectedId && venues.length > 0) setSelectedId(venues[0].id);
  }, [venues, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setDraft({
      openTime: selected.openTime ?? '',
      closeTime: selected.closeTime ?? '',
      reservationCapacity: selected.reservationCapacity ?? 0,
      reservationsEnabled: !!selected.reservationsEnabled,
      slotMinutes: selected.slotMinutes ?? 60,
    });
  }, [selected]);

  const save = useMutation({
    mutationFn: () => venuesApi.updateConfig(selected!.id, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'venues'] }),
  });

  return (
    <div className="page-shell">
      <PageHeader
        icon={Settings}
        title="Configuración de reservas"
        subtitle="Horarios, capacidad y disponibilidad por venue"
      />

      <InlineError message={save.error ? apiError(save.error) : null} />

      <div className="grid grid-cols-[300px,1fr] gap-4 flex-1 min-h-0">
        {/* Venue list */}
        <div className="card overflow-auto">
          <div className="px-4 py-3 border-b border-line/60 bg-elevated sticky top-0 z-10">
            <p className="section-title">Venues · {venues.length}</p>
          </div>
          {venuesQuery.isLoading ? (
            <SkeletonRows rows={4} height={56} />
          ) : venues.length === 0 ? (
            <EmptyState icon={MapPin} title="Sin venues" message="Creá un venue primero." />
          ) : (
            <ul className="divide-y divide-line/60">
              {venues.map((v: any) => {
                const active = selectedId === v.id;
                return (
                  <li
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    className={`p-4 cursor-pointer transition ${active ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-elevated/40 border-l-2 border-transparent'}`}
                  >
                    <p className="text-sm font-bold truncate">{v.name}</p>
                    <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${v.reservationsEnabled ? 'bg-success' : 'bg-muted'}`} />
                      {v.reservationsEnabled ? 'Reservas activas' : 'Reservas desactivadas'}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Editor */}
        <div className="card p-6 overflow-auto">
          {!selected ? (
            <EmptyState icon={Settings} title="Seleccioná un venue" message="Elegí uno de la lista para editar su configuración de reservas." />
          ) : (
            <div className="space-y-6 max-w-md">
              <div>
                <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Editando</p>
                <h2 className="text-2xl font-bold tracking-tight mt-0.5">{selected.name}</h2>
              </div>

              <div className="card p-4 flex items-center gap-3">
                <Switch
                  checked={!!draft.reservationsEnabled}
                  onChange={(next) => setDraft({ ...draft, reservationsEnabled: next })}
                />
                <div className="flex-1">
                  <p className="text-sm font-bold">Reservas habilitadas</p>
                  <p className="text-xs text-muted">Si está apagado los usuarios no pueden reservar.</p>
                </div>
              </div>

              <div>
                <p className="section-title mb-3 flex items-center gap-2"><Clock size={12} /> Horarios</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Apertura"
                    value={draft.openTime ?? ''}
                    onChange={(v) => setDraft({ ...draft, openTime: v })}
                    placeholder="HH:MM"
                  />
                  <Field
                    label="Cierre"
                    value={draft.closeTime ?? ''}
                    onChange={(v) => setDraft({ ...draft, closeTime: v })}
                    placeholder="HH:MM"
                  />
                </div>
              </div>

              <div>
                <p className="section-title mb-3 flex items-center gap-2"><Users size={12} /> Capacidad</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Capacidad por slot"
                    type="number"
                    value={String(draft.reservationCapacity ?? 0)}
                    onChange={(v) => setDraft({ ...draft, reservationCapacity: Number(v) })}
                  />
                  <Field
                    label="Duración slot (min)"
                    type="number"
                    value={String(draft.slotMinutes ?? 60)}
                    onChange={(v) => setDraft({ ...draft, slotMinutes: Number(v) })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="btn-primary"
                >
                  <Save size={14} /> {save.isPending ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {save.isSuccess && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-success animate-fade-in">
                    <Check size={12} /> Guardado
                  </span>
                )}
              </div>

              {/* Bloqueos de horarios */}
              <VenueBlocks venueId={selected.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  VenueBlocks — bloqueos de horario por venue
// ─────────────────────────────────────────────
function VenueBlocks({ venueId }: { venueId: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState<{ startsAt: string; endsAt: string; reason: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const blocksQuery = useQuery({
    queryKey: ['admin', 'venues', venueId, 'blocks'],
    queryFn: async () => {
      const r = await adminApi.listVenueBlocks(venueId);
      const list = (r as any).data?.data ?? (r as any).data ?? [];
      return Array.isArray(list) ? list : [];
    },
  });

  const create = useMutation({
    mutationFn: (form: NonNullable<typeof creating>) => adminApi.createVenueBlock(venueId, {
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      reason: form.reason.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'venues', venueId, 'blocks'] });
      setCreating(null);
    },
  });

  const del = useMutation({
    mutationFn: (blockId: string) => adminApi.deleteVenueBlock(venueId, blockId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'venues', venueId, 'blocks'] }),
  });

  const blocks = blocksQuery.data ?? [];

  return (
    <div className="pt-6 mt-6 border-t border-line/60">
      <div className="flex items-center justify-between mb-3">
        <p className="section-title flex items-center gap-2">
          <Ban size={12} /> Bloqueos de horario · {blocks.length}
        </p>
        <button
          type="button"
          onClick={() => setCreating({
            startsAt: new Date().toISOString().slice(0, 16),
            endsAt: '',
            reason: '',
          })}
          className="btn-ghost py-1.5 text-xs"
        >
          <Plus size={12} /> Nuevo bloqueo
        </button>
      </div>

      <InlineError message={create.error ? apiError(create.error) : del.error ? apiError(del.error) : null} />

      {blocksQuery.isLoading ? (
        <SkeletonRows rows={2} height={48} />
      ) : blocks.length === 0 ? (
        <p className="text-xs text-muted italic">Sin bloqueos. Las reservas pueden hacerse en cualquier slot del horario.</p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((b: any) => (
            <li key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-elevated/40 border border-line">
              <Ban size={14} className="text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {new Date(b.startsAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {new Date(b.endsAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                {b.reason && <p className="text-[11px] text-muted">{b.reason}</p>}
              </div>
              <button
                type="button"
                title="Eliminar bloqueo"
                onClick={() => setConfirmDel(b.id)}
                className="p-1.5 rounded hover:bg-danger/15 text-muted hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!creating} onClose={() => setCreating(null)} title="Bloquear horario">
        {creating && (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Las reservas no se podrán crear durante este rango. Útil para eventos privados o mantenimiento.
            </p>
            <Field label="Desde" type="datetime-local" required value={creating.startsAt} onChange={(v) => setCreating({ ...creating, startsAt: v })} />
            <Field label="Hasta" type="datetime-local" required value={creating.endsAt} onChange={(v) => setCreating({ ...creating, endsAt: v })} />
            <Field label="Motivo" value={creating.reason} onChange={(v) => setCreating({ ...creating, reason: v })} placeholder="Evento privado / Mantenimiento" />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setCreating(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                type="button"
                onClick={() => create.mutate(creating)}
                disabled={create.isPending || !creating.startsAt || !creating.endsAt}
                className="btn-primary flex-1"
              >
                {create.isPending ? 'Creando…' : 'Bloquear'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar bloqueo?"
        message="Las reservas volverán a poder crearse en este rango."
        destructive
        confirmLabel="Eliminar"
        onConfirm={() => confirmDel && del.mutate(confirmDel)}
      />
    </div>
  );
}
