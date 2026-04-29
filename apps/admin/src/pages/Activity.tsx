import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon, RefreshCw, Filter } from 'lucide-react';
import { adminApi } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, Toolbar, useDebounced, StatusPill,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function Activity() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const debounced = useDebounced(search, 250);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: async () => unwrap<any[]>(await adminApi.activity(200)),
  });

  const items: any[] = Array.isArray(data) ? data : [];

  const actions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((r) => r.action && set.add(r.action));
    return ['ALL', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return items.filter((r) => {
      if (actionFilter !== 'ALL' && r.action !== actionFilter) return false;
      if (!q) return true;
      const haystack = [
        r.actor?.email, r.actor?.profile?.firstName, r.actor?.profile?.lastName,
        r.action, r.targetType, r.targetId,
        typeof r.detail === 'object' ? JSON.stringify(r.detail) : r.detail,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [items, debounced, actionFilter]);

  return (
    <div className="page-shell">
      <PageHeader
        icon={ActivityIcon}
        title="Registro de actividad"
        subtitle={`${filtered.length} de ${items.length} acciones · auditoría`}
        actions={
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-ghost">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Actualizar
          </button>
        }
      />

      <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Buscar por usuario, acción o detalle…">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted" />
          <select
            title="Filtrar por acción"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-card border border-line rounded-lg px-2 py-1.5 text-xs"
          >
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </Toolbar>

      <div className="card flex-1 overflow-auto">
        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ActivityIcon} title="Sin actividad" message="Cuando el equipo realice acciones, aparecerán aquí." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Actor</th>
                <th>Acción</th>
                <th>Objeto</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row: any) => (
                <tr key={row.id}>
                  <td className="text-xs text-muted whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString('es')}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {row.actor?.profile?.firstName || row.actor?.email || '—'}
                      </span>
                      {row.actor?.role && row.actor.role !== 'USER' && (
                        <StatusPill status={row.actor.role} />
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-xs px-2 py-1 rounded bg-elevated/60 ring-1 ring-line">
                      {row.action}
                    </span>
                  </td>
                  <td className="text-xs text-muted">
                    {row.targetType ?? '—'}
                    {row.targetId ? <span className="ml-1.5 font-mono text-[10px] opacity-70">#{row.targetId.slice(0, 8)}</span> : null}
                  </td>
                  <td className="text-xs text-zinc-300 max-w-[420px] truncate">
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
