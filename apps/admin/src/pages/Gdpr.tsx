import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Download, Trash2, Check, X } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

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

  return (
    <div className="p-8 space-y-6 h-full flex flex-col overflow-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="text-accent" size={22} /> Cumplimiento GDPR
        </h1>
        <p className="text-muted text-sm mt-1">
          Solicitudes de exportación y eliminación de datos personales
        </p>
      </div>

      {(processExport.error || processDeletion.error) && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(processExport.error ?? processDeletion.error)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Exports */}
        <div className="card overflow-auto">
          <div className="px-4 py-3 border-b border-line bg-elevated flex items-center gap-2">
            <Download size={14} className="text-info" />
            <p className="text-xs font-bold text-muted uppercase">Solicitudes de exportación</p>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-info/15 text-info">
              {exports.length}
            </span>
          </div>
          {requestsQuery.isLoading ? (
            <p className="text-muted text-sm p-4">Cargando…</p>
          ) : exports.length === 0 ? (
            <p className="text-muted text-sm p-4">Sin solicitudes pendientes.</p>
          ) : (
            <ul className="divide-y divide-line">
              {exports.map((r: any) => (
                <li key={r.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{userLabel(r.user)}</p>
                      <p className="text-[10px] text-muted truncate">{r.user?.email}</p>
                      <p className="text-[10px] text-muted mt-1">
                        Solicitado: {new Date(r.createdAt).toLocaleString('es')}
                      </p>
                      <p className="text-[10px] mt-0.5">
                        Estado: <span className="font-bold">{r.status}</span>
                      </p>
                    </div>
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => processExport.mutate({ id: r.id, action: 'APPROVE' })}
                        disabled={processExport.isPending}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-success/15 border border-success/40 text-success text-xs font-bold hover:bg-success/25 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Check size={12} /> Aprobar
                      </button>
                      <button
                        onClick={() => processExport.mutate({ id: r.id, action: 'REJECT' })}
                        disabled={processExport.isPending}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-danger/15 border border-danger/40 text-danger text-xs font-bold hover:bg-danger/25 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <X size={12} /> Rechazar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Deletions */}
        <div className="card overflow-auto">
          <div className="px-4 py-3 border-b border-line bg-elevated flex items-center gap-2">
            <Trash2 size={14} className="text-danger" />
            <p className="text-xs font-bold text-muted uppercase">Solicitudes de eliminación</p>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-danger/15 text-danger">
              {deletions.length}
            </span>
          </div>
          {requestsQuery.isLoading ? (
            <p className="text-muted text-sm p-4">Cargando…</p>
          ) : deletions.length === 0 ? (
            <p className="text-muted text-sm p-4">Sin solicitudes pendientes.</p>
          ) : (
            <ul className="divide-y divide-line">
              {deletions.map((r: any) => (
                <li key={r.id} className="p-4 space-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{userLabel(r.user)}</p>
                    <p className="text-[10px] text-muted truncate">{r.user?.email}</p>
                    <p className="text-[10px] text-muted mt-1">
                      Solicitado: {new Date(r.createdAt).toLocaleString('es')}
                    </p>
                    {r.scheduledFor && (
                      <p className="text-[10px] text-warning mt-0.5">
                        Programado: {new Date(r.scheduledFor).toLocaleString('es')}
                      </p>
                    )}
                    <p className="text-[10px] mt-0.5">
                      Estado: <span className="font-bold">{r.status}</span>
                    </p>
                    {r.reason && (
                      <p className="text-[11px] text-zinc-300 mt-2 italic">"{r.reason}"</p>
                    )}
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (confirm('Aprobar la eliminación de esta cuenta? El usuario será eliminado tras el periodo de gracia.')) {
                            processDeletion.mutate({ id: r.id, action: 'APPROVE' });
                          }
                        }}
                        disabled={processDeletion.isPending}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-danger/15 border border-danger/40 text-danger text-xs font-bold hover:bg-danger/25 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Check size={12} /> Aprobar
                      </button>
                      <button
                        onClick={() => processDeletion.mutate({ id: r.id, action: 'REJECT' })}
                        disabled={processDeletion.isPending}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-elevated border border-line text-muted text-xs font-bold hover:bg-card disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <X size={12} /> Rechazar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
