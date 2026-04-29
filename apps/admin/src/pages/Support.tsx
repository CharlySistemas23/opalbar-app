import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, Send, Plus, Search } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import { Modal, Field, InlineError, useDebounced } from '@/components/ui';

const STATUSES = ['', 'OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function Support() {
  const [status, setStatus] = useState('OPEN');
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState<{
    userId: string; userLabel: string; userSearch: string;
    subject: string; description: string; priority: string;
  } | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tickets', status],
    queryFn: async () => (await adminApi.tickets({ status: status || undefined, limit: 50 })).data?.data ?? [],
  });

  const create = useMutation({
    mutationFn: (form: NonNullable<typeof creating>) => adminApi.createTicketForUser({
      userId: form.userId,
      subject: form.subject.trim(),
      description: form.description.trim(),
      priority: form.priority,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      const created: any = (r as any).data?.data ?? (r as any).data ?? r;
      if (created?.id) setSelected(created.id);
      setCreating(null);
    },
  });

  const debouncedSearch = useDebounced(creating?.userSearch ?? '', 300);
  const userSearchQuery = useQuery({
    enabled: !!creating && !creating.userId && debouncedSearch.trim().length >= 2,
    queryKey: ['admin', 'users-search-ticket', debouncedSearch],
    queryFn: async () => {
      const r = await adminApi.users({ search: debouncedSearch.trim(), limit: 10 });
      return (r.data?.data?.data ?? r.data?.data ?? r.data ?? []) as any[];
    },
  });

  const tickets: any[] = data?.data ?? data ?? [];

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Soporte</h1>
          <p className="text-muted text-sm mt-1">{tickets.length} tickets</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            title="Filtrar por estado"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setSelected(null); }}
            className="input-field max-w-[200px]"
          >
            <option value="">Todos</option>
            {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setCreating({
              userId: '', userLabel: '', userSearch: '',
              subject: '', description: '', priority: 'MEDIUM',
            })}
            className="btn-primary"
          >
            <Plus size={14} /> Nuevo ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[360px,1fr] gap-4 flex-1 min-h-0">
        <div className="card overflow-auto">
          {isLoading ? (
            <p className="text-muted text-sm p-4">Cargando…</p>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox size={36} className="mx-auto text-muted mb-2" />
              <p className="text-muted text-sm">Sin tickets.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {tickets.map((t: any) => (
                <li
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`p-4 cursor-pointer ${selected === t.id ? 'bg-accent/10' : 'hover:bg-elevated/50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{t.subject}</p>
                    <PriorityPill priority={t.priority} />
                  </div>
                  <p className="text-xs text-muted truncate">{t.user?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusPill status={t.status} />
                    <span className="text-[10px] text-muted">{new Date(t.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <TicketThread ticketId={selected} onChange={() => qc.invalidateQueries({ queryKey: ['admin', 'tickets'] })} />
      </div>

      <Modal open={!!creating} onClose={() => setCreating(null)} title="Nuevo ticket en nombre del usuario">
        {creating && (
          <div className="space-y-3">
            {creating.userId ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 ring-1 ring-success/30">
                <span className="text-sm flex-1">{creating.userLabel}</span>
                <button
                  type="button"
                  onClick={() => setCreating({ ...creating, userId: '', userLabel: '', userSearch: '' })}
                  className="text-xs text-muted hover:text-danger"
                >
                  cambiar
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-bold text-muted tracking-wider uppercase mb-2">Cliente</p>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={creating.userSearch}
                    onChange={(e) => setCreating({ ...creating, userSearch: e.target.value })}
                    placeholder="Buscar usuario por nombre o email…"
                    className="input-search"
                  />
                </div>
                {debouncedSearch.trim().length >= 2 && (
                  <div className="card max-h-[160px] overflow-auto mt-2">
                    {userSearchQuery.isLoading ? (
                      <p className="p-3 text-xs text-muted">Buscando…</p>
                    ) : (userSearchQuery.data ?? []).length === 0 ? (
                      <p className="p-3 text-xs text-muted">Sin resultados.</p>
                    ) : (
                      <ul className="divide-y divide-line/60">
                        {(userSearchQuery.data ?? []).map((u: any) => (
                          <li
                            key={u.id}
                            onClick={() => setCreating({
                              ...creating,
                              userId: u.id,
                              userLabel: `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''} (${u.email})`.trim(),
                              userSearch: '',
                            })}
                            className="p-2.5 cursor-pointer hover:bg-elevated/40 text-sm"
                          >
                            <p className="font-semibold">{u.profile?.firstName ?? ''} {u.profile?.lastName ?? ''}</p>
                            <p className="text-[11px] text-muted">{u.email}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <Field label="Asunto" required value={creating.subject} onChange={(v) => setCreating({ ...creating, subject: v })} placeholder="Cobro duplicado" />
            <Field label="Descripción" rows={4} required value={creating.description} onChange={(v) => setCreating({ ...creating, description: v })} placeholder="Lo que el usuario te explicó por teléfono / email…" />
            <label className="block">
              <span className="text-[11px] font-bold text-muted tracking-wider uppercase">Prioridad</span>
              <select
                title="Prioridad"
                value={creating.priority}
                onChange={(e) => setCreating({ ...creating, priority: e.target.value })}
                className="input-field mt-1.5"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <InlineError message={create.error ? apiError(create.error) : null} />

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setCreating(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                type="button"
                onClick={() => create.mutate(creating)}
                disabled={create.isPending || !creating.userId || !creating.subject.trim() || !creating.description.trim()}
                className="btn-primary flex-1"
              >
                {create.isPending ? 'Creando…' : 'Crear ticket'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TicketThread({ ticketId, onChange }: { ticketId: string | null; onChange: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const messages = useQuery({
    enabled: !!ticketId,
    queryKey: ['support', 'messages', ticketId],
    queryFn: async () => (await adminApi.ticketMessages(ticketId!)).data?.data ?? [],
  });

  const send = useMutation({
    mutationFn: (content: string) => adminApi.sendTicketMessage(ticketId!, content),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['support', 'messages', ticketId] });
      onChange();
    },
  });

  const update = useMutation({
    mutationFn: (data: any) => adminApi.updateTicket(ticketId!, data),
    onSuccess: () => onChange(),
  });

  if (!ticketId) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <p className="text-muted text-sm">Selecciona un ticket para ver la conversación.</p>
      </div>
    );
  }

  const list: any[] = messages.data ?? [];

  return (
    <div className="card flex flex-col min-h-0">
      <div className="p-4 border-b border-line flex gap-2">
        <select
          defaultValue=""
          onChange={(e) => e.target.value && update.mutate({ status: e.target.value })}
          className="input-field max-w-[200px] text-xs"
        >
          <option value="">Cambiar status…</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          defaultValue=""
          onChange={(e) => e.target.value && update.mutate({ priority: e.target.value })}
          className="input-field max-w-[180px] text-xs"
        >
          <option value="">Cambiar prioridad…</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.isLoading ? (
          <p className="text-muted text-sm">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="text-muted text-sm">Sin mensajes.</p>
        ) : list.map((m: any) => (
          <div key={m.id} className={`flex ${m.sender === 'USER' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
              m.sender === 'USER' ? 'bg-elevated text-zinc-100' : 'bg-accent/20 text-zinc-100'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className="text-[10px] text-muted mt-1">{new Date(m.createdAt).toLocaleString('es')}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-line flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe una respuesta…"
          rows={2}
          className="input-field flex-1"
        />
        <button
          onClick={() => text.trim() && send.mutate(text.trim())}
          disabled={send.isPending || !text.trim()}
          className="btn-primary"
        >
          <Send size={14} />
        </button>
      </div>
      {send.error && <p className="text-danger text-xs px-4 pb-2">{apiError(send.error)}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-success/15 text-success',
    IN_PROGRESS: 'bg-blue-500/15 text-blue-400',
    WAITING_USER: 'bg-amber-500/15 text-amber-400',
    RESOLVED: 'bg-muted/15 text-muted',
    CLOSED: 'bg-muted/15 text-muted',
  };
  return <span className={`pill ${map[status] ?? 'bg-muted/15 text-muted'}`}>{status ?? '—'}</span>;
}

function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    LOW: 'bg-muted/15 text-muted',
    MEDIUM: 'bg-blue-500/15 text-blue-400',
    HIGH: 'bg-amber-500/15 text-amber-400',
    URGENT: 'bg-danger/15 text-danger',
  };
  return <span className={`pill ${map[priority] ?? 'bg-muted/15 text-muted'}`}>{priority ?? '—'}</span>;
}
