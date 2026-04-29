import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Zap, Power } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import { PageHeader, EmptyState, SkeletonRows, InlineError, Switch, StatCard } from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

export function Flags() {
  const qc = useQueryClient();

  const flagsQuery = useQuery({
    queryKey: ['admin', 'flags'],
    queryFn: async () => unwrap<any[]>(await adminApi.flags()),
  });

  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => adminApi.toggleFlag(key, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });

  const flags: any[] = Array.isArray(flagsQuery.data) ? flagsQuery.data : [];
  const active = flags.filter((f) => f.enabled).length;
  const inactive = flags.length - active;

  return (
    <div className="page-shell">
      <PageHeader
        icon={Flag}
        title="Feature Flags"
        subtitle="Encender/apagar features sin redeploy. Los cambios son inmediatos."
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Zap} label="Activos" value={active} tone="success" />
        <StatCard icon={Power} label="Apagados" value={inactive} tone="warning" />
      </div>

      <InlineError message={toggle.error ? apiError(toggle.error) : null} />

      <div className="card flex-1 overflow-auto">
        {flagsQuery.isLoading ? (
          <SkeletonRows rows={6} height={64} />
        ) : flags.length === 0 ? (
          <EmptyState icon={Flag} title="Sin flags definidos" message="Cuando registres un feature flag en el backend, aparecerá aquí." />
        ) : (
          <ul className="divide-y divide-line/60">
            {flags.map((f: any) => (
              <li key={f.key} className="p-5 flex items-center gap-4 hover:bg-elevated/30 transition">
                <div className={`w-2 h-2 rounded-full shrink-0 ${f.enabled ? 'bg-success animate-pulse-soft' : 'bg-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold font-mono">{f.key}</p>
                  {f.description && <p className="text-xs text-muted mt-0.5">{f.description}</p>}
                  {f.updatedAt && (
                    <p className="text-[10px] text-muted mt-1">
                      Última modificación: {new Date(f.updatedAt).toLocaleString('es')}
                    </p>
                  )}
                </div>
                <Switch
                  checked={!!f.enabled}
                  disabled={toggle.isPending}
                  onChange={(next) => toggle.mutate({ key: f.key, enabled: next })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
