import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tags, Plus, Trash2, RotateCcw, Archive } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Modal, Field, ConfirmDialog, StatCard,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function EventCategories() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', nameEn: '', icon: '', color: '' });
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string; hard?: boolean } | null>(null);

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
    <div className="page-shell page-shell--scroll">
      <PageHeader
        icon={Tags}
        title="Categorías de eventos"
        subtitle={`${active.length} activas · ${archived.length} archivadas`}
        actions={
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            <Plus size={14} /> Nueva categoría
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Tags} label="Activas" value={active.length} tone="success" />
        <StatCard icon={Archive} label="Archivadas" value={archived.length} tone="warning" />
      </div>

      <InlineError message={create.error ? apiError(create.error) : archive.error ? apiError(archive.error) : restore.error ? apiError(restore.error) : null} />

      <section className="space-y-3">
        <h2 className="section-title">Activas</h2>
        {catsQuery.isLoading ? (
          <SkeletonRows rows={4} height={56} />
        ) : active.length === 0 ? (
          <div className="card">
            <EmptyState icon={Tags} title="Sin categorías activas" message="Creá la primera para que los eventos puedan clasificarse." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((c: any) => (
              <article key={c.id} className="card card-hover p-4 flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ring-1 ring-line"
                  style={{ backgroundColor: c.color ? `${c.color}20` : undefined, color: c.color }}
                >
                  {c.icon ?? '🎉'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{c.name}</p>
                  {c.nameEn && <p className="text-[11px] text-muted truncate">{c.nameEn}</p>}
                </div>
                <button
                  type="button"
                  title="Archivar"
                  onClick={() => setConfirmDel({ id: c.id, name: c.name })}
                  className="p-1.5 rounded-lg hover:bg-warning/15 text-muted hover:text-warning transition"
                >
                  <Archive size={14} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">Archivadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {archived.map((c: any) => (
              <article key={c.id} className="card p-4 flex items-center gap-3 opacity-60">
                <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center text-2xl shrink-0">
                  {c.icon ?? '🎉'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{c.name}</p>
                  <p className="text-[11px] text-muted">archivada</p>
                </div>
                <button
                  type="button"
                  title="Restaurar"
                  onClick={() => restore.mutate(c.id)}
                  className="p-1.5 rounded-lg hover:bg-success/15 text-muted hover:text-success transition"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  type="button"
                  title="Eliminar definitivamente"
                  onClick={() => setConfirmDel({ id: c.id, name: c.name, hard: true })}
                  className="p-1.5 rounded-lg hover:bg-danger/15 text-muted hover:text-danger transition"
                >
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva categoría">
        <div className="space-y-3">
          <Field label="Nombre (ES)" required value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          <Field label="Nombre (EN)" value={draft.nameEn} onChange={(v) => setDraft({ ...draft, nameEn: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Icono (emoji)" value={draft.icon} onChange={(v) => setDraft({ ...draft, icon: v })} placeholder="🎉" />
            <Field label="Color (hex)" value={draft.color} onChange={(v) => setDraft({ ...draft, color: v })} placeholder="#F4A340" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setCreating(false)} className="btn-ghost flex-1">Cancelar</button>
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !draft.name} className="btn-primary flex-1">
              {create.isPending ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={confirmDel?.hard ? `Eliminar "${confirmDel?.name}"?` : `Archivar "${confirmDel?.name}"?`}
        message={confirmDel?.hard
          ? 'Esta acción es permanente, no se puede deshacer.'
          : 'La categoría se ocultará de la app. Podés restaurarla luego.'}
        destructive={confirmDel?.hard}
        confirmLabel={confirmDel?.hard ? 'Eliminar' : 'Archivar'}
        onConfirm={() => confirmDel && archive.mutate({ id: confirmDel.id, hard: confirmDel.hard })}
      />
    </div>
  );
}
