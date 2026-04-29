import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ToggleLeft, ToggleRight, Flag } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

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

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flag className="text-accent" size={22} /> Feature Flags
        </h1>
        <p className="text-muted text-sm mt-1">
          Encender/apagar features sin redeploy · {flags.length} flags
        </p>
      </div>

      {toggle.error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(toggle.error)}
        </div>
      )}

      <div className="card overflow-auto">
        {flagsQuery.isLoading ? (
          <p className="text-muted text-sm p-6">Cargando…</p>
        ) : flags.length === 0 ? (
          <p className="text-muted text-sm p-6">Sin flags definidos.</p>
        ) : (
          <ul className="divide-y divide-line">
            {flags.map((f: any) => (
              <li key={f.key} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold font-mono">{f.key}</p>
                  {f.description && <p className="text-xs text-muted mt-0.5">{f.description}</p>}
                  {f.updatedAt && (
                    <p className="text-[10px] text-muted mt-1">
                      Última modificación: {new Date(f.updatedAt).toLocaleString('es')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
                  disabled={toggle.isPending}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition ${
                    f.enabled
                      ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
                      : 'bg-elevated border-line text-muted hover:bg-card'
                  }`}
                >
                  {f.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {f.enabled ? 'ACTIVO' : 'APAGADO'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
