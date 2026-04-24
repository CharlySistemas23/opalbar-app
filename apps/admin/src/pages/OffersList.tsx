import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { offersApi, apiError } from '@/api/client';

export function OffersList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['offers', 'admin-list'],
    queryFn: async () => {
      const r = await offersApi.list({ limit: 100 });
      return r.data?.data?.data ?? r.data?.data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => offersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offers'] }),
  });

  const offers: any[] = data ?? [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ofertas</h1>
          <p className="text-muted text-sm mt-1">{offers.length} ofertas</p>
        </div>
        <Link to="/admin/offers/new" className="btn-primary">
          <Plus size={16} /> Nueva oferta
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted">Cargando…</p>
      ) : offers.length === 0 ? (
        <div className="card p-12 text-center">
          <Tag size={40} className="mx-auto text-muted mb-3" />
          <p className="text-muted">No hay ofertas.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-elevated">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Título</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Venue</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Tipo</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Vigencia</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {offers.map((o: any) => (
                <tr key={o.id} className="hover:bg-elevated/50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm">{o.title}</p>
                    {o.isHighlighted && <span className="pill bg-accent/15 text-accent">Destacada</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">{o.venue?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">{o.type}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {o.startDate ? new Date(o.startDate).toLocaleDateString('es') : '—'}
                    {' → '}
                    {o.endDate ? new Date(o.endDate).toLocaleDateString('es') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-3 justify-end items-center">
                      <Link to={`/admin/offers/${o.id}`} className="text-accent text-sm font-semibold hover:underline">Editar</Link>
                      <button
                        onClick={() => { if (confirm('¿Archivar esta oferta?')) del.mutate(o.id); }}
                        className="text-danger text-xs font-bold hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Archivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {del.error && <p className="text-danger text-sm">{apiError(del.error)}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-success/15 text-success',
    SCHEDULED: 'bg-blue-500/15 text-blue-400',
    EXPIRED: 'bg-muted/15 text-muted',
    ARCHIVED: 'bg-muted/15 text-muted',
    DRAFT: 'bg-amber-500/15 text-amber-400',
  };
  return <span className={`pill ${map[status] ?? 'bg-muted/15 text-muted'}`}>{status ?? '—'}</span>;
}
