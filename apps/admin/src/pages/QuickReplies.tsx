import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Trash2, Pencil } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Modal, Field, ConfirmDialog,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

interface ReplyForm {
  id?: string;
  title: string;
  body: string;
  category?: string;
}

const empty: ReplyForm = { title: '', body: '', category: '' };

export function QuickReplies() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<ReplyForm | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);

  const repliesQuery = useQuery({
    queryKey: ['admin', 'support', 'quick-replies'],
    queryFn: async () => unwrap<any[]>(await adminApi.quickReplies()),
  });

  const save = useMutation({
    mutationFn: async (form: ReplyForm) => {
      const payload = { title: form.title, body: form.body, category: form.category || undefined };
      if (form.id) return adminApi.updateQuickReply(form.id, payload);
      return adminApi.createQuickReply(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'support', 'quick-replies'] }); setEditor(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteQuickReply(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'support', 'quick-replies'] }),
  });

  const list: any[] = Array.isArray(repliesQuery.data) ? repliesQuery.data : [];

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    list.forEach((r) => {
      const key = r.category?.trim() || 'General';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);

  return (
    <div className="page-shell">
      <PageHeader
        icon={MessageSquare}
        title="Respuestas rápidas"
        subtitle={`${list.length} plantillas para soporte`}
        actions={
          <button type="button" onClick={() => setEditor(empty)} className="btn-primary">
            <Plus size={14} /> Nueva plantilla
          </button>
        }
      />

      <InlineError message={save.error ? apiError(save.error) : del.error ? apiError(del.error) : null} />

      {repliesQuery.isLoading ? (
        <div className="card flex-1"><SkeletonRows rows={5} height={80} /></div>
      ) : list.length === 0 ? (
        <div className="card flex-1 flex items-center justify-center">
          <EmptyState
            icon={MessageSquare}
            title="Sin plantillas"
            message="Creá tu primera plantilla para responder tickets más rápido."
            action={
              <button type="button" onClick={() => setEditor(empty)} className="btn-primary">
                <Plus size={14} /> Crear plantilla
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6 flex-1 overflow-auto pr-1">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="space-y-2">
              <h2 className="section-title flex items-center gap-2">
                {cat}
                <span className="pill-muted">{items.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((r: any) => (
                  <article key={r.id} className="card card-hover p-4 group flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold truncate flex-1">{r.title}</p>
                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => setEditor({ id: r.id, title: r.title, body: r.body, category: r.category ?? '' })}
                          className="p-1.5 rounded-lg hover:bg-elevated text-muted hover:text-zinc-200"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => setConfirmDel({ id: r.id, title: r.title })}
                          className="p-1.5 rounded-lg hover:bg-danger/15 text-muted hover:text-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed line-clamp-4">{r.body}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Editar plantilla' : 'Nueva plantilla'}>
        {editor && (
          <div className="space-y-3">
            <Field label="Título" required value={editor.title} onChange={(v) => setEditor({ ...editor, title: v })} />
            <Field
              label="Categoría"
              value={editor.category ?? ''}
              onChange={(v) => setEditor({ ...editor, category: v })}
              placeholder="general · cobros · técnico…"
              hint="Las plantillas se agrupan por categoría."
            />
            <Field label="Cuerpo del mensaje" rows={6} required value={editor.body} onChange={(v) => setEditor({ ...editor, body: v })} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditor(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                type="button"
                onClick={() => save.mutate(editor)}
                disabled={save.isPending || !editor.title || !editor.body}
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
        title={`Eliminar "${confirmDel?.title}"?`}
        destructive
        confirmLabel="Eliminar"
        onConfirm={() => confirmDel && del.mutate(confirmDel.id)}
      />
    </div>
  );
}
