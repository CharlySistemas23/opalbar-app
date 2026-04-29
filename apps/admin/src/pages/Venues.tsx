import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus } from 'lucide-react';
import { venuesApi, apiError } from '@/api/client';
import { Modal, Field as UiField, InlineError } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';

export function Venues() {
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ name: string; address: string; city: string; description: string; phone: string; imageUrl: string } | null>(null);
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const isSuper = me?.role === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['venues-admin'],
    queryFn: async () => {
      const r = await venuesApi.list({ limit: 100 });
      return r.data?.data?.data ?? r.data?.data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: (form: NonNullable<typeof creating>) => venuesApi.create({
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      description: form.description.trim() || undefined,
      phone: form.phone.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['venues-admin'] }); setCreating(null); },
  });

  const venues: any[] = data ?? [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Venues</h1>
          <p className="text-muted text-sm mt-1">{venues.length} ubicaciones</p>
        </div>
        {isSuper && (
          <button
            type="button"
            onClick={() => setCreating({ name: '', address: '', city: 'Puerto Vallarta', description: '', phone: '', imageUrl: '' })}
            className="btn-primary"
          >
            <Plus size={14} /> Nuevo venue
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted">Cargando…</p>
      ) : venues.length === 0 ? (
        <div className="card p-12 text-center">
          <MapPin size={40} className="mx-auto text-muted mb-3" />
          <p className="text-muted">Sin venues.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[380px,1fr] gap-4">
          <div className="card overflow-auto max-h-[70vh]">
            <ul className="divide-y divide-line">
              {venues.map((v: any) => (
                <li
                  key={v.id}
                  onClick={() => setSelected(v.id)}
                  className={`p-4 cursor-pointer ${selected === v.id ? 'bg-accent/10' : 'hover:bg-elevated/50'}`}
                >
                  <p className="font-semibold text-sm">{v.name}</p>
                  <p className="text-xs text-muted">{v.city ?? '—'} · {v.address ?? '—'}</p>
                </li>
              ))}
            </ul>
          </div>

          {selected ? <VenueEditor id={selected} venue={venues.find((v) => v.id === selected)!} /> : (
            <div className="card p-8 flex items-center justify-center">
              <p className="text-muted text-sm">Selecciona un venue.</p>
            </div>
          )}
        </div>
      )}

      <Modal open={!!creating} onClose={() => setCreating(null)} title="Nuevo venue">
        {creating && (
          <div className="space-y-3">
            <UiField label="Nombre" required value={creating.name} onChange={(v) => setCreating({ ...creating, name: v })} placeholder="OPAL BAR Vallarta" />
            <UiField label="Dirección" value={creating.address} onChange={(v) => setCreating({ ...creating, address: v })} placeholder="Av. Las Palmas 123" />
            <UiField label="Ciudad" value={creating.city} onChange={(v) => setCreating({ ...creating, city: v })} />
            <UiField label="Teléfono" value={creating.phone} onChange={(v) => setCreating({ ...creating, phone: v })} />
            <UiField label="URL imagen" value={creating.imageUrl} onChange={(v) => setCreating({ ...creating, imageUrl: v })} placeholder="https://…" />
            <UiField label="Descripción" rows={3} value={creating.description} onChange={(v) => setCreating({ ...creating, description: v })} />
            <InlineError message={create.error ? apiError(create.error) : null} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setCreating(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                type="button"
                onClick={() => create.mutate(creating)}
                disabled={create.isPending || !creating.name.trim()}
                className="btn-primary flex-1"
              >
                {create.isPending ? 'Creando…' : 'Crear venue'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function VenueEditor({ id, venue }: { id: string; venue: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: venue.name ?? '',
    description: venue.description ?? '',
    address: venue.address ?? '',
    city: venue.city ?? '',
    phone: venue.phone ?? '',
    imageUrl: venue.imageUrl ?? '',
  });
  const [cfg, setCfg] = useState({
    openTime: venue.openTime ?? '',
    closeTime: venue.closeTime ?? '',
    reservationCapacity: venue.reservationCapacity ?? 0,
    reservationsEnabled: venue.reservationsEnabled ?? false,
    slotMinutes: venue.slotMinutes ?? 30,
  });

  const update = useMutation({
    mutationFn: (data: any) => venuesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues-admin'] }),
  });
  const updateCfg = useMutation({
    mutationFn: (data: any) => venuesApi.updateConfig(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues-admin'] }),
  });

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-4">
        <h3 className="font-bold">Información</h3>
        <Field label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Descripción" multiline value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dirección" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="URL imagen" value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
        </div>
        <button onClick={() => update.mutate(form)} disabled={update.isPending} className="btn-primary">
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        {update.error && <p className="text-danger text-xs">{apiError(update.error)}</p>}
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold">Reservaciones</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.reservationsEnabled}
            onChange={(e) => setCfg({ ...cfg, reservationsEnabled: e.target.checked })}
            className="w-5 h-5 accent-accent"
          />
          <span className="text-sm font-semibold">Reservaciones habilitadas</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apertura" value={cfg.openTime} onChange={(v) => setCfg({ ...cfg, openTime: v })} placeholder="12:00" />
          <Field label="Cierre" value={cfg.closeTime} onChange={(v) => setCfg({ ...cfg, closeTime: v })} placeholder="02:00" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Capacidad por slot" type="number" value={String(cfg.reservationCapacity)} onChange={(v) => setCfg({ ...cfg, reservationCapacity: Number(v) || 0 })} />
          <Field label="Minutos por slot" type="number" value={String(cfg.slotMinutes)} onChange={(v) => setCfg({ ...cfg, slotMinutes: Number(v) || 30 })} />
        </div>
        <button onClick={() => updateCfg.mutate(cfg)} disabled={updateCfg.isPending} className="btn-primary">
          {updateCfg.isPending ? 'Guardando…' : 'Guardar config'}
        </button>
        {updateCfg.error && <p className="text-danger text-xs">{apiError(updateCfg.error)}</p>}
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
};
function Field({ label, value, onChange, type = 'text', multiline, placeholder }: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted uppercase">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5 min-h-[72px]" placeholder={placeholder} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5" placeholder={placeholder} />
      )}
    </label>
  );
}
