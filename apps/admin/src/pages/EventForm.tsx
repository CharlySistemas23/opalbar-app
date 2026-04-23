import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { eventsApi, venuesApi, apiError } from '@/api/client';

const INITIAL = {
  title: '', titleEn: '', description: '', descriptionEn: '',
  imageUrl: '', venueId: '', categoryId: '',
  startDate: '', endDate: '',
  maxCapacity: '', price: '', isFree: true,
  pointsReward: 50, status: 'PUBLISHED' as string,
};

export function EventForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  const venues = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const r = await venuesApi.list();
      return r.data?.data?.data ?? r.data?.data ?? [];
    },
  });
  const categories = useQuery({
    queryKey: ['event-categories'],
    queryFn: async () => {
      const r = await eventsApi.categories();
      return r.data?.data ?? [];
    },
  });
  const existing = useQuery({
    enabled: isEdit,
    queryKey: ['event', id],
    queryFn: async () => {
      const r = await eventsApi.get(id!);
      return r.data?.data ?? null;
    },
  });

  useEffect(() => {
    if (existing.data) {
      const e = existing.data;
      setForm({
        title: e.title ?? '',
        titleEn: e.titleEn ?? '',
        description: e.description ?? '',
        descriptionEn: e.descriptionEn ?? '',
        imageUrl: e.imageUrl ?? '',
        venueId: e.venueId ?? '',
        categoryId: e.categoryId ?? '',
        startDate: e.startDate ? toLocalInput(e.startDate) : '',
        endDate: e.endDate ? toLocalInput(e.endDate) : '',
        maxCapacity: e.maxCapacity ?? '',
        price: e.price ?? '',
        isFree: !!e.isFree,
        pointsReward: e.pointsReward ?? 50,
        status: e.status ?? 'PUBLISHED',
      });
    }
  }, [existing.data]);

  useEffect(() => {
    if (!isEdit && venues.data?.length && !form.venueId) {
      setForm((f: any) => ({ ...f, venueId: venues.data[0].id }));
    }
    if (!isEdit && categories.data?.length && !form.categoryId) {
      setForm((f: any) => ({ ...f, categoryId: categories.data[0].id }));
    }
  }, [venues.data, categories.data]);

  const save = useMutation({
    mutationFn: async (payload: any) => {
      if (isEdit) return eventsApi.update(id!, payload);
      return eventsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      navigate('/admin/events');
    },
    onError: (err) => setError(apiError(err)),
  });

  const del = useMutation({
    mutationFn: async () => eventsApi.delete(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); navigate('/admin/events'); },
    onError: (err) => setError(apiError(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: any = {
      title: form.title, titleEn: form.titleEn || undefined,
      description: form.description, descriptionEn: form.descriptionEn || undefined,
      imageUrl: form.imageUrl || undefined,
      venueId: form.venueId,
      categoryId: form.categoryId,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : undefined,
      price: form.isFree ? undefined : (form.price ? Number(form.price) : undefined),
      isFree: form.isFree,
      pointsReward: Number(form.pointsReward),
      status: form.status,
    };
    save.mutate(payload);
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <button onClick={() => navigate('/admin/events')} className="flex items-center gap-2 text-sm text-muted hover:text-zinc-100">
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? 'Editar evento' : 'Nuevo evento'}</h1>
        {isEdit && (
          <button onClick={() => confirm('¿Borrar este evento?') && del.mutate()} className="btn-danger">
            <Trash2 size={15} /> Borrar
          </button>
        )}
      </div>

      {error && <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>}

      <form onSubmit={onSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Título (ES)" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Field label="Título (EN)" value={form.titleEn} onChange={(v) => setForm({ ...form, titleEn: v })} />
        </div>
        <Field label="Descripción (ES)" multiline required value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <Field label="Descripción (EN)" multiline value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} />
        <Field label="URL imagen" value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} placeholder="https://..." />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Venue" required value={form.venueId} onChange={(v) => setForm({ ...form, venueId: v })}
            options={(venues.data ?? []).map((v: any) => ({ value: v.id, label: v.name }))} />
          <Select label="Categoría" required value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })}
            options={(categories.data ?? []).map((c: any) => ({ value: c.id, label: c.name }))} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Inicia" type="datetime-local" required value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
          <Field label="Termina" type="datetime-local" required value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Cupo máximo" type="number" value={form.maxCapacity} onChange={(v) => setForm({ ...form, maxCapacity: v })} />
          <Field label="Puntos reward" type="number" value={form.pointsReward} onChange={(v) => setForm({ ...form, pointsReward: v })} />
          <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })}
            options={[{ value: 'DRAFT', label: 'Borrador' }, { value: 'PUBLISHED', label: 'Publicado' }, { value: 'CANCELLED', label: 'Cancelado' }, { value: 'COMPLETED', label: 'Completado' }]} />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked })} className="w-5 h-5 accent-accent" />
          <span className="text-sm font-semibold">Entrada libre</span>
        </label>

        {!form.isFree && (
          <Field label="Precio (MXN)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
        )}

        <div className="pt-2 flex gap-3">
          <button type="submit" disabled={save.isPending} className="btn-primary">
            <Save size={16} /> {save.isPending ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Crear evento')}
          </button>
          <button type="button" onClick={() => navigate('/admin/events')} className="btn-ghost">Cancelar</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, multiline, placeholder }: any) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted tracking-wide uppercase">{label}{required && ' *'}</span>
      {multiline ? (
        <textarea required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5 min-h-[88px]" placeholder={placeholder} />
      ) : (
        <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5" placeholder={placeholder} />
      )}
    </label>
  );
}

function Select({ label, value, onChange, options, required }: any) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted tracking-wide uppercase">{label}{required && ' *'}</span>
      <select required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5">
        <option value="">—</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
