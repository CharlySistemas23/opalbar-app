import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Trash2, Plus, Pause, Calendar, Users } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Modal, Field, StatusPill,
  StatCard, ConfirmDialog,
} from '@/components/ui';

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
  const [confirmAction, setConfirmAction] = useState<{ kind: 'send' | 'delete' | 'cancel'; id: string; title: string } | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ['admin', 'marketing', 'campaigns'],
    queryFn: async () => unwrap<any[]>(await adminApi.marketingListCampaigns()),
  });

  const create = useMutation({
    mutationFn: (form: CampaignForm) => adminApi.marketingCreateCampaign(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'marketing'] }); setEditor(null); },
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
  const sentCount = list.filter((c) => c.status === 'SENT').length;
  const pendingCount = list.filter((c) => c.status === 'DRAFT' || c.status === 'SCHEDULED').length;

  return (
    <div className="page-shell">
      <PageHeader
        icon={Megaphone}
        title="Marketing"
        subtitle="Campañas push masivas a la audiencia de la app"
        actions={
          <button type="button" onClick={() => setEditor(empty)} className="btn-primary">
            <Plus size={14} /> Nueva campaña
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Megaphone} label="Total campañas" value={list.length} tone="accent" />
        <StatCard icon={Send} label="Enviadas" value={sentCount} tone="success" />
        <StatCard icon={Calendar} label="En cola" value={pendingCount} tone="info" />
      </div>

      <InlineError message={create.error ? apiError(create.error) : sendNow.error ? apiError(sendNow.error) : del.error ? apiError(del.error) : cancel.error ? apiError(cancel.error) : null} />

      <div className="card flex-1 overflow-auto">
        {campaignsQuery.isLoading ? (
          <SkeletonRows rows={6} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Sin campañas"
            message="Creá tu primera campaña push para llegar a tus usuarios."
            action={
              <button type="button" onClick={() => setEditor(empty)} className="btn-primary">
                <Plus size={14} /> Crear campaña
              </button>
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Audiencia</th>
                <th>Estado</th>
                <th>Programada</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <p className="font-bold">{c.title}</p>
                    <p className="text-[11px] text-muted truncate max-w-[340px]">{c.body}</p>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <Users size={12} className="text-muted" /> {c.audience ?? '—'}
                    </span>
                  </td>
                  <td><StatusPill status={c.status ?? 'DRAFT'} /></td>
                  <td className="text-xs text-muted">
                    {c.scheduledFor ? new Date(c.scheduledFor).toLocaleString('es') : '—'}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {c.status !== 'SENT' && c.status !== 'SENDING' && c.status !== 'CANCELLED' && (
                      <>
                        <button
                          type="button"
                          title="Enviar ahora"
                          onClick={() => setConfirmAction({ kind: 'send', id: c.id, title: c.title })}
                          className="p-1.5 rounded-lg hover:bg-success/15 text-muted hover:text-success transition"
                        >
                          <Send size={14} />
                        </button>
                        <button
                          type="button"
                          title="Cancelar"
                          onClick={() => setConfirmAction({ kind: 'cancel', id: c.id, title: c.title })}
                          className="p-1.5 rounded-lg hover:bg-elevated text-muted transition"
                        >
                          <Pause size={14} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() => setConfirmAction({ kind: 'delete', id: c.id, title: c.title })}
                      className="p-1.5 rounded-lg hover:bg-danger/15 text-muted hover:text-danger transition"
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

      <Modal open={!!editor} onClose={() => setEditor(null)} title="Nueva campaña">
        {editor && (
          <div className="space-y-3">
            <Field label="Título" required value={editor.title} onChange={(v) => setEditor({ ...editor, title: v })} placeholder="Promo de fin de semana" />
            <Field label="Mensaje" rows={4} required value={editor.body} onChange={(v) => setEditor({ ...editor, body: v })} placeholder="Esta noche 2x1 en…" />
            <label className="block">
              <span className="text-[11px] font-bold text-muted tracking-wider uppercase">Audiencia</span>
              <select
                title="Audiencia"
                value={editor.audience}
                onChange={(e) => setEditor({ ...editor, audience: e.target.value as any })}
                className="input-field mt-1.5"
              >
                <option value="ALL">Todos los usuarios</option>
                <option value="SUBSCRIBED">Suscriptos a notificaciones</option>
                <option value="PREMIUM">Premium</option>
                <option value="STAFF">Staff</option>
              </select>
            </label>
            <Field
              label="Programar (opcional)"
              type="datetime-local"
              value={editor.scheduledFor ?? ''}
              onChange={(v) => setEditor({ ...editor, scheduledFor: v || undefined })}
              hint="Si lo dejás vacío, queda como borrador y la podés enviar manualmente."
            />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditor(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                type="button"
                onClick={() => create.mutate(editor)}
                disabled={create.isPending || !editor.title || !editor.body}
                className="btn-primary flex-1"
              >
                {create.isPending ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.kind === 'send' ? `Enviar "${confirmAction?.title}" ahora?`
          : confirmAction?.kind === 'cancel' ? `Cancelar "${confirmAction?.title}"?`
          : `Eliminar "${confirmAction?.title}"?`
        }
        message={
          confirmAction?.kind === 'send' ? 'Se enviará la notificación a la audiencia configurada inmediatamente.'
          : confirmAction?.kind === 'cancel' ? 'La campaña no se enviará. Podés volver a programarla creando una nueva.'
          : 'Se borrará permanentemente. Esta acción no se puede deshacer.'
        }
        destructive={confirmAction?.kind !== 'send'}
        confirmLabel={
          confirmAction?.kind === 'send' ? 'Enviar ahora'
          : confirmAction?.kind === 'cancel' ? 'Cancelar campaña'
          : 'Eliminar'
        }
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.kind === 'send') sendNow.mutate(confirmAction.id);
          else if (confirmAction.kind === 'cancel') cancel.mutate(confirmAction.id);
          else del.mutate(confirmAction.id);
        }}
      />
    </div>
  );
}
