import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell, Send } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import { PageHeader, Field, InlineError, Segmented } from '@/components/ui';

const AUDIENCES = [
  { value: 'ALL', label: 'Todos los usuarios' },
  { value: 'ADMINS', label: 'Solo staff' },
] as const;

export function PushBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'ADMINS'>('ALL');
  const [result, setResult] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => adminApi.broadcast(title, body, audience),
    onSuccess: (r) => {
      const data = (r as any).data?.data ?? (r as any).data ?? {};
      setResult(`Enviado a ${data.sent ?? 0} usuarios${data.failed ? ` (${data.failed} fallaron)` : ''}.`);
      setTitle(''); setBody('');
    },
    onError: (err) => setResult(apiError(err)),
  });

  const canSend = title.trim().length >= 3 && body.trim().length >= 3 && !send.isPending;

  return (
    <div className="page-shell page-shell--scroll">
      <PageHeader
        icon={Bell}
        title="Notificaciones push"
        subtitle="Mensaje inmediato a toda la audiencia o solo al staff. Para campañas programadas usá Marketing."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4">
        <div className="card p-6 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-muted tracking-wider uppercase mb-2">Audiencia</p>
            <Segmented options={AUDIENCES} value={audience} onChange={(v) => setAudience(v as any)} />
          </div>

          <Field
            label="Título"
            value={title}
            onChange={setTitle}
            placeholder="¡Noticia importante!"
            hint={`${title.length}/60`}
          />

          <Field
            label="Mensaje"
            value={body}
            onChange={setBody}
            rows={4}
            placeholder="Descripción del mensaje…"
            hint={`${body.length}/180`}
          />

          <InlineError message={send.isError ? result : null} />

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => send.mutate()} disabled={!canSend} className="btn-primary">
              <Send size={14} /> {send.isPending ? 'Enviando…' : 'Enviar ahora'}
            </button>
          </div>

          {send.isSuccess && result && (
            <div className="p-3 rounded-xl bg-success/10 border border-success/30 text-success text-sm animate-fade-in">
              {result}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="card p-5 space-y-3">
          <p className="text-[11px] font-bold text-muted tracking-wider uppercase">Preview</p>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-line shadow-soft">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 ring-1 ring-accent/30 flex items-center justify-center shrink-0">
                <Bell size={18} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">OPAL BAR</p>
                  <p className="text-[10px] text-muted">ahora</p>
                </div>
                <p className="text-sm font-bold mt-1 break-words">{title || 'Título del mensaje'}</p>
                <p className="text-xs text-zinc-300 break-words mt-0.5">{body || 'Descripción aquí…'}</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted">
            Esto es lo que verán tus usuarios al recibir la notificación.
          </p>
        </div>
      </div>
    </div>
  );
}
