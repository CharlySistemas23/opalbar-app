import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Shield, Ban, Check, Users as UsersIcon } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';

const STATUSES = ['', 'ACTIVE', 'BANNED', 'PENDING_VERIFICATION', 'DELETED'];
const ROLES = ['', 'USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'];

export function Users() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, status, role, search],
    queryFn: async () => {
      const r = await adminApi.users({ page, limit: 25, status: status || undefined, role: role || undefined, search: search || undefined });
      return r.data?.data ?? r.data;
    },
  });

  const ban = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.banUser(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const unban = useMutation({
    mutationFn: (id: string) => adminApi.unbanUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const users: any[] = data?.data || data?.users || data || [];
  const total = data?.total ?? data?.meta?.total ?? users.length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-muted text-sm mt-1">{total} usuarios</p>
        </div>
      </div>

      <div className="card p-4 flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search size={16} className="text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por email o nombre…"
            className="input-field"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field max-w-[180px]">
          <option value="">Todos los estados</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="input-field max-w-[180px]">
          <option value="">Todos los roles</option>
          {ROLES.filter(Boolean).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-muted">Cargando…</p>
      ) : users.length === 0 ? (
        <div className="card p-12 text-center">
          <UsersIcon size={40} className="mx-auto text-muted mb-3" />
          <p className="text-muted">Sin resultados</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-elevated">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Usuario</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Rol</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Estado</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Puntos</th>
                <th className="text-left text-xs font-bold text-muted uppercase px-4 py-3">Registro</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-elevated/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.profile?.avatarUrl ? (
                        <img src={u.profile.avatarUrl} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                          {(u.profile?.firstName?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
                        </div>
                      )}
                      <div className="leading-tight">
                        <p className="text-sm font-semibold">{u.profile?.firstName ?? ''} {u.profile?.lastName ?? ''}</p>
                        <p className="text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="pill bg-accent/15 text-accent">
                      <Shield size={10} /> {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">{u.points ?? u.profile?.points ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link to={`/admin/users/${u.id}`} className="text-accent text-sm font-semibold hover:underline">Ver</Link>
                      {u.status === 'BANNED' ? (
                        <button
                          onClick={() => unban.mutate(u.id)}
                          disabled={unban.isPending}
                          className="text-xs text-success font-bold hover:underline flex items-center gap-1"
                        >
                          <Check size={12} /> Desbanear
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const reason = prompt('Motivo del ban:');
                            if (reason) ban.mutate({ id: u.id, reason });
                          }}
                          disabled={ban.isPending}
                          className="text-xs text-danger font-bold hover:underline flex items-center gap-1"
                        >
                          <Ban size={12} /> Banear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(ban.error || unban.error) && (
        <p className="text-danger text-sm">{apiError(ban.error || unban.error)}</p>
      )}

      <Pagination page={page} setPage={setPage} hasMore={users.length >= 25} />
    </div>
  );
}

export function UserDetail({ id }: { id: string }) {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: async () => (await adminApi.user(id)).data?.data ?? (await adminApi.user(id)).data,
  });
  const audit = useQuery({
    queryKey: ['admin', 'user', id, 'audit'],
    queryFn: async () => (await adminApi.userAudit(id)).data?.data ?? [],
  });

  const adjustPoints = useMutation({
    mutationFn: (p: { delta: number; reason: string }) => adminApi.adjustPoints(id, p.delta, p.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'user', id] }),
  });
  const updateRole = useMutation({
    mutationFn: (role: string) => adminApi.updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'user', id] }),
  });
  const updateNote = useMutation({
    mutationFn: (note: string | null) => adminApi.updateNote(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'user', id] }),
  });

  if (isLoading) return <div className="p-8 text-muted">Cargando…</div>;
  if (!data) return <div className="p-8 text-muted">No encontrado</div>;

  const u = data;
  const isSuper = me?.role === 'SUPER_ADMIN';

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <Link to="/admin/users" className="text-sm text-muted hover:text-zinc-100">← Volver</Link>

      <div className="card p-6 flex items-center gap-4">
        {u.profile?.avatarUrl ? (
          <img src={u.profile.avatarUrl} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-xl font-bold text-accent">
            {(u.profile?.firstName?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold">{u.profile?.firstName} {u.profile?.lastName}</h1>
          <p className="text-muted text-sm">{u.email}</p>
          <div className="flex gap-2 mt-2">
            <span className="pill bg-accent/15 text-accent"><Shield size={10} /> {u.role}</span>
            <StatusPill status={u.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold mb-3">Puntos</h3>
          <p className="text-3xl font-extrabold">{u.points ?? u.profile?.points ?? 0}</p>
          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost text-xs"
              onClick={() => {
                const d = prompt('Delta (e.g. +50 ó -10):');
                const reason = d ? prompt('Motivo:') : null;
                if (d && reason) adjustPoints.mutate({ delta: Number(d), reason });
              }}
            >
              Ajustar puntos
            </button>
          </div>
        </div>

        {isSuper && (
          <div className="card p-5">
            <h3 className="font-bold mb-3">Rol</h3>
            <select
              value={u.role}
              onChange={(e) => updateRole.mutate(e.target.value)}
              className="input-field"
            >
              {ROLES.filter(Boolean).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-3">Nota interna</h3>
        <textarea
          defaultValue={u.profile?.internalNote ?? ''}
          onBlur={(e) => updateNote.mutate(e.target.value || null)}
          placeholder="Solo visible para el equipo…"
          className="input-field min-h-[80px]"
        />
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-3">Historial de acciones (admin)</h3>
        {(audit.data || []).length === 0 ? (
          <p className="text-muted text-sm">Sin registros.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(audit.data || []).map((e: any) => (
              <li key={e.id} className="flex gap-3 items-start border-b border-line pb-2">
                <span className="text-xs text-muted shrink-0 w-32">
                  {new Date(e.createdAt).toLocaleString('es')}
                </span>
                <span>
                  <b>{e.action}</b>{e.reason && ` — ${e.reason}`}
                  <span className="text-muted ml-2">por {e.admin?.email ?? '—'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-success/15 text-success',
    BANNED: 'bg-danger/15 text-danger',
    PENDING_VERIFICATION: 'bg-amber-500/15 text-amber-400',
    DELETED: 'bg-muted/15 text-muted',
  };
  return <span className={`pill ${map[status] ?? 'bg-muted/15 text-muted'}`}>{status ?? '—'}</span>;
}

function Pagination({ page, setPage, hasMore }: { page: number; setPage: (n: number) => void; hasMore: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost text-xs disabled:opacity-40">‹ Anterior</button>
      <span className="text-sm text-muted">Página {page}</span>
      <button disabled={!hasMore} onClick={() => setPage(page + 1)} className="btn-ghost text-xs disabled:opacity-40">Siguiente ›</button>
    </div>
  );
}
