import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Download, Trash2, Check, X, Clock } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, StatCard, StatusPill, ConfirmDialog,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

function userLabel(u: any) {
  if (!u) return '—';
  const fn = u?.profile?.firstName?.trim();
  const ln = u?.profile?.lastName?.trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
  return u?.email ?? '—';
}

export function Gdpr() {
  const qc = useQueryClient();
  const [confirmDeletion, setConfirmDeletion] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ['admin', 'gdpr', 'requests'],
    queryFn: async () => unwrap<any>(await adminApi.gdprRequests()),
  });

  const processExport = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      adminApi.processExport(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'gdpr'] }),
  });

  const processDeletion = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      adminApi.processDeletion(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'gdpr'] }),
  });

  const data = requestsQuery.data ?? {};
  const exports: any[] = data.exports ?? [];
  const deletions: any[] = data.deletions ?? [];
  const pendingExp = exports.filter((r) => r.status === 'PENDING').length;
  const pendingDel = deletions.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="page-shell page-shell--scroll">
      <PageHeader
        icon={ShieldCheck}
        title="Cumplimiento GDPR"
        subtitle="Solicitudes de exportación y eliminación de datos personales"
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Download} label="Exports pendientes" value={pendingExp} tone="info" hint={`${exports.length} totales`} />
        <StatCard icon={Trash2} label="Borrados pendientes" value={pendingDel} tone="danger" hint={`${deletions.length} totales`} />
      </div>

      <InlineError message={processExport.error ? apiError(processExport.error) : processDeletion.error ? apiError(processDeletion.error) : null} />

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Exports */}
        <section className="card overflow-auto flex flex-col">
          <div className="px-4 py-3 border-b border-line/60 bg-elevated/40 sticky top-0 backdrop-blur z-10 flex items-center gap-2">
            <Download size={14} className="text-info" />
            <p className="section-title">Solicitudes de exportación</p>
            <span className="ml-auto pill-info">{exports.length}</span>
          </div>
          {requestsQuery.isLoading ? (
            <SkeletonRows rows={3} height={88} />
          ) : exports.length === 0 ? (
            <EmptyState icon={Download} title="Sin exportaciones" message="Cuando un usuario pida sus datos, aparecerá aquí." />
          ) : (
            <ul className="divide-y divide-line/60">
              {exports.map((r: any) => (
                <li key={r.id} className="p-4 space-y-3 hover:bg-elevated/30 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{userLabel(r.user)}</p>
                      <p className="text-[11px] text-muted truncate">{r.user?.email}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted">
                        <Clock size={10} /> {new Date(r.createdAt).toLocaleString('es')}
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => processExport.mutate({ id: r.id, action: 'APPROVE' })} disabled={processExport.isPending} className="btn-success flex-1 py-1.5 text-xs">
                        <Check size={12} /> Aprobar
                      </button>
                      <button type="button" onClick={() => processExport.mutate({ id: r.id, action: 'REJECT' })} disabled={processExport.isPending} className="btn-danger flex-1 py-1.5 text-xs">
                        <X size={12} /> Rechazar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Deletions */}
        <section className="card overflow-auto flex flex-col">
          <div className="px-4 py-3 border-b border-line/60 bg-elevated/40 sticky top-0 backdrop-blur z-10 flex items-center gap-2">
            <Trash2 size={14} className="text-danger" />
            <p className="section-title">Solicitudes de eliminación</p>
            <span className="ml-auto pill-danger">{deletions.length}</span>
          </div>
          {requestsQuery.isLoading ? (
            <SkeletonRows rows={3} height={120} />
          ) : deletions.length === 0 ? (
            <EmptyState icon={Trash2} title="Sin borrados" message="Cuando un usuario solicite borrar su cuenta, aparecerá aquí." />
          ) : (
            <ul className="divide-y divide-line/60">
              {deletions.map((r: any) => (
                <li key={r.id} className="p-4 space-y-3 hover:bg-elevated/30 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{userLabel(r.user)}</p>
                      <p className="text-[11px] text-muted truncate">{r.user?.email}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted">
                        <Clock size={10} /> Solicitado: {new Date(r.createdAt).toLocaleString('es')}
                      </div>
                      {r.scheduledFor && (
                        <p className="text-[11px] text-warning mt-0.5">
                          Programado: {new Date(r.scheduledFor).toLocaleString('es')}
                        </p>
                      )}
                      {r.reason && (
                        <p className="text-[11px] text-zinc-300 mt-2 italic line-clamp-3">"{r.reason}"</p>
                      )}
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmDeletion(r.id)} disabled={processDeletion.isPending} className="btn-danger flex-1 py-1.5 text-xs">
                        <Check size={12} /> Aprobar
                      </button>
                      <button type="button" onClick={() => processDeletion.mutate({ id: r.id, action: 'REJECT' })} disabled={processDeletion.isPending} className="btn-ghost flex-1 py-1.5 text-xs">
                        <X size={12} /> Rechazar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={!!confirmDeletion}
        onClose={() => setConfirmDeletion(null)}
        title="Aprobar eliminación de cuenta"
        message="El usuario será marcado para borrado. Tras el periodo de gracia se eliminarán todos sus datos. Esta acción es irreversible."
        confirmLabel="Aprobar borrado"
        destructive
        onConfirm={() => confirmDeletion && processDeletion.mutate({ id: confirmDeletion, action: 'APPROVE' })}
      />
    </div>
  );
}
