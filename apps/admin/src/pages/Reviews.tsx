import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Check, X, Trash2 } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Segmented, StatusPill, ConfirmDialog,
} from '@/components/ui';

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

const FILTERS = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
  { value: 'ALL', label: 'Todas' },
] as const;

export function Reviews() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<typeof FILTERS[number]['value']>('PENDING');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const reviewsQuery = useQuery({
    queryKey: ['admin', 'reviews', filter],
    queryFn: async () => {
      const params = filter === 'ALL' ? {} : { status: filter };
      return unwrap<any>(await adminApi.reviews(params));
    },
  });

  const moderate = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      adminApi.moderateReview(id, action, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });

  const hardDel = useMutation({
    mutationFn: (id: string) => adminApi.hardDeleteReview(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });

  const bulkDel = useMutation({
    mutationFn: (ids: string[]) => adminApi.bulkDeleteReviews(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      setSelected(new Set());
    },
  });

  function toggleSel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const list: any[] = Array.isArray(reviewsQuery.data) ? reviewsQuery.data : (reviewsQuery.data?.data ?? []);

  return (
    <div className="page-shell">
      <PageHeader
        icon={Star}
        title="Reseñas"
        subtitle={`${list.length} ${filter !== 'ALL' ? FILTERS.find((f) => f.value === filter)?.label.toLowerCase() : 'totales'}`}
        actions={
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setConfirmBulk(true)}
                className="btn-danger"
              >
                <Trash2 size={14} /> Eliminar {selected.size}
              </button>
            )}
            <Segmented options={FILTERS} value={filter} onChange={setFilter} />
          </div>
        }
      />

      <InlineError message={moderate.error ? apiError(moderate.error) : hardDel.error ? apiError(hardDel.error) : null} />

      <div className="card flex-1 overflow-auto">
        {reviewsQuery.isLoading ? (
          <SkeletonRows rows={4} height={120} />
        ) : list.length === 0 ? (
          <EmptyState icon={Star} title="Sin reseñas" message={`No hay reseñas con estado ${filter}.`} />
        ) : (
          <ul className="divide-y divide-line/60">
            {list.map((r: any) => (
              <li key={r.id} className="p-5 hover:bg-elevated/30 transition space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar reseña"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSel(r.id)}
                    className="mt-1 w-4 h-4 accent-accent shrink-0"
                  />
                  {r.user?.profile?.avatarUrl ? (
                    <img src={r.user.profile.avatarUrl} className="w-11 h-11 rounded-full object-cover ring-1 ring-line" alt="" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-accent/15 ring-1 ring-accent/30 flex items-center justify-center">
                      <span className="text-xs font-bold text-accent">{(r.user?.profile?.firstName?.[0] ?? '?').toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate">{userLabel(r.user)}</p>
                      <StatusPill status={r.status} />
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={13} className={i < (r.rating ?? 0) ? 'fill-accent text-accent' : 'text-muted'} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      {new Date(r.createdAt).toLocaleString('es')}
                      {r.venue?.name && <span> · {r.venue.name}</span>}
                    </p>
                    {r.title && <p className="text-sm font-bold mt-2">{r.title}</p>}
                    {r.content && <p className="text-sm text-zinc-300 mt-1.5 whitespace-pre-wrap leading-relaxed">{r.content}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {r.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        onClick={() => moderate.mutate({ id: r.id, action: 'APPROVED' })}
                        disabled={moderate.isPending}
                        className="btn-success py-1.5 text-xs"
                      >
                        <Check size={12} /> Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const reason = prompt('Motivo de rechazo (opcional):') || undefined;
                          moderate.mutate({ id: r.id, action: 'REJECTED', reason });
                        }}
                        disabled={moderate.isPending}
                        className="btn-danger py-1.5 text-xs"
                      >
                        <X size={12} /> Rechazar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDel(r.id)}
                    disabled={hardDel.isPending}
                    title="Eliminar permanentemente (spam, abuso)"
                    className="btn-ghost py-1.5 text-xs hover:bg-danger/15 hover:text-danger ml-auto"
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar reseña permanentemente?"
        message="Esta acción es irreversible. La reseña desaparecerá de la base de datos. Solo para spam, abuso o contenido prohibido."
        destructive
        confirmLabel="Eliminar permanente"
        onConfirm={() => confirmDel && hardDel.mutate(confirmDel)}
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title={`Eliminar ${selected.size} reseñas seleccionadas?`}
        message="Se marcan como REJECTED y se ocultan del feed. Útil para limpiar spam masivo. Acción irreversible."
        destructive
        confirmLabel={`Eliminar ${selected.size}`}
        onConfirm={() => bulkDel.mutate(Array.from(selected))}
      />
    </div>
  );
}
