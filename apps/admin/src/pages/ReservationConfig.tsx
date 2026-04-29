import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save } from 'lucide-react';
import { venuesApi, apiError } from '@/api/client';

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
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="text-accent" size={22} /> Configuración de reservas
        </h1>
        <p className="text-muted text-sm mt-1">Horarios, capacidad y disponibilidad por venue</p>
      </div>

      {save.error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(save.error)}
        </div>
      )}

      <div className="grid grid-cols-[280px,1fr] gap-4 flex-1 min-h-0">
        <div className="card overflow-auto">
          {venuesQuery.isLoading ? (
            <p className="text-muted text-sm p-4">Cargando…</p>
          ) : venues.length === 0 ? (
            <p className="text-muted text-sm p-4">Sin venues.</p>
          ) : (
            <ul className="divide-y divide-line">
              {venues.map((v: any) => (
                <li
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`p-4 cursor-pointer ${selectedId === v.id ? 'bg-accent/10' : 'hover:bg-elevated/50'}`}
                >
                  <p className="text-sm font-semibold">{v.name}</p>
                  <p className="text-[10px] text-muted">
                    {v.reservationsEnabled ? '✓ Reservas activas' : '✗ Reservas desactivadas'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6 overflow-auto">
          {!selected ? (
            <p className="text-muted text-sm">Seleccioná un venue.</p>
          ) : (
            <div className="space-y-4 max-w-md">
              <h2 className="text-lg font-bold">{selected.name}</h2>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-elevated border border-line cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!draft.reservationsEnabled}
                  onChange={(e) => setDraft({ ...draft, reservationsEnabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Reservas habilitadas</p>
                  <p className="text-xs text-muted">Si está apagado los usuarios no pueden reservar.</p>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Apertura (HH:MM)"
                  value={draft.openTime ?? ''}
                  onChange={(v) => setDraft({ ...draft, openTime: v })}
                />
                <Field
                  label="Cierre (HH:MM)"
                  value={draft.closeTime ?? ''}
                  onChange={(v) => setDraft({ ...draft, closeTime: v })}
                />
              </div>

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

              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="px-4 py-2 rounded-xl bg-accent text-black text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={14} /> {save.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {save.isSuccess && (
                <p className="text-success text-xs">✓ Guardado</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted tracking-wide uppercase">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5" />
    </label>
  );
}
