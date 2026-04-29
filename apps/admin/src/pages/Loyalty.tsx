import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Plus, Trash2, Pencil } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Modal, Field, ConfirmDialog,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

interface LoyaltyForm {
  id?: string;
  name: string;
  level: number;
  pointsRequired: number;
  benefits?: string;
  color?: string;
  icon?: string;
}

const empty: LoyaltyForm = { name: '', level: 1, pointsRequired: 0, benefits: '', color: '', icon: '' };

export function Loyalty() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<LoyaltyForm | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  const levelsQuery = useQuery({
    queryKey: ['admin', 'loyalty', 'levels'],
    queryFn: async () => unwrap<any[]>(await adminApi.loyaltyLevels()),
  });

  const save = useMutation({
    mutationFn: async (form: LoyaltyForm) => {
      const payload = {
        name: form.name,
        level: Number(form.level),
        pointsRequired: Number(form.pointsRequired),
        benefits: form.benefits || undefined,
        color: form.color || undefined,
        icon: form.icon || undefined,
      };
      if (form.id) return adminApi.updateLoyaltyLevel(form.id, payload);
      return adminApi.createLoyaltyLevel(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'loyalty'] });
      setEditor(null);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteLoyaltyLevel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'loyalty'] }),
  });

  const levels: any[] = Array.isArray(levelsQuery.data) ? levelsQuery.data : [];
  const sorted = [...levels].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));

  return (
    <div className="page-shell">
      <PageHeader
        icon={Award}
        title="Niveles de fidelidad"
        subtitle={`${levels.length} niveles configurados`}
        actions={
          <button
            type="button"
            onClick={() => setEditor({ ...empty, level: (sorted[sorted.length - 1]?.level ?? 0) + 1 })}
            className="btn-primary"
          >
            <Plus size={14} /> Nuevo nivel
          </button>
        }
      />

      <InlineError message={save.error ? apiError(save.error) : del.error ? apiError(del.error) : null} />

      {levelsQuery.isLoading ? (
        <div className="card flex-1"><SkeletonRows rows={5} height={64} /></div>
      ) : sorted.length === 0 ? (
        <div className="card flex-1 flex items-center justify-center">
          <EmptyState
            icon={Award}
            title="Sin niveles"
            message="Creá el primer nivel para que tus usuarios suban escalando puntos."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 overflow-auto pr-1">
          {sorted.map((l: any) => (
            <article key={l.id} className="card card-hover p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ring-1 ring-line"
                    style={{ backgroundColor: (l.color ? `${l.color}20` : undefined), color: l.color }}
                  >
                    {l.icon ?? '🏆'}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Nivel {l.level}</p>
                    <p className="text-base font-bold tracking-tight">{l.name}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => setEditor({
                      id: l.id, name: l.name ?? '', level: l.level ?? 1,
                      pointsRequired: l.pointsRequired ?? 0,
                      benefits: l.benefits ?? '', color: l.color ?? '', icon: l.icon ?? '',
                    })}
                    className="p-1.5 rounded-lg hover:bg-elevated text-muted hover:text-zinc-200"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => setConfirmDel({ id: l.id, name: l.name })}
                    className="p-1.5 rounded-lg hover:bg-danger/15 text-muted hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{l.pointsRequired ?? 0}</span>
                <span className="text-xs text-muted">puntos requeridos</span>
              </div>
              {l.benefits && (
                <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3 border-t border-line/60 pt-3">
                  {l.benefits}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Editar nivel' : 'Nuevo nivel'}>
        {editor && (
          <div className="space-y-3">
            <Field label="Nombre" required value={editor.name} onChange={(v) => setEditor({ ...editor, name: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nivel (orden)" type="number" value={String(editor.level)} onChange={(v) => setEditor({ ...editor, level: Number(v) })} />
              <Field label="Puntos requeridos" type="number" value={String(editor.pointsRequired)} onChange={(v) => setEditor({ ...editor, pointsRequired: Number(v) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Icono (emoji)" value={editor.icon ?? ''} onChange={(v) => setEditor({ ...editor, icon: v })} />
              <Field label="Color (hex)" value={editor.color ?? ''} onChange={(v) => setEditor({ ...editor, color: v })} placeholder="#F4A340" />
            </div>
            <Field label="Beneficios" rows={3} value={editor.benefits ?? ''} onChange={(v) => setEditor({ ...editor, benefits: v })} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditor(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                type="button"
                onClick={() => save.mutate(editor)}
                disabled={save.isPending || !editor.name}
                className="btn-primary flex-1"
              >
                {save.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`Eliminar nivel "${confirmDel?.name ?? ''}"?`}
        message="Los usuarios que estén en este nivel pasarán al inferior. Esta acción no se puede deshacer."
        destructive
        confirmLabel="Eliminar"
        onConfirm={() => confirmDel && del.mutate(confirmDel.id)}
      />
    </div>
  );
}
