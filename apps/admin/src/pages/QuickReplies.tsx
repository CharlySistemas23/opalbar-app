import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Trash2, Pencil, X } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'support', 'quick-replies'] });
      setEditor(null);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteQuickReply(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'support', 'quick-replies'] }),
  });

  const list: any[] = Array.isArray(repliesQuery.data) ? repliesQuery.data : [];

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="text-accent" size={22} /> Respuestas rápidas
          </h1>
          <p className="text-muted text-sm mt-1">{list.length} plantillas para soporte</p>
        </div>
        <button
          onClick={() => setEditor(empty)}
          className="px-3 py-2 rounded-xl bg-accent/15 border border-accent/40 text-accent text-sm font-bold flex items-center gap-2 hover:bg-accent/25"
        >
          <Plus size={14} /> Nueva plantilla
        </button>
      </div>

      {(save.error || del.error) && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(save.error ?? del.error)}
        </div>
      )}

      <div className="card flex-1 overflow-auto">
        {repliesQuery.isLoading ? (
          <p className="text-muted text-sm p-6">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="text-muted text-sm p-6">Sin plantillas. Creá la primera.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r: any) => (
              <li key={r.id} className="p-4 group hover:bg-elevated/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{r.title}</p>
                      {r.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-elevated text-muted">{r.category}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap line-clamp-3">{r.body}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => setEditor({ id: r.id, title: r.title, body: r.body, category: r.category ?? '' })}
                      className="p-1.5 rounded hover:bg-elevated text-muted"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Eliminar "${r.title}"?`)) del.mutate(r.id);
                      }}
                      className="p-1.5 rounded hover:bg-danger/15 text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditor(null)}>
          <div className="bg-zinc-950 border border-line rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editor.id ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
              <button onClick={() => setEditor(null)} className="p-1 rounded hover:bg-elevated"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-xs font-bold text-muted tracking-wide uppercase">Título</span>
              <input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} className="input-field mt-1.5" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-muted tracking-wide uppercase">Categoría</span>
              <input value={editor.category ?? ''} onChange={(e) => setEditor({ ...editor, category: e.target.value })} className="input-field mt-1.5" placeholder="general · cobros · técnico …" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-muted tracking-wide uppercase">Cuerpo del mensaje</span>
              <textarea
                rows={6}
                value={editor.body}
                onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                className="input-field mt-1.5"
              />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setEditor(null)} className="flex-1 px-3 py-2 rounded-xl bg-elevated border border-line text-sm">Cancelar</button>
              <button
                onClick={() => save.mutate(editor)}
                disabled={save.isPending || !editor.title || !editor.body}
                className="flex-1 px-3 py-2 rounded-xl bg-accent text-black text-sm font-bold disabled:opacity-50"
              >
                {save.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
