import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';

export function Config() {
  const { user } = useAuthStore();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();

  const flags = useQuery({
    queryKey: ['admin', 'flags'],
    queryFn: async () => (await adminApi.flags()).data?.data ?? [],
  });

  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => adminApi.toggleFlag(key, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });

  const list: any[] = flags.data ?? [];

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted text-sm mt-1">Feature flags y ajustes globales</p>
      </div>

      <div className="card p-6 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Settings size={16} /> Feature flags</h3>
        {flags.isLoading ? (
          <p className="text-muted text-sm">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="text-muted text-sm">Sin flags configurados.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((f: any) => (
              <li key={f.key} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold">{f.key}</p>
                  {f.description && <p className="text-xs text-muted">{f.description}</p>}
                </div>
                <button
                  disabled={!isSuper || toggle.isPending}
                  onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
                  className={`p-1 rounded-lg transition ${!isSuper ? 'opacity-50' : 'hover:bg-elevated'}`}
                  title={!isSuper ? 'Solo SUPER_ADMIN puede cambiar flags' : ''}
                >
                  {f.enabled ? (
                    <ToggleRight size={32} className="text-success" />
                  ) : (
                    <ToggleLeft size={32} className="text-muted" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {toggle.error && <p className="text-danger text-xs">{apiError(toggle.error)}</p>}
        {!isSuper && (
          <p className="text-xs text-muted italic">
            Requiere SUPER_ADMIN para modificar flags.
          </p>
        )}
      </div>
    </div>
  );
}
