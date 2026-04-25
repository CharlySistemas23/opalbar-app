import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessagesSquare, Search, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { messagesApi, apiError } from '@/api/client';

type ThreadUser = {
  id: string;
  email: string;
  status?: string;
  role?: string;
  profile?: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null;
};

type ThreadRow = {
  id: string;
  lastMessageAt: string;
  userA: ThreadUser;
  userB: ThreadUser;
  lastMessage: { id: string; content: string; createdAt: string; senderId: string; deletedAt: string | null } | null;
  messageCount: number;
};

type Message = {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  deletedAt: string | null;
};

function userLabel(u: ThreadUser) {
  const fn = u.profile?.firstName?.trim();
  const ln = u.profile?.lastName?.trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
  return u.email;
}

function userInitial(u: ThreadUser) {
  return (u.profile?.firstName?.[0] ?? u.email?.[0] ?? '?').toUpperCase();
}

function unwrap<T>(payload: any): T {
  if (payload?.data?.data !== undefined) return payload.data.data as T;
  return (payload?.data ?? payload) as T;
}

export function Messages() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();

  // simple debounce on the search box
  useMemo(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const threadsQuery = useQuery({
    queryKey: ['admin', 'messages', 'threads', debounced],
    queryFn: async () => unwrap<ThreadRow[]>(await messagesApi.listThreads(debounced || undefined, 100)),
  });

  const threads: ThreadRow[] = threadsQuery.data ?? [];

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="text-accent" size={22} /> Mensajes privados
          </h1>
          <p className="text-muted text-sm mt-1">
            Supervisión de DMs entre usuarios · {threads.length} conversaciones
          </p>
        </div>
        <div className="relative max-w-[320px] w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="input-field pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-[380px,1fr] gap-4 flex-1 min-h-0">
        <div className="card overflow-auto">
          {threadsQuery.isLoading ? (
            <p className="text-muted text-sm p-4">Cargando…</p>
          ) : threadsQuery.error ? (
            <div className="p-6 text-danger text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {apiError(threadsQuery.error)}
            </div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center">
              <MessagesSquare size={36} className="mx-auto text-muted mb-2" />
              <p className="text-muted text-sm">Sin conversaciones.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {threads.map((t) => (
                <li
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`p-4 cursor-pointer ${selected === t.id ? 'bg-accent/10' : 'hover:bg-elevated/50'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar user={t.userA} />
                    <span className="text-muted text-xs">↔</span>
                    <Avatar user={t.userB} />
                  </div>
                  <p className="font-semibold text-sm truncate">
                    {userLabel(t.userA)} <span className="text-muted">·</span> {userLabel(t.userB)}
                  </p>
                  {t.lastMessage ? (
                    <p className={`text-xs truncate mt-0.5 ${t.lastMessage.deletedAt ? 'text-danger/70 italic' : 'text-muted'}`}>
                      {t.lastMessage.deletedAt ? '[mensaje eliminado]' : t.lastMessage.content}
                    </p>
                  ) : (
                    <p className="text-xs text-muted italic mt-0.5">Sin mensajes</p>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-muted">{t.messageCount} mensajes</span>
                    <span className="text-[10px] text-muted">
                      {new Date(t.lastMessageAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ThreadView
          threadId={selected}
          onMessageDeleted={() => qc.invalidateQueries({ queryKey: ['admin', 'messages'] })}
        />
      </div>
    </div>
  );
}

function Avatar({ user }: { user: ThreadUser }) {
  if (user.profile?.avatarUrl) {
    return <img src={user.profile.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />;
  }
  return (
    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
      <span className="text-[10px] font-bold text-accent">{userInitial(user)}</span>
    </div>
  );
}

function ThreadView({ threadId, onMessageDeleted }: { threadId: string | null; onMessageDeleted: () => void }) {
  const qc = useQueryClient();

  const threadQuery = useQuery({
    enabled: !!threadId,
    queryKey: ['admin', 'messages', 'thread', threadId],
    queryFn: async () => unwrap<any>(await messagesApi.getThread(threadId!)),
  });

  const msgsQuery = useQuery({
    enabled: !!threadId,
    queryKey: ['admin', 'messages', 'thread', threadId, 'messages'],
    queryFn: async () => unwrap<Message[]>(await messagesApi.listMessages(threadId!)),
  });

  const del = useMutation({
    mutationFn: (id: string) => messagesApi.deleteMessage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'messages', 'thread', threadId, 'messages'] });
      onMessageDeleted();
    },
  });

  if (!threadId) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-center">
        <MessagesSquare size={40} className="text-muted mb-3" />
        <p className="text-muted text-sm">Selecciona una conversación para revisarla.</p>
        <p className="text-muted text-xs mt-1 max-w-sm">
          Solo lectura. Los usuarios no son notificados de la supervisión.
        </p>
      </div>
    );
  }

  const thread = threadQuery.data;
  const messages: Message[] = msgsQuery.data ?? [];

  return (
    <div className="card flex flex-col min-h-0">
      <div className="p-4 border-b border-line">
        {threadQuery.isLoading || !thread ? (
          <p className="text-muted text-sm">Cargando…</p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserChip user={thread.userA} />
              <span className="text-muted">↔</span>
              <UserChip user={thread.userB} />
            </div>
            <span className="text-xs text-muted">{messages.length} mensajes</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {msgsQuery.isLoading ? (
          <p className="text-muted text-sm">Cargando mensajes…</p>
        ) : messages.length === 0 ? (
          <p className="text-muted text-sm">Sin mensajes en esta conversación.</p>
        ) : messages.map((m) => {
          const isA = thread && m.senderId === thread.userA.id;
          const sender = thread ? (isA ? thread.userA : thread.userB) : null;
          const deleted = !!m.deletedAt;
          return (
            <div key={m.id} className={`flex ${isA ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[78%] group`}>
                <div className="flex items-center gap-2 mb-1 text-[10px] text-muted">
                  {sender && <span className="font-semibold">{userLabel(sender)}</span>}
                  <span>{new Date(m.createdAt).toLocaleString('es')}</span>
                  {deleted && <span className="text-danger">· eliminado</span>}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    deleted
                      ? 'bg-danger/10 text-danger/80 italic border border-danger/30'
                      : isA
                      ? 'bg-elevated text-zinc-100'
                      : 'bg-accent/20 text-zinc-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                {!deleted && (
                  <button
                    onClick={() => {
                      if (confirm('¿Eliminar este mensaje? Se reemplazará el contenido por una marca de moderación.')) {
                        del.mutate(m.id);
                      }
                    }}
                    disabled={del.isPending}
                    className="mt-1 text-[10px] text-muted hover:text-danger flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {del.error && (
          <p className="text-danger text-xs">{apiError(del.error)}</p>
        )}
      </div>
    </div>
  );
}

function UserChip({ user }: { user: ThreadUser }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar user={user} />
      <div className="leading-tight">
        <p className="text-sm font-semibold">{userLabel(user)}</p>
        <p className="text-[10px] text-muted">
          {user.email}
          {user.role && user.role !== 'USER' ? ` · ${user.role}` : ''}
          {user.status && user.status !== 'ACTIVE' ? ` · ${user.status}` : ''}
        </p>
      </div>
    </div>
  );
}
