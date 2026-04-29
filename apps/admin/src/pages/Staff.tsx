import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Search, UserCog, AlertTriangle } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

const STAFF_ROLES = ['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as const;
type Role = typeof STAFF_ROLES[number];

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

function userLabel(u: any) {
  const fn = u?.profile?.firstName?.trim();
  const ln = u?.profile?.lastName?.trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
  return u?.email ?? '—';
}

export function Staff() {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  // Show ALL non-USER members + recent users matching search
  const staffQuery = useQuery({
    queryKey: ['admin', 'staff', 'list'],
    queryFn: async () => {
      const r = unwrap<any>(await adminApi.users({ limit: 200 }));
      const list: any[] = Array.isArray(r) ? r : (r?.data ?? []);
      return list.filter((u) => u.role && u.role !== 'USER');
    },
  });

  const searchQuery = useQuery({
    enabled: search.trim().length >= 2,
    queryKey: ['admin', 'staff', 'search', search.trim()],
    queryFn: async () => {
      const r = unwrap<any>(await adminApi.users({ search: search.trim(), limit: 20 }));
      const list: any[] = Array.isArray(r) ? r : (r?.data ?? []);
      return list;
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => adminApi.updateRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
    },
  });

  const staff: any[] = staffQuery.data ?? [];
  const searchResults: any[] = searchQuery.data ?? [];

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="text-accent" size={22} /> Equipo
          </h1>
          <p className="text-muted text-sm mt-1">
            {staff.length} miembros con rol elevado
          </p>
        </div>
        <div className="relative max-w-[320px] w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario para promover…"
            className="input-field pl-9"
          />
        </div>
      </div>

      {updateRole.error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {apiError(updateRole.error)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="card overflow-auto">
          <div className="px-4 py-3 border-b border-line bg-elevated">
            <p className="text-xs font-bold text-muted uppercase">Miembros del equipo</p>
          </div>
          {staffQuery.isLoading ? (
            <p className="text-muted text-sm p-4">Cargando…</p>
          ) : staff.length === 0 ? (
            <p className="text-muted text-sm p-4">Sin miembros del equipo.</p>
          ) : (
            <ul className="divide-y divide-line">
              {staff.map((u) => (
                <StaffRow key={u.id} user={u} onChangeRole={(role) => updateRole.mutate({ id: u.id, role })} />
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-auto">
          <div className="px-4 py-3 border-b border-line bg-elevated">
            <p className="text-xs font-bold text-muted uppercase">
              {search.trim().length >= 2 ? `Resultados para "${search}"` : 'Buscá un usuario para promoverlo'}
            </p>
          </div>
          {search.trim().length < 2 ? (
            <p className="text-muted text-sm p-4">Escribí al menos 2 caracteres.</p>
          ) : searchQuery.isLoading ? (
            <p className="text-muted text-sm p-4">Buscando…</p>
          ) : searchResults.length === 0 ? (
            <p className="text-muted text-sm p-4">Sin resultados.</p>
          ) : (
            <ul className="divide-y divide-line">
              {searchResults.map((u) => (
                <StaffRow key={u.id} user={u} onChangeRole={(role) => updateRole.mutate({ id: u.id, role })} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffRow({ user, onChangeRole }: { user: any; onChangeRole: (role: Role) => void }) {
  return (
    <li className="p-4 flex items-center gap-3">
      {user.profile?.avatarUrl ? (
        <img src={user.profile.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
          <span className="text-xs font-bold text-accent">
            {(user.profile?.firstName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0 leading-tight">
        <p className="text-sm font-semibold truncate">{userLabel(user)}</p>
        <p className="text-[10px] text-muted truncate">{user.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <Shield size={12} className="text-accent" />
        <select
          value={user.role}
          onChange={(e) => onChangeRole(e.target.value as Role)}
          className="bg-elevated border border-line rounded-lg px-2 py-1 text-xs"
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
    </li>
  );
}
