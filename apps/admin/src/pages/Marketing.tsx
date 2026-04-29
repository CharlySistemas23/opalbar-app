import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Trash2, Plus, X, Pause } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

interface CampaignForm {
  title: string;
  body: string;
  audience: 'ALL' | 'SUBSCRIBED' | 'PREMIUM' | 'STAFF';
  scheduledFor?: string;
}

const empty: CampaignForm = { title: '', body: '', audience: 'ALL' };

export function Marketing() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<CampaignForm | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ['admin', 'marketing', 'campaigns'],
    queryFn: async () => unwrap<any[]>(await adminApi.marketingListCampaigns()),
  });

  const create = useMutation({
    mutationFn: (form: CampaignForm) => adminApi.marketingCreateCampaign(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'marketing'] });
      setEditor(null);
    },
  });

  const sendNow = useMutation({
    mutationFn: (id: string) => adminApi.marketingSendNow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'marketing'] }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => adminApi.marketingCancelCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'marketing'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.marketingDeleteCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'marketing'] }),
  });

  const list: any[] = Array.isArray(campaignsQuery.data) ? campaignsQuery.data : [];

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="text-accent" size={22} /> Marketing
          </h1>
          <p className="text-muted text-sm mt-1">{list.length} campañas</p>
        </div>
        <button
          onClick={() => setEditor(empty)}
          className="px-3 py-2 rounded-xl bg-accent/15 border border-accent/40 text-accent text-sm font-bold flex items-center gap-2 hover:bg-accent/25"
        >
          <Plus size={14} /> Nueva campaña
        </button>
      </div>

      {(create.error || sendNow.error || del.error || cancel.error) && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(create.error ?? sendNow.error ?? del.error ?? cancel.error)}
        </div>
      )}

      <div className="card flex-1 overflow-auto">
        {campaignsQuery.isLoading ? (
          <p className="text-muted text-sm p-6">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="text-muted text-sm p-6">Sin campañas. Creá la primera.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-elevated sticky top-0">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Título</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Audiencia</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Estado</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Programada</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c: any) => (
                <tr key={c.id} className="hover:bg-elevated/40">
                  <td className="px-4 py-3 text-sm">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-[10px] text-muted truncate max-w-[300px]">{c.body}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.audience ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-0.5 rounded ${
                      c.status === 'SENT' ? 'bg-success/15 text-success' :
                      c.status === 'SENDING' ? 'bg-warning/15 text-warning' :
                      c.status === 'CANCELLED' ? 'bg-muted/15 text-muted' :
                      'bg-info/15 text-info'
                    }`}>
                      {c.status ?? 'DRAFT'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {c.scheduledFor ? new Date(c.scheduledFor).toLocaleString('es') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {c.status !== 'SENT' && c.status !== 'SENDING' && c.status !== 'CANCELLED' && (
                      <>
                        <button
                          onClick={() => {
                            if (confirm(`Enviar "${c.title}" ahora?`)) sendNow.mutate(c.id);
                          }}
                          className="p-1.5 rounded hover:bg-success/15 text-success"
                          title="Enviar ahora"
                        >
                          <Send size={14} />
                        </button>
                        <button
                          onClick={() => cancel.mutate(c.id)}
                          className="p-1.5 rounded hover:bg-elevated text-muted"
                          title="Cancelar campaña"
                        >
                          <Pause size={14} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Eliminar campaña "${c.title}"?`)) del.mutate(c.id);
                      }}
                      className="p-1.5 rounded hover:bg-danger/15 text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditor(null)}>
          <div className="bg-zinc-950 border border-line rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Nueva campaña</h2>
              <button onClick={() => setEditor(null)} className="p-1 rounded hover:bg-elevated"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-xs font-bold text-muted tracking-wide uppercase">Título</span>
              <input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} className="input-field mt-1.5" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-muted tracking-wide uppercase">Mensaje</span>
              <textarea rows={4} value={editor.body} onChange={(e) => setEditor({ ...editor, body: e.target.value })} className="input-field mt-1.5" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-muted tracking-wide uppercase">Audiencia</span>
              <select
                value={editor.audience}
                onChange={(e) => setEditor({ ...editor, audience: e.target.value as any })}
                className="input-field mt-1.5"
              >
                <option value="ALL">Todos</option>
                <option value="SUBSCRIBED">Suscriptos a notificaciones</option>
                <option value="PREMIUM">Premium</option>
                <option value="STAFF">Staff</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-muted tracking-wide uppercase">Programar (opcional)</span>
              <input
                type="datetime-local"
                value={editor.scheduledFor ?? ''}
                onChange={(e) => setEditor({ ...editor, scheduledFor: e.target.value || undefined })}
                className="input-field mt-1.5"
              />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setEditor(null)} className="flex-1 px-3 py-2 rounded-xl bg-elevated border border-line text-sm">Cancelar</button>
              <button
                onClick={() => create.mutate(editor)}
                disabled={create.isPending || !editor.title || !editor.body}
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
