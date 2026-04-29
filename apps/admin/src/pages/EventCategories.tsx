import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tags, Plus, Trash2, RotateCcw, X } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function EventCategories() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', nameEn: '', icon: '', color: '' });

  const catsQuery = useQuery({
    queryKey: ['admin', 'event-categories'],
    queryFn: async () => unwrap<any[]>(await adminApi.allCategories()),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createCategory({
      name: draft.name,
      nameEn: draft.nameEn || undefined,
      icon: draft.icon || undefined,
      color: draft.color || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'event-categories'] });
      setCreating(false);
      setDraft({ name: '', nameEn: '', icon: '', color: '' });
    },
  });

  const archive = useMutation({
    mutationFn: ({ id, hard }: { id: string; hard?: boolean }) => adminApi.deleteCategory(id, hard),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'event-categories'] }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => adminApi.restoreCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'event-categories'] }),
  });

  const all: any[] = Array.isArray(catsQuery.data) ? catsQuery.data : [];
  const active = all.filter((c) => !c.archivedAt && !c.deletedAt);
  const archived = all.filter((c) => c.archivedAt || c.deletedAt);

  return (
    <div className="p-8 space-y-6 h-full flex flex-col overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tags className="text-accent" size={22} /> Categorías de eventos
          </h1>
          <p className="text-muted text-sm mt-1">{active.length} activas · {archived.length} archivadas</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-2 rounded-xl bg-accent/15 border border-accent/40 text-accent text-sm font-bold flex items-center gap-2 hover:bg-accent/25"
        >
          <Plus size={14} /> Nueva categoría
        </button>
      </div>

      {(create.error || archive.error || restore.error) && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(create.error ?? archive.error ?? restore.error)}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-bold text-muted uppercase">Activas</h2>
        <div className="card overflow-hidden">
          {active.length === 0 ? (
            <p className="text-muted text-sm p-4">Sin categorías activas.</p>
          ) : (
            <ul className="divide-y divide-line">
              {active.map((c: any) => (
                <li key={c.id} className="p-3 flex items-center gap-3">
                  <span className="text-xl w-8 text-center" style={{ color: c.color }}>{c.icon ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{c.name}</p>
                    {c.nameEn && <p className="text-[10px] text-muted">{c.nameEn}</p>}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Archivar "${c.name}"?`)) archive.mutate({ id: c.id });
                    }}
                    className="p-1.5 rounded hover:bg-elevated text-muted"
                    title="Archivar"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-muted uppercase">Archivadas</h2>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {archived.map((c: any) => (
                <li key={c.id} className="p-3 flex items-center gap-3 opacity-60">
                  <span className="text-xl w-8 text-center">{c.icon ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-[10px] text-muted">archivada</p>
                  </div>
                  <button
                    onClick={() => restore.mutate(c.id)}
                    className="p-1.5 rounded hover:bg-success/15 text-success"
                    title="Restaurar"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Eliminar definitivamente "${c.name}"? Esta accion no se puede deshacer.`)) {
                        archive.mutate({ id: c.id, hard: true });
                      }
                    }}
                    className="p-1.5 rounded hover:bg-danger/15 text-danger"
                    title="Eliminar definitivamente"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div className="bg-zinc-950 border border-line rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Nueva categoría</h2>
              <button onClick={() => setCreating(false)} className="p-1 rounded hover:bg-elevated"><X size={18} /></button>
            </div>
            <Field label="Nombre (ES)" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
            <Field label="Nombre (EN)" value={draft.nameEn} onChange={(v) => setDraft({ ...draft, nameEn: v })} />
            <Field label="Icono (emoji)" value={draft.icon} onChange={(v) => setDraft({ ...draft, icon: v })} />
            <Field label="Color (hex)" value={draft.color} onChange={(v) => setDraft({ ...draft, color: v })} />
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 px-3 py-2 rounded-xl bg-elevated border border-line text-sm">Cancelar</button>
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || !draft.name}
                className="flex-1 px-3 py-2 rounded-xl bg-accent text-black text-sm font-bold disabled:opacity-50"
              >
                {create.isPending ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted tracking-wide uppercase">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5" />
    </label>
  );
}
