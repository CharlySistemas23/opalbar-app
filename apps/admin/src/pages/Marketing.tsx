import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone, Send, Trash2, Plus, Pause, Calendar, Users,
  Image as ImageIcon, Paperclip, X,
} from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, Modal, Field, StatusPill,
  StatCard, ConfirmDialog,
} from '@/components/ui';

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

interface Attachment {
  name: string;
  url: string;
  sizeBytes?: number;
  mimeType?: string;
}

interface CampaignForm {
  template: 'GENERIC' | 'OFFER' | 'EVENT' | 'BIRTHDAY' | 'WELCOME' | 'NEWS';
  subject: string;
  preheader: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  heroImageUrl: string;
  images: string[];
  attachments: Attachment[];
  audienceType: 'ALL' | 'NEW_7D' | 'VIP' | 'BIRTHDAY_MONTH' | 'INACTIVE_30D' | 'CUSTOM';
  scheduledAt: string;
}

const empty: CampaignForm = {
  template: 'GENERIC', subject: '', preheader: '', headline: '', body: '',
  ctaLabel: '', ctaUrl: '', heroImageUrl: '', images: [], attachments: [],
  audienceType: 'ALL', scheduledAt: '',
};

const TEMPLATES = [
  { value: 'GENERIC', label: 'Genérica' },
  { value: 'OFFER', label: 'Oferta' },
  { value: 'EVENT', label: 'Evento' },
  { value: 'BIRTHDAY', label: 'Cumpleaños' },
  { value: 'WELCOME', label: 'Bienvenida' },
  { value: 'NEWS', label: 'Noticias' },
] as const;

const AUDIENCES = [
  { value: 'ALL', label: 'Todos los suscriptos' },
  { value: 'NEW_7D', label: 'Nuevos (últimos 7 días)' },
  { value: 'VIP', label: 'VIP / Loyalty' },
  { value: 'BIRTHDAY_MONTH', label: 'Cumpleaños del mes' },
  { value: 'INACTIVE_30D', label: 'Inactivos (>30 días)' },
] as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function Marketing() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<CampaignForm | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'send' | 'delete' | 'cancel'; id: string; title: string } | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ['admin', 'marketing', 'campaigns'],
    queryFn: async () => unwrap<any[]>(await adminApi.marketingListCampaigns()),
  });

  const create = useMutation({
    mutationFn: (form: CampaignForm) => {
      const payload: any = {
        template: form.template,
        subject: form.subject,
        headline: form.headline,
        body: form.body,
        audienceType: form.audienceType,
      };
      if (form.preheader.trim()) payload.preheader = form.preheader.trim();
      if (form.ctaLabel.trim()) payload.ctaLabel = form.ctaLabel.trim();
      if (form.ctaUrl.trim()) payload.ctaUrl = form.ctaUrl.trim();
      if (form.heroImageUrl.trim()) payload.heroImageUrl = form.heroImageUrl.trim();
      if (form.images.length) payload.images = form.images;
      if (form.attachments.length) payload.attachments = form.attachments;
      if (form.scheduledAt) payload.scheduledAt = new Date(form.scheduledAt).toISOString();
      return adminApi.marketingCreateCampaign(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'marketing'] }); setEditor(null); },
  });
  const sendNow = useMutation({
    mutationFn: (id: string) => adminApi.marketingSendNow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'marketing'] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => adminApi.marketingCancelCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'marketing'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.marketingDeleteCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'marketing'] }),
  });

  const list: any[] = Array.isArray(campaignsQuery.data) ? campaignsQuery.data : [];
  const sentCount = list.filter((c) => c.status === 'SENT').length;
  const pendingCount = list.filter((c) => c.status === 'DRAFT' || c.status === 'SCHEDULED').length;

  return (
    <div className="page-shell">
      <PageHeader
        icon={Megaphone}
        title="Marketing"
        subtitle="Campañas push masivas con imágenes y adjuntos"
        actions={
          <button type="button" onClick={() => setEditor(empty)} className="btn-primary">
            <Plus size={14} /> Nueva campaña
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Megaphone} label="Total campañas" value={list.length} tone="accent" />
        <StatCard icon={Send} label="Enviadas" value={sentCount} tone="success" />
        <StatCard icon={Calendar} label="En cola" value={pendingCount} tone="info" />
      </div>

      <InlineError message={create.error ? apiError(create.error) : sendNow.error ? apiError(sendNow.error) : del.error ? apiError(del.error) : cancel.error ? apiError(cancel.error) : null} />

      <div className="card flex-1 overflow-auto">
        {campaignsQuery.isLoading ? (
          <SkeletonRows rows={6} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Sin campañas"
            message="Creá tu primera campaña con foto, galería y archivos adjuntos."
            action={
              <button type="button" onClick={() => setEditor(empty)} className="btn-primary">
                <Plus size={14} /> Crear campaña
              </button>
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Asunto</th>
                <th>Audiencia</th>
                <th>Estado</th>
                <th>Programada</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <p className="font-bold">{c.subject ?? c.title}</p>
                    <p className="text-[11px] text-muted truncate max-w-[340px]">
                      {c.headline} · {c.template ?? 'GENERIC'}
                    </p>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <Users size={12} className="text-muted" /> {c.audienceType ?? '—'}
                    </span>
                  </td>
                  <td><StatusPill status={c.status ?? 'DRAFT'} /></td>
                  <td className="text-xs text-muted">
                    {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString('es') : '—'}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {c.status !== 'SENT' && c.status !== 'SENDING' && c.status !== 'CANCELLED' && (
                      <>
                        <button type="button" title="Enviar ahora"
                          onClick={() => setConfirmAction({ kind: 'send', id: c.id, title: c.subject ?? c.title })}
                          className="p-1.5 rounded-lg hover:bg-success/15 text-muted hover:text-success transition">
                          <Send size={14} />
                        </button>
                        <button type="button" title="Cancelar"
                          onClick={() => setConfirmAction({ kind: 'cancel', id: c.id, title: c.subject ?? c.title })}
                          className="p-1.5 rounded-lg hover:bg-elevated text-muted transition">
                          <Pause size={14} />
                        </button>
                      </>
                    )}
                    <button type="button" title="Eliminar"
                      onClick={() => setConfirmAction({ kind: 'delete', id: c.id, title: c.subject ?? c.title })}
                      className="p-1.5 rounded-lg hover:bg-danger/15 text-muted hover:text-danger transition">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title="Nueva campaña" size="lg">
        {editor && (
          <CampaignEditor
            form={editor}
            onChange={setEditor}
            onCancel={() => setEditor(null)}
            onSubmit={() => create.mutate(editor)}
            submitting={create.isPending}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.kind === 'send' ? `Enviar "${confirmAction?.title}" ahora?`
          : confirmAction?.kind === 'cancel' ? `Cancelar "${confirmAction?.title}"?`
          : `Eliminar "${confirmAction?.title}"?`
        }
        message={
          confirmAction?.kind === 'send' ? 'Se enviará la notificación + email a la audiencia configurada inmediatamente.'
          : confirmAction?.kind === 'cancel' ? 'La campaña no se enviará.'
          : 'Se borrará permanentemente.'
        }
        destructive={confirmAction?.kind !== 'send'}
        confirmLabel={
          confirmAction?.kind === 'send' ? 'Enviar ahora'
          : confirmAction?.kind === 'cancel' ? 'Cancelar campaña'
          : 'Eliminar'
        }
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.kind === 'send') sendNow.mutate(confirmAction.id);
          else if (confirmAction.kind === 'cancel') cancel.mutate(confirmAction.id);
          else del.mutate(confirmAction.id);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
//  Editor modal con uploads
// ─────────────────────────────────────────────
function CampaignEditor({
  form, onChange, onCancel, onSubmit, submitting,
}: {
  form: CampaignForm;
  onChange: (f: CampaignForm) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const heroInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleHeroUpload(file: File) {
    setUploading('hero'); setUploadError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = unwrap<any>(await adminApi.marketingUploadAsset(dataUrl));
      onChange({ ...form, heroImageUrl: r.url });
    } catch (e: any) {
      setUploadError(apiError(e));
    } finally { setUploading(null); }
  }

  async function handleGalleryUpload(files: FileList) {
    setUploading('gallery'); setUploadError(null);
    try {
      const remaining = 8 - form.images.length;
      const batch = Array.from(files).slice(0, remaining);
      const newUrls: string[] = [];
      for (const f of batch) {
        const dataUrl = await fileToDataUrl(f);
        const r = unwrap<any>(await adminApi.marketingUploadAsset(dataUrl));
        newUrls.push(r.url);
      }
      onChange({ ...form, images: [...form.images, ...newUrls] });
    } catch (e: any) {
      setUploadError(apiError(e));
    } finally { setUploading(null); }
  }

  async function handleAttachmentUpload(files: FileList) {
    setUploading('files'); setUploadError(null);
    try {
      const remaining = 5 - form.attachments.length;
      const batch = Array.from(files).slice(0, remaining);
      const newAttachments: Attachment[] = [];
      for (const f of batch) {
        const dataUrl = await fileToDataUrl(f);
        const r = unwrap<any>(await adminApi.marketingUploadAsset(dataUrl));
        newAttachments.push({
          name: f.name,
          url: r.url,
          sizeBytes: r.sizeBytes ?? f.size,
          mimeType: r.mimeType ?? f.type,
        });
      }
      onChange({ ...form, attachments: [...form.attachments, ...newAttachments] });
    } catch (e: any) {
      setUploadError(apiError(e));
    } finally { setUploading(null); }
  }

  const canSubmit =
    form.subject.trim().length >= 3 &&
    form.headline.trim().length >= 3 &&
    form.body.trim().length >= 10 &&
    !submitting;

  return (
    <div className="space-y-5">
      {/* Plantilla + audiencia */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] font-bold text-muted tracking-wider uppercase">Plantilla</span>
          <select
            title="Plantilla"
            value={form.template}
            onChange={(e) => onChange({ ...form, template: e.target.value as any })}
            className="input-field mt-1.5"
          >
            {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-muted tracking-wider uppercase">Audiencia</span>
          <select
            title="Audiencia"
            value={form.audienceType}
            onChange={(e) => onChange({ ...form, audienceType: e.target.value as any })}
            className="input-field mt-1.5"
          >
            {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
      </div>

      {/* Asunto + preheader */}
      <Field label="Asunto" required value={form.subject} onChange={(v) => onChange({ ...form, subject: v })} placeholder="Ej: Esta noche, jazz en vivo + 2x1" />
      <Field label="Preheader (opcional)" value={form.preheader} onChange={(v) => onChange({ ...form, preheader: v })} placeholder="Aparece en gris junto al asunto en la bandeja" />

      {/* Headline + body */}
      <Field label="Titular" required value={form.headline} onChange={(v) => onChange({ ...form, headline: v })} />
      <Field label="Mensaje" required rows={5} value={form.body} onChange={(v) => onChange({ ...form, body: v })} placeholder="El cuerpo del email — soporta saltos de línea y básicos de markdown." />

      {/* Hero image */}
      <div>
        <p className="text-[11px] font-bold text-muted tracking-wider uppercase mb-2 flex items-center gap-2">
          <ImageIcon size={12} /> Foto principal
        </p>
        {form.heroImageUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-line group">
            <img src={form.heroImageUrl} alt="Hero" className="w-full h-48 object-cover" />
            <button
              type="button"
              onClick={() => onChange({ ...form, heroImageUrl: '' })}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-danger opacity-0 group-hover:opacity-100 transition"
              title="Quitar"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => heroInput.current?.click()}
            className="btn-ghost w-full justify-center"
            disabled={uploading === 'hero'}
          >
            <ImageIcon size={14} />
            {uploading === 'hero' ? 'Subiendo…' : 'Subir foto principal'}
          </button>
        )}
        <input
          ref={heroInput}
          type="file"
          accept="image/*"
          aria-label="Foto principal"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleHeroUpload(e.target.files[0])}
        />
      </div>

      {/* Gallery */}
      <div>
        <p className="text-[11px] font-bold text-muted tracking-wider uppercase mb-2 flex items-center gap-2">
          <ImageIcon size={12} /> Galería ({form.images.length}/8)
        </p>
        {form.images.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            {form.images.map((url, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border border-line group aspect-square">
                <img src={url} alt={`Galería ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => onChange({ ...form, images: form.images.filter((_, j) => j !== i) })}
                  className="absolute top-1 right-1 p-1 rounded bg-black/70 text-danger opacity-0 group-hover:opacity-100 transition"
                  title="Quitar"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {form.images.length < 8 && (
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="btn-ghost w-full justify-center text-xs"
            disabled={uploading === 'gallery'}
          >
            <Plus size={12} />
            {uploading === 'gallery' ? 'Subiendo…' : 'Agregar imágenes'}
          </button>
        )}
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          aria-label="Galería"
          className="hidden"
          onChange={(e) => e.target.files && handleGalleryUpload(e.target.files)}
        />
      </div>

      {/* Attachments */}
      <div>
        <p className="text-[11px] font-bold text-muted tracking-wider uppercase mb-2 flex items-center gap-2">
          <Paperclip size={12} /> Archivos adjuntos ({form.attachments.length}/5)
        </p>
        {form.attachments.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {form.attachments.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-elevated/60 border border-line">
                <Paperclip size={14} className="text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                  <p className="text-[10px] text-muted">
                    {a.mimeType ?? 'archivo'}{a.sizeBytes ? ` · ${(a.sizeBytes / 1024).toFixed(0)} KB` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ ...form, attachments: form.attachments.filter((_, j) => j !== i) })}
                  className="p-1 rounded hover:bg-danger/15 text-muted hover:text-danger"
                  title="Quitar"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {form.attachments.length < 5 && (
          <button
            type="button"
            onClick={() => filesInput.current?.click()}
            className="btn-ghost w-full justify-center text-xs"
            disabled={uploading === 'files'}
          >
            <Plus size={12} />
            {uploading === 'files' ? 'Subiendo…' : 'Adjuntar archivo (PDF, doc, xlsx…)'}
          </button>
        )}
        <input
          ref={filesInput}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/zip"
          multiple
          aria-label="Adjuntos"
          className="hidden"
          onChange={(e) => e.target.files && handleAttachmentUpload(e.target.files)}
        />
        <p className="text-[10px] text-muted mt-1">Hasta 8 MB por archivo · 5 archivos máximo. Se anexan al email.</p>
      </div>

      {/* CTA */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Texto del botón" value={form.ctaLabel} onChange={(v) => onChange({ ...form, ctaLabel: v })} placeholder="Reservar mesa" />
        <Field label="URL del botón" value={form.ctaUrl} onChange={(v) => onChange({ ...form, ctaUrl: v })} placeholder="https://…" />
      </div>

      {/* Schedule */}
      <Field
        label="Programar (opcional)"
        type="datetime-local"
        value={form.scheduledAt}
        onChange={(v) => onChange({ ...form, scheduledAt: v })}
        hint="Si lo dejás vacío, queda como borrador y la enviás manualmente."
      />

      <InlineError message={uploadError} />

      <div className="flex gap-2 pt-2 border-t border-line/60">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">Cancelar</button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="btn-primary flex-1"
        >
          {submitting ? 'Creando…' : 'Crear campaña'}
        </button>
      </div>
    </div>
  );
}
