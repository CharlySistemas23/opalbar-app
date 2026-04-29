import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Check, X } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

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

export function Reviews() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');

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

  const list: any[] = Array.isArray(reviewsQuery.data) ? reviewsQuery.data : (reviewsQuery.data?.data ?? []);

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="text-accent" size={22} /> Reseñas
          </h1>
          <p className="text-muted text-sm mt-1">{list.length} {filter !== 'ALL' ? filter.toLowerCase() : ''}</p>
        </div>
        <div className="flex gap-1 bg-elevated rounded-xl p-1">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                filter === f ? 'bg-accent text-black' : 'text-muted hover:text-zinc-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {moderate.error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(moderate.error)}
        </div>
      )}

      <div className="card flex-1 overflow-auto">
        {reviewsQuery.isLoading ? (
          <p className="text-muted text-sm p-6">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="text-muted text-sm p-6">Sin reseñas {filter !== 'ALL' ? `con estado ${filter}` : ''}.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r: any) => (
              <li key={r.id} className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  {r.user?.profile?.avatarUrl ? (
                    <img src={r.user.profile.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-accent">{(r.user?.profile?.firstName?.[0] ?? '?').toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{userLabel(r.user)}</p>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < (r.rating ?? 0) ? 'fill-accent text-accent' : 'text-muted'} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted">
                      {new Date(r.createdAt).toLocaleString('es')} · {r.status}
                      {r.venue?.name && <span> · {r.venue.name}</span>}
                    </p>
                    {r.title && <p className="text-sm font-bold mt-1">{r.title}</p>}
                    {r.content && <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap">{r.content}</p>}
                  </div>
                </div>
                {r.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => moderate.mutate({ id: r.id, action: 'APPROVED' })}
                      disabled={moderate.isPending}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-success/15 border border-success/40 text-success text-xs font-bold hover:bg-success/25 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Check size={12} /> Aprobar
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Motivo de rechazo (opcional):') || undefined;
                        moderate.mutate({ id: r.id, action: 'REJECTED', reason });
                      }}
                      disabled={moderate.isPending}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-danger/15 border border-danger/40 text-danger text-xs font-bold hover:bg-danger/25 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <X size={12} /> Rechazar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
