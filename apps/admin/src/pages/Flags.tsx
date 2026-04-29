import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Zap, Power, Plus, Trash2, Pencil } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Switch, StatCard,
  Modal, Field, ConfirmDialog,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

interface FlagForm {
  key: string;
  description: string;
  enabled: boolean;
}

const empty: FlagForm = { key: '', description: '', enabled: false };

export function Flags() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState<FlagForm | null>(null);
  const [editing, setEditing] = useState<{ key: string; description: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const flagsQuery = useQuery({
    queryKey: ['admin', 'flags'],
    queryFn: async () => unwrap<any[]>(await adminApi.flags()),
  });

  const create = useMutation({
    mutationFn: (form: FlagForm) =>
      adminApi.createFlag({
        key: form.key.trim(),
        description: form.description.trim() || undefined,
        enabled: form.enabled,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'flags'] }); setCreating(null); },
  });

  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => adminApi.toggleFlag(key, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });

  const updateDesc = useMutation({
    mutationFn: ({ key, description }: { key: string; description: string }) =>
      adminApi.updateFlag(key, { description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'flags'] }); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: (key: string) => adminApi.deleteFlag(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });

  const flags: any[] = Array.isArray(flagsQuery.data) ? flagsQuery.data : [];
  const active = flags.filter((f) => f.enabled).length;
  const inactive = flags.length - active;

  const errMsg =
    create.error ? apiError(create.error)
    : toggle.error ? apiError(toggle.error)
    : updateDesc.error ? apiError(updateDesc.error)
    : del.error ? apiError(del.error)
    : null;

  return (
    <div className="page-shell">
      <PageHeader
        icon={Flag}
        title="Feature Flags"
        subtitle="Encender/apagar features sin redeploy. Los cambios son inmediatos."
        actions={
          <button type="button" onClick={() => setCreating(empty)} className="btn-primary">
            <Plus size={14} /> Nuevo flag
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Flag} label="Total" value={flags.length} tone="accent" />
        <StatCard icon={Zap} label="Activos" value={active} tone="success" />
        <StatCard icon={Power} label="Apagados" value={inactive} tone="warning" />
      </div>

      <InlineError message={errMsg} />

      <div className="card flex-1 overflow-auto">
        {flagsQuery.isLoading ? (
          <SkeletonRows rows={6} height={64} />
        ) : flags.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="Sin flags"
            message="Creá tu primer feature flag para empezar a controlar features sin redeploy."
            action={
              <button type="button" onClick={() => setCreating(empty)} className="btn-primary">
                <Plus size={14} /> Crear flag
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-line/60">
            {flags.map((f: any) => (
              <li key={f.key} className="p-5 flex items-center gap-4 hover:bg-elevated/30 transition group">
                <div className={`w-2 h-2 rounded-full shrink-0 ${f.enabled ? 'bg-success animate-pulse-soft' : 'bg-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold font-mono">{f.key}</p>
                  {f.description ? (
                    <p className="text-xs text-muted mt-0.5">{f.description}</p>
                  ) : (
                    <p className="text-xs text-muted/60 mt-0.5 italic">sin descripción</p>
                  )}
                  {f.updatedAt && (
                    <p className="text-[10px] text-muted mt-1">
                      Última modificación: {new Date(f.updatedAt).toLocaleString('es')}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  title="Editar descripción"
                  onClick={() => setEditing({ key: f.key, description: f.description ?? '' })}
                  className="p-1.5 rounded-lg hover:bg-elevated text-muted hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="Eliminar flag"
                  onClick={() => setConfirmDel(f.key)}
                  className="p-1.5 rounded-lg hover:bg-danger/15 text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 size={14} />
                </button>
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

      {/* Create flag modal */}
      <Modal open={!!creating} onClose={() => setCreating(null)} title="Nuevo feature flag">
        {creating && (
          <div className="space-y-3">
            <Field
              label="Key"
              required
              value={creating.key}
              onChange={(v) => setCreating({ ...creating, key: v.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              placeholder="enable_dark_mode"
              hint="snake_case, 3-50 caracteres. Solo letras minúsculas, números y _."
            />
            <Field
              label="Descripción"
              rows={2}
              value={creating.description}
              onChange={(v) => setCreating({ ...creating, description: v })}
              placeholder="¿Qué controla este flag?"
            />
            <label className="flex items-center gap-3 p-3 rounded-xl bg-elevated border border-line cursor-pointer">
              <Switch
                checked={creating.enabled}
                onChange={(next) => setCreating({ ...creating, enabled: next })}
              />
              <div className="flex-1">
                <p className="text-sm font-semibold">Activar al crear</p>
                <p className="text-xs text-muted">Si lo dejás apagado, lo prendés desde la lista cuando quieras.</p>
              </div>
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setCreating(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                type="button"
                onClick={() => creating && create.mutate(creating)}
                disabled={create.isPending || !creating.key.trim()}
                className="btn-primary flex-1"
              >
                {create.isPending ? 'Creando…' : 'Crear flag'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit description modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Editar "${editing?.key}"`}>
        {editing && (
          <div className="space-y-3">
            <Field
              label="Descripción"
              rows={3}
              value={editing.description}
              onChange={(v) => setEditing({ ...editing, description: v })}
            />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                type="button"
                onClick={() => editing && updateDesc.mutate({ key: editing.key, description: editing.description })}
                disabled={updateDesc.isPending}
                className="btn-primary flex-1"
              >
                {updateDesc.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`Eliminar flag "${confirmDel}"?`}
        message="El flag desaparecerá. Cualquier código del backend que lo lea volverá a usar el valor por default."
        destructive
        confirmLabel="Eliminar"
        onConfirm={() => confirmDel && del.mutate(confirmDel)}
      />
    </div>
  );
}
