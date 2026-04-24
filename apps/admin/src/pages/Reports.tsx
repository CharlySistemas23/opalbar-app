import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Check, X } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

export function Reports() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', page],
    queryFn: async () => (await adminApi.reports({ page, limit: 25 })).data?.data ?? [],
  });

  const detail = useQuery({
    enabled: !!selected,
    queryKey: ['admin', 'report', selected],
    queryFn: async () => (await adminApi.reportDetail(selected!)).data?.data ?? null,
  });

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.resolveReport(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ['admin', 'report'] });
      setSelected(null);
    },
  });

  const reports: any[] = data?.data ?? data ?? [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted text-sm mt-1">{reports.length} pendientes</p>
      </div>

      {isLoading ? (
        <p className="text-muted">Cargando…</p>
      ) : reports.length === 0 ? (
        <div className="card p-12 text-center">
          <Flag size={40} className="mx-auto text-muted mb-3" />
          <p className="text-muted">Nada que revisar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-elevated">
                <tr>
                  <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Tipo</th>
                  <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Razón</th>
                  <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Reporters</th>
                  <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.map((r: any) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`cursor-pointer ${selected === r.id ? 'bg-accent/10' : 'hover:bg-elevated/50'}`}
                  >
                    <td className="px-4 py-3 text-sm font-semibold">{r.targetType}</td>
                    <td className="px-4 py-3 text-xs">{r.reason}</td>
                    <td className="px-4 py-3 text-xs">{r._count?.reporters ?? 1}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(r.createdAt).toLocaleDateString('es')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-6">
            {!selected ? (
              <p className="text-muted text-sm">Selecciona un reporte para ver el detalle.</p>
            ) : detail.isLoading ? (
              <p className="text-muted text-sm">Cargando…</p>
            ) : !detail.data ? (
              <p className="text-muted text-sm">Sin datos.</p>
            ) : (
              <div className="space-y-4">
                <h3 className="font-bold">{detail.data.targetType} · {detail.data.reason}</h3>
                <div className="bg-elevated p-4 rounded-xl text-sm max-h-[320px] overflow-auto">
                  <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(detail.data.target ?? detail.data, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted mb-2 uppercase">Reporters</p>
                  <ul className="text-xs space-y-1">
                    {(detail.data.reporters ?? []).map((rep: any) => (
                      <li key={rep.id}>{rep.user?.email} — {rep.comment || '—'}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => resolve.mutate({ id: selected, status: 'RESOLVED' })}
                    disabled={resolve.isPending}
                    className="btn-primary text-sm"
                  >
                    <Check size={14} /> Resolver
                  </button>
                  <button
                    onClick={() => resolve.mutate({ id: selected, status: 'DISMISSED' })}
                    disabled={resolve.isPending}
                    className="btn-ghost text-sm"
                  >
                    <X size={14} /> Descartar
                  </button>
                </div>
                {resolve.error && <p className="text-danger text-xs">{apiError(resolve.error)}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
