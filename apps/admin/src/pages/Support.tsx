import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, Send } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

const STATUSES = ['', 'OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function Support() {
  const [status, setStatus] = useState('OPEN');
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tickets', status],
    queryFn: async () => (await adminApi.tickets({ status: status || undefined, limit: 50 })).data?.data ?? [],
  });

  const tickets: any[] = data?.data ?? data ?? [];

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Soporte</h1>
          <p className="text-muted text-sm mt-1">{tickets.length} tickets</p>
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setSelected(null); }} className="input-field max-w-[200px]">
          <option value="">Todos</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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
