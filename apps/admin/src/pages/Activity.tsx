import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon, RefreshCw } from 'lucide-react';
import { adminApi } from '@/api/client';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function Activity() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: async () => unwrap<any[]>(await adminApi.activity(100)),
  });

  const items: any[] = Array.isArray(data) ? data : [];

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ActivityIcon className="text-accent" size={22} /> Registro de actividad
          </h1>
          <p className="text-muted text-sm mt-1">
            Últimas {items.length} acciones del equipo · auditoría
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3 py-2 rounded-xl bg-elevated border border-line text-sm flex items-center gap-2 hover:bg-card disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="card flex-1 overflow-auto">
        {isLoading ? (
          <p className="text-muted text-sm p-6">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-muted text-sm p-6">Sin actividad registrada.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-elevated sticky top-0">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Cuándo</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Actor</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Acción</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Objeto</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((row: any) => (
                <tr key={row.id} className="hover:bg-elevated/50">
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString('es')}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="font-semibold">
                      {row.actor?.profile?.firstName || row.actor?.email || '—'}
                    </span>
                    {row.actor?.role && row.actor.role !== 'USER' && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                        {row.actor.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="px-2 py-0.5 rounded bg-elevated text-zinc-200 font-mono">
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {row.targetType ?? '—'}
                    {row.targetId ? <span className="ml-1 font-mono text-[10px]">#{row.targetId.slice(0, 8)}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-300 max-w-[400px] truncate">
                    {typeof row.detail === 'object' ? JSON.stringify(row.detail) : String(row.detail ?? '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
