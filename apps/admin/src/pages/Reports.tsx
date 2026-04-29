import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Check, X, Users } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, StatusPill,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function Reports() {
  const [page] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', page],
    queryFn: async () => unwrap<any>(await adminApi.reports({ page, limit: 25 })),
  });

  const detail = useQuery({
    enabled: !!selected,
    queryKey: ['admin', 'report', selected],
    queryFn: async () => unwrap<any>(await adminApi.reportDetail(selected!)),
  });

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.resolveReport(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ['admin', 'report'] });
      setSelected(null);
    },
  });

  const reports: any[] = Array.isArray(data) ? data : (data?.data ?? data ?? []);

  return (
    <div className="page-shell">
      <PageHeader
        icon={Flag}
        title="Reportes"
        subtitle={`${reports.length} reportes`}
      />

      <InlineError message={resolve.error ? apiError(resolve.error) : null} />

      {isLoading ? (
        <div className="card flex-1"><SkeletonRows rows={6} /></div>
      ) : reports.length === 0 ? (
        <div className="card flex-1 flex items-center justify-center">
          <EmptyState icon={Flag} title="Nada que revisar" message="Cuando los usuarios reporten contenido, aparecerá aquí." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-4 flex-1 min-h-0">
          {/* List */}
          <div className="card overflow-auto">
            <div className="px-4 py-3 border-b border-line/60 bg-elevated sticky top-0 z-10">
              <p className="section-title">Reportes · {reports.length}</p>
            </div>
            <ul className="divide-y divide-line/60">
              {reports.map((r: any) => {
                const active = selected === r.id;
                return (
                  <li
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`p-4 cursor-pointer transition border-l-2 ${active ? 'bg-accent/10 border-accent' : 'border-transparent hover:bg-elevated/40'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="pill-muted">{r.targetType}</span>
                      <StatusPill status={r.status ?? 'PENDING'} />
                    </div>
                    <p className="text-sm font-bold">{r.reason}</p>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1"><Users size={10} /> {r._count?.reporters ?? 1}</span>
                      <span>{new Date(r.createdAt).toLocaleDateString('es')}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detail */}
          <div className="card p-6 overflow-auto">
            {!selected ? (
              <EmptyState icon={Flag} title="Sin selección" message="Elegí un reporte de la lista para ver el detalle." />
            ) : detail.isLoading ? (
              <SkeletonRows rows={6} height={32} />
            ) : !detail.data ? (
              <EmptyState icon={Flag} title="Sin datos" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-muted tracking-wider uppercase">{detail.data.targetType}</p>
                    <h3 className="text-lg font-bold tracking-tight">{detail.data.reason}</h3>
                  </div>
                  <StatusPill status={detail.data.status ?? 'PENDING'} />
                </div>

                <div>
                  <p className="section-title mb-2">Contenido reportado</p>
                  <div className="bg-elevated/60 ring-1 ring-line p-4 rounded-xl text-xs max-h-[280px] overflow-auto">
                    <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(detail.data.target ?? detail.data, null, 2)}</pre>
                  </div>
                </div>

                <div>
                  <p className="section-title mb-2">Reporters · {(detail.data.reporters ?? []).length}</p>
                  <ul className="space-y-1.5">
                    {(detail.data.reporters ?? []).map((rep: any) => (
                      <li key={rep.id} className="text-xs flex items-center justify-between p-2 rounded-lg bg-elevated/40">
                        <span className="font-mono">{rep.user?.email ?? '—'}</span>
                        <span className="text-muted truncate ml-2">{rep.comment || '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => resolve.mutate({ id: selected, status: 'RESOLVED' })}
                    disabled={resolve.isPending}
                    className="btn-success"
                  >
                    <Check size={14} /> Resolver
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve.mutate({ id: selected, status: 'DISMISSED' })}
                    disabled={resolve.isPending}
                    className="btn-ghost"
                  >
                    <X size={14} /> Descartar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
