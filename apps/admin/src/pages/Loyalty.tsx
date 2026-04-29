import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Plus, Trash2, Pencil, X } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

interface LoyaltyForm {
  id?: string;
  name: string;
  level: number;
  pointsRequired: number;
  benefits?: string;
  color?: string;
  icon?: string;
}

const empty: LoyaltyForm = { name: '', level: 1, pointsRequired: 0, benefits: '', color: '', icon: '' };

export function Loyalty() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<LoyaltyForm | null>(null);

  const levelsQuery = useQuery({
    queryKey: ['admin', 'loyalty', 'levels'],
    queryFn: async () => unwrap<any[]>(await adminApi.loyaltyLevels()),
  });

  const save = useMutation({
    mutationFn: async (form: LoyaltyForm) => {
      const payload = {
        name: form.name,
        level: Number(form.level),
        pointsRequired: Number(form.pointsRequired),
        benefits: form.benefits || undefined,
        color: form.color || undefined,
        icon: form.icon || undefined,
      };
      if (form.id) return adminApi.updateLoyaltyLevel(form.id, payload);
      return adminApi.createLoyaltyLevel(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'loyalty'] });
      setEditor(null);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteLoyaltyLevel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'loyalty'] }),
  });

  const levels: any[] = Array.isArray(levelsQuery.data) ? levelsQuery.data : [];
  const sorted = [...levels].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="text-accent" size={22} /> Niveles de fidelidad
          </h1>
          <p className="text-muted text-sm mt-1">{levels.length} niveles configurados</p>
        </div>
        <button
          onClick={() => setEditor({ ...empty, level: (sorted[sorted.length - 1]?.level ?? 0) + 1 })}
          className="px-3 py-2 rounded-xl bg-accent/15 border border-accent/40 text-accent text-sm font-bold flex items-center gap-2 hover:bg-accent/25"
        >
          <Plus size={14} /> Nuevo nivel
        </button>
      </div>

      {(save.error || del.error) && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(save.error ?? del.error)}
        </div>
      )}

      <div className="card overflow-auto">
        {levelsQuery.isLoading ? (
          <p className="text-muted text-sm p-6">Cargando…</p>
        ) : sorted.length === 0 ? (
          <p className="text-muted text-sm p-6">Sin niveles. Creá el primero.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-elevated">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Nivel</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Nombre</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Puntos</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Beneficios</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((l: any) => (
                <tr key={l.id} className="hover:bg-elevated/40">
                  <td className="px-4 py-3 text-sm font-bold">{l.level}</td>
                  <td className="px-4 py-3 text-sm">
                    {l.icon && <span className="mr-2">{l.icon}</span>}
                    {l.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">{l.pointsRequired ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-muted max-w-[400px] truncate">{l.benefits ?? ''}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditor({
                        id: l.id,
                        name: l.name ?? '',
                        level: l.level ?? 1,
                        pointsRequired: l.pointsRequired ?? 0,
                        benefits: l.benefits ?? '',
                        color: l.color ?? '',
                        icon: l.icon ?? '',
                      })}
                      className="p-1.5 rounded hover:bg-elevated text-muted"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Eliminar nivel "${l.name}"?`)) del.mutate(l.id);
                      }}
                      className="p-1.5 rounded hover:bg-danger/15 text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditor(null)}>
          <div className="bg-zinc-950 border border-line rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editor.id ? 'Editar nivel' : 'Nuevo nivel'}</h2>
              <button onClick={() => setEditor(null)} className="p-1 rounded hover:bg-elevated">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Nombre" value={editor.name} onChange={(v) => setEditor({ ...editor, name: v })} />
              <Field label="Nivel (orden)" type="number" value={String(editor.level)} onChange={(v) => setEditor({ ...editor, level: Number(v) })} />
              <Field label="Puntos requeridos" type="number" value={String(editor.pointsRequired)} onChange={(v) => setEditor({ ...editor, pointsRequired: Number(v) })} />
              <Field label="Icono (emoji)" value={editor.icon ?? ''} onChange={(v) => setEditor({ ...editor, icon: v })} />
              <Field label="Color (hex)" value={editor.color ?? ''} onChange={(v) => setEditor({ ...editor, color: v })} />
              <label className="block">
                <span className="text-xs font-bold text-muted tracking-wide uppercase">Beneficios</span>
                <textarea
                  rows={3}
                  value={editor.benefits ?? ''}
                  onChange={(e) => setEditor({ ...editor, benefits: e.target.value })}
                  className="input-field mt-1.5"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditor(null)} className="flex-1 px-3 py-2 rounded-xl bg-elevated border border-line text-sm">Cancelar</button>
              <button
                onClick={() => save.mutate(editor)}
                disabled={save.isPending || !editor.name}
                className="flex-1 px-3 py-2 rounded-xl bg-accent text-black text-sm font-bold disabled:opacity-50"
              >
                {save.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted tracking-wide uppercase">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1.5" />
    </label>
  );
}
