import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { offersApi, venuesApi, apiError } from '@/api/client';

const INITIAL = {
  title: '', titleEn: '', description: '', descriptionEn: '', terms: '',
  imageUrl: '', venueId: '', type: 'DISCOUNT_PERCENTAGE',
  discountValue: '', minimumPurchase: '', maxRedemptions: '', maxPerUser: '1',
  startDate: '', endDate: '',
  startTime: '', endTime: '',
  isHighlighted: false, pointsRequired: '0',
  status: 'ACTIVE',
};

const TYPES = ['DISCOUNT_PERCENTAGE', 'DISCOUNT_AMOUNT', 'FREE_ITEM', 'BUY_X_GET_Y', 'HAPPY_HOUR', 'CUSTOM'];
const STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'ARCHIVED'];

export function OfferForm() {
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

  const existing = useQuery({
    enabled: isEdit,
    queryKey: ['offer', id],
    queryFn: async () => (await offersApi.get(id!)).data?.data ?? null,
  });

  useEffect(() => {
    if (existing.data) {
      const e = existing.data;
      setForm({
        title: e.title ?? '', titleEn: e.titleEn ?? '',
        description: e.description ?? '', descriptionEn: e.descriptionEn ?? '',
        terms: e.terms ?? '', imageUrl: e.imageUrl ?? '',
        venueId: e.venueId ?? '', type: e.type ?? 'DISCOUNT_PERCENTAGE',
        discountValue: e.discountValue?.toString() ?? '',
        minimumPurchase: e.minimumPurchase?.toString() ?? '',
        maxRedemptions: e.maxRedemptions?.toString() ?? '',
        maxPerUser: (e.maxPerUser ?? 1).toString(),
        startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 10) : '',
        endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 10) : '',
        startTime: e.startTime ?? '', endTime: e.endTime ?? '',
        isHighlighted: !!e.isHighlighted,
        pointsRequired: (e.pointsRequired ?? 0).toString(),
        status: e.status ?? 'ACTIVE',
      });
    }
  }, [existing.data]);

  useEffect(() => {
    if (!isEdit && venues.data?.length && !form.venueId) {
      setForm((f: any) => ({ ...f, venueId: venues.data[0].id }));
    }
  }, [venues.data]);

  const save = useMutation({
    mutationFn: async (payload: any) => {
      if (isEdit) return offersApi.update(id!, payload);
      return offersApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      navigate('/admin/offers');
    },
    onError: (err) => setError(apiError(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: any = {
      title: form.title, titleEn: form.titleEn || undefined,
      description: form.description, descriptionEn: form.descriptionEn || undefined,
      terms: form.terms || undefined, imageUrl: form.imageUrl || undefined,
      venueId: form.venueId, type: form.type,
      discountValue: form.discountValue ? Number(form.discountValue) : undefined,
      minimumPurchase: form.minimumPurchase ? Number(form.minimumPurchase) : undefined,
      maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
      maxPerUser: form.maxPerUser ? Number(form.maxPerUser) : 1,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      isHighlighted: form.isHighlighted,
      pointsRequired: form.pointsRequired ? Number(form.pointsRequired) : 0,
      status: form.status,
    };
    save.mutate(payload);
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <button onClick={() => navigate('/admin/offers')} className="flex items-center gap-2 text-sm text-muted hover:text-zinc-100">
        <ArrowLeft size={16} /> Volver
      </button>

      <h1 className="text-2xl font-bold">{isEdit ? 'Editar oferta' : 'Nueva oferta'}</h1>

      {error && <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>}

      <form onSubmit={onSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Título (ES)" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Field label="Título (EN)" value={form.titleEn} onChange={(v) => setForm({ ...form, titleEn: v })} />
        </div>

        <Field label="Descripción (ES)" multiline required value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <Field label="Descripción (EN)" multiline value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} />
        <Field label="Términos y condiciones" multiline value={form.terms} onChange={(v) => setForm({ ...form, terms: v })} />
        <Field label="URL imagen" value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} placeholder="https://..." />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Venue" required value={form.venueId} onChange={(v) => setForm({ ...form, venueId: v })}
            options={(venues.data ?? []).map((v: any) => ({ value: v.id, label: v.name }))} />
          <Select label="Tipo" required value={form.type} onChange={(v) => setForm({ ...form, type: v })}
            options={TYPES.map((t) => ({ value: t, label: t }))} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Descuento" type="number" value={form.discountValue} onChange={(v) => setForm({ ...form, discountValue: v })} />
          <Field label="Compra mínima" type="number" value={form.minimumPurchase} onChange={(v) => setForm({ ...form, minimumPurchase: v })} />
          <Field label="Puntos requeridos" type="number" value={form.pointsRequired} onChange={(v) => setForm({ ...form, pointsRequired: v })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Inicia" type="date" required value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
          <Field label="Termina" type="date" required value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Hora inicio (HH:mm)" value={form.startTime} onChange={(v) => setForm({ ...form, startTime: v })} placeholder="20:00" />
          <Field label="Hora fin (HH:mm)" value={form.endTime} onChange={(v) => setForm({ ...form, endTime: v })} placeholder="23:00" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Máx. canjes" type="number" value={form.maxRedemptions} onChange={(v) => setForm({ ...form, maxRedemptions: v })} />
          <Field label="Máx. por usuario" type="number" value={form.maxPerUser} onChange={(v) => setForm({ ...form, maxPerUser: v })} />
          <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })}
            options={STATUSES.map((s) => ({ value: s, label: s }))} />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.isHighlighted} onChange={(e) => setForm({ ...form, isHighlighted: e.target.checked })} className="w-5 h-5 accent-accent" />
          <span className="text-sm font-semibold">Oferta destacada</span>
        </label>

        <div className="pt-2 flex gap-3">
          <button type="submit" disabled={save.isPending} className="btn-primary">
            <Save size={16} /> {save.isPending ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Crear oferta')}
          </button>
          <button type="button" onClick={() => navigate('/admin/offers')} className="btn-ghost">Cancelar</button>
        </div>
      </form>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
};
function Field({ label, value, onChange, type = 'text', required, multiline, placeholder }: FieldProps) {
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

type SelectProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
};
function Select({ label, value, onChange, options, required }: SelectProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted tracking-wide uppercase">{label}{required && ' *'}</span>
      <select required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5">
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
