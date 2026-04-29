import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, Search, Crown, Shield, ShieldCheck } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, StatusPill, InlineError, useDebounced,
} from '@/components/ui';

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

function userInitials(u: any) {
  return (u?.profile?.firstName?.[0] ?? u?.email?.[0] ?? '?').toUpperCase();
}

export function Staff() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 280);
  const qc = useQueryClient();

  const staffQuery = useQuery({
    queryKey: ['admin', 'staff', 'list'],
    queryFn: async () => {
      const r = unwrap<any>(await adminApi.users({ limit: 200 }));
      const list: any[] = Array.isArray(r) ? r : (r?.data ?? []);
      return list.filter((u) => u.role && u.role !== 'USER');
    },
  });

  const searchQuery = useQuery({
    enabled: debounced.trim().length >= 2,
    queryKey: ['admin', 'staff', 'search', debounced.trim()],
    queryFn: async () => {
      const r = unwrap<any>(await adminApi.users({ search: debounced.trim(), limit: 20 }));
      return Array.isArray(r) ? r : (r?.data ?? []);
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => adminApi.updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'staff'] }),
  });

  const staff: any[] = staffQuery.data ?? [];
  const searchResults: any[] = searchQuery.data ?? [];
  const stats = useMemo(() => {
    const c = { SUPER_ADMIN: 0, ADMIN: 0, MODERATOR: 0 };
    staff.forEach((u) => {
      if (u.role in c) (c as any)[u.role]++;
    });
    return c;
  }, [staff]);

  return (
    <div className="page-shell">
      <PageHeader
        icon={UserCog}
        title="Equipo"
        subtitle={`${staff.length} miembros con rol elevado`}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="stat-card__icon"><Crown size={20} /></div>
          <div>
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Super admins</p>
            <p className="text-2xl font-bold tracking-tight">{stats.SUPER_ADMIN}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon"><ShieldCheck size={20} /></div>
          <div>
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Admins</p>
            <p className="text-2xl font-bold tracking-tight">{stats.ADMIN}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon"><Shield size={20} /></div>
          <div>
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Moderadores</p>
            <p className="text-2xl font-bold tracking-tight">{stats.MODERATOR}</p>
          </div>
        </div>
      </div>

      <InlineError message={updateRole.error ? apiError(updateRole.error) : null} />

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Equipo actual */}
        <div className="card overflow-auto">
          <div className="px-4 py-3 border-b border-line/60 bg-elevated sticky top-0 z-10">
            <p className="section-title">Miembros del equipo</p>
          </div>
          {staffQuery.isLoading ? (
            <SkeletonRows rows={5} height={56} />
          ) : staff.length === 0 ? (
            <EmptyState icon={UserCog} title="Sin miembros del equipo" message="Promové un usuario desde el buscador →" />
          ) : (
            <ul className="divide-y divide-line/60">
              {staff.map((u) => (
                <StaffRow key={u.id} user={u} onChangeRole={(role) => updateRole.mutate({ id: u.id, role })} />
              ))}
            </ul>
          )}
        </div>

        {/* Buscador */}
        <div className="card overflow-auto">
          <div className="px-4 py-3 border-b border-line/60 bg-elevated sticky top-0 z-10 space-y-2">
            <p className="section-title">Promover usuario</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o email…"
                className="input-search"
              />
            </div>
          </div>
          {debounced.trim().length < 2 ? (
            <EmptyState icon={Search} title="Empezá a buscar" message="Escribí al menos 2 caracteres para encontrar usuarios." />
          ) : searchQuery.isLoading ? (
            <SkeletonRows rows={4} height={56} />
          ) : searchResults.length === 0 ? (
            <EmptyState icon={Search} title="Sin resultados" message={`Ningún usuario coincide con "${debounced}".`} />
          ) : (
            <ul className="divide-y divide-line/60">
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
    <li className="p-4 flex items-center gap-3 hover:bg-elevated/40 transition">
      {user.profile?.avatarUrl ? (
        <img src={user.profile.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-line" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-accent/15 ring-1 ring-accent/30 flex items-center justify-center">
          <span className="text-xs font-bold text-accent">{userInitials(user)}</span>
        </div>
      )}
      <div className="flex-1 min-w-0 leading-tight">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{userLabel(user)}</p>
          <StatusPill status={user.role} />
        </div>
        <p className="text-[11px] text-muted truncate">{user.email}</p>
      </div>
      <select
        title="Cambiar rol"
        value={user.role}
        onChange={(e) => onChangeRole(e.target.value as Role)}
        className="bg-elevated border border-line rounded-lg px-2 py-1 text-xs focus:border-accent/60 focus:outline-none"
      >
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </li>
  );
}
