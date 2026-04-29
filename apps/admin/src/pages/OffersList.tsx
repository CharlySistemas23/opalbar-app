import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Tag, Trash2, Pencil, Star } from 'lucide-react';
import { offersApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, StatusPill, Toolbar, useDebounced,
  ConfirmDialog, InlineError,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data?.data ?? p?.data?.data ?? p?.data ?? p) as T;
}

export function OffersList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['offers', 'admin-list'],
    queryFn: async () => unwrap<any[]>(await offersApi.list({ limit: 100 })),
  });

  const del = useMutation({
    mutationFn: (id: string) => offersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offers'] }),
  });

  const offers: any[] = Array.isArray(data) ? data : [];
  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o: any) =>
      [o.title, o.venue?.name, o.type, o.status].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [offers, debounced]);

  return (
    <div className="page-shell">
      <PageHeader
        icon={Tag}
        title="Ofertas"
        subtitle={`${filtered.length} de ${offers.length} ofertas`}
        actions={
          <Link to="/admin/offers/new" className="btn-primary">
            <Plus size={14} /> Nueva oferta
          </Link>
        }
      />

      <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Buscar oferta, venue, tipo o status…" />

      <InlineError message={del.error ? apiError(del.error) : null} />

      <div className="card flex-1 overflow-auto">
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={offers.length === 0 ? 'No hay ofertas' : 'Sin resultados'}
            message={offers.length === 0 ? 'Creá tu primera oferta.' : 'Probá con otro término.'}
            action={offers.length === 0 ? (
              <Link to="/admin/offers/new" className="btn-primary"><Plus size={14} /> Crear oferta</Link>
            ) : undefined}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Venue</th>
                <th>Tipo</th>
                <th>Vigencia</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{o.title}</p>
                      {o.isHighlighted && (
                        <span className="pill-accent inline-flex items-center gap-1">
                          <Star size={9} /> Destacada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-sm text-muted">{o.venue?.name ?? '—'}</td>
                  <td className="text-sm">{o.type}</td>
                  <td className="text-xs text-muted">
                    {o.startDate ? new Date(o.startDate).toLocaleDateString('es') : '—'}
                    {' → '}
                    {o.endDate ? new Date(o.endDate).toLocaleDateString('es') : '—'}
                  </td>
                  <td><StatusPill status={o.status} /></td>
                  <td className="text-right whitespace-nowrap">
                    <Link
                      to={`/admin/offers/${o.id}`}
                      className="inline-flex items-center gap-1 text-accent text-xs font-semibold hover:underline mr-3"
                    >
                      <Pencil size={12} /> Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmDel({ id: o.id, title: o.title })}
                      className="inline-flex items-center gap-1 text-danger text-xs font-bold hover:underline"
                    >
                      <Trash2 size={12} /> Archivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`Archivar "${confirmDel?.title}"?`}
        message="La oferta dejará de mostrarse en la app. Podés restaurarla desde el detalle."
        destructive
        confirmLabel="Archivar"
        onConfirm={() => confirmDel && del.mutate(confirmDel.id)}
      />
    </div>
  );
}
