import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell, Send } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

export function PushBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'ADMINS'>('ALL');
  const [result, setResult] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => adminApi.broadcast(title, body, audience),
    onSuccess: (r) => {
      const data = r.data?.data ?? r.data ?? {};
      setResult(`Enviado a ${data.sent ?? 0} usuarios (${data.failed ?? 0} fallaron).`);
      setTitle('');
      setBody('');
    },
    onError: (err) => setResult(apiError(err)),
  });

  const canSend = title.trim().length >= 3 && body.trim().length >= 3 && !send.isPending;

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Notificaciones push</h1>
        <p className="text-muted text-sm mt-1">Envía un mensaje a toda la audiencia o solo al staff.</p>
      </div>

      <div className="card p-6 space-y-5">
        <label className="block">
          <span className="text-xs font-bold text-muted uppercase">Audiencia</span>
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={() => setAudience('ALL')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                audience === 'ALL' ? 'bg-accent text-black' : 'bg-elevated text-zinc-300'
              }`}
            >
              Todos los usuarios
            </button>
            <button
              onClick={() => setAudience('ADMINS')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                audience === 'ADMINS' ? 'bg-accent text-black' : 'bg-elevated text-zinc-300'
              }`}
            >
              Solo staff
            </button>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-muted uppercase">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="¡Noticia importante!"
            className="input-field mt-1.5"
          />
          <span className="text-[10px] text-muted">{title.length}/60</span>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-muted uppercase">Mensaje</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={180}
            rows={4}
            placeholder="Descripción del mensaje…"
            className="input-field mt-1.5"
          />
          <span className="text-[10px] text-muted">{body.length}/180</span>
        </label>

        <div className="border border-line rounded-xl p-4 bg-elevated">
          <p className="text-[10px] text-muted uppercase tracking-wide mb-2">Preview</p>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
              <Bell size={16} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{title || 'Título del mensaje'}</p>
              <p className="text-xs text-muted break-words">{body || 'Descripción aquí…'}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => send.mutate()}
            disabled={!canSend}
            className="btn-primary"
          >
            <Send size={16} /> {send.isPending ? 'Enviando…' : 'Enviar ahora'}
          </button>
        </div>

        {result && (
          <div className={`p-3 rounded-xl text-sm ${
            send.isError ? 'bg-danger/10 text-danger border border-danger/30' : 'bg-success/10 text-success border border-success/30'
          }`}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
