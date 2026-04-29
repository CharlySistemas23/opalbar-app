import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Clock, Users, MapPin, Check } from 'lucide-react';
import { venuesApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Switch, Field,
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
