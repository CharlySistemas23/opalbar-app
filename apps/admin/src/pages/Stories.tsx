import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Film, Trash2, Eye, Upload, Plus } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, StatCard, ConfirmDialog,
  Modal, Field,
} from '@/components/ui';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function unwrap<T = any>(p: any): T {
  return (p?.data?.data ?? p?.data ?? p) as T;
}

function userLabel(u: any) {
  if (!u) return 'OPAL BAR';
  const fn = u?.profile?.firstName?.trim();
  const ln = u?.profile?.lastName?.trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
  return u?.email ?? 'Usuario';
}

export function Stories() {
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [draft, setDraft] = useState<{ caption: string; mediaUrl: string }>({ caption: '', mediaUrl: '' });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const storiesQuery = useQuery({
    queryKey: ['admin', 'stories'],
    queryFn: async () => unwrap<any>(await adminApi.listStories()),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteStory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'stories'] }),
  });

  const create = useMutation({
    mutationFn: (data: { mediaUrl: string; caption?: string }) => adminApi.createVenueStory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'stories'] });
      setUploadOpen(false);
      setDraft({ caption: '', mediaUrl: '' });
    },
  });

  async function pickFile(file: File) {
    setUploading(true); setUploadError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = unwrap<any>(await adminApi.marketingUploadAsset(dataUrl));
      setDraft((d) => ({ ...d, mediaUrl: r.url }));
    } catch (e: any) {
      setUploadError(apiError(e));
    } finally { setUploading(false); }
  }

  const data = storiesQuery.data ?? {};
  const venue: any[] = data.venue?.stories ?? data.venue ?? [];
  const personal: any[] = data.personal ?? [];
  const allUserStories = personal.flatMap((g: any) => (g.stories ?? []).map((s: any) => ({ ...s, _user: g.user })));

  return (
    <div className="page-shell page-shell--scroll">
      <PageHeader
        icon={Film}
        title="Historias"
        subtitle="Moderación de stories del bar y de usuarios (24h)"
        actions={
          <button type="button" onClick={() => setUploadOpen(true)} className="btn-primary">
            <Plus size={14} /> Nueva historia OPAL BAR
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Film} label="OPAL BAR" value={venue.length} tone="accent" hint="Historias del bar activas" />
        <StatCard icon={Film} label="Usuarios" value={allUserStories.length} tone="info" hint="Historias de usuarios activas" />
      </div>

      <InlineError message={del.error ? apiError(del.error) : null} />

      {storiesQuery.isLoading ? (
        <SkeletonRows rows={4} height={160} />
      ) : (
        <>
          {venue.length > 0 && (
            <section className="space-y-3">
              <h2 className="section-title">OPAL BAR · {venue.length}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {venue.map((s: any) => (
                  <StoryTile key={s.id} story={s} userLabel="OPAL BAR" onDelete={() => setConfirmDel(s.id)} />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="section-title">Usuarios · {allUserStories.length}</h2>
            {allUserStories.length === 0 ? (
              <div className="card">
                <EmptyState icon={Film} title="Sin historias de usuarios" message="Las stories duran 24 horas; si no hay activas, esto queda vacío." />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {allUserStories.map((s: any) => (
                  <StoryTile
                    key={s.id}
                    story={s}
                    userLabel={userLabel(s._user)}
                    onDelete={() => setConfirmDel(s.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar historia?"
        message="La historia se quitará inmediatamente. El autor recibirá una notificación de moderación."
        destructive
        confirmLabel="Eliminar"
        onConfirm={() => confirmDel && del.mutate(confirmDel)}
      />

      {/* Modal: subir nueva historia OPAL BAR */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Nueva historia OPAL BAR">
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Las historias OPAL BAR aparecen en la sección destacada del feed durante 24 horas.
          </p>

          {/* Media picker / preview */}
          {draft.mediaUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-line group">
              {/\.(mp4|mov|webm)$/i.test(draft.mediaUrl) ? (
                <video src={draft.mediaUrl} controls className="w-full max-h-[320px] object-contain bg-black" />
              ) : (
                <img src={draft.mediaUrl} alt="" className="w-full max-h-[320px] object-contain bg-black" />
              )}
              <button
                type="button"
                onClick={() => setDraft({ ...draft, mediaUrl: '' })}
                className="absolute top-2 right-2 p-2 rounded-lg bg-black/70 text-danger opacity-0 group-hover:opacity-100 transition"
                title="Cambiar"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="btn-ghost w-full justify-center py-8 border-dashed"
            >
              <Upload size={16} />
              {uploading ? 'Subiendo…' : 'Subir foto o video'}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            aria-label="Media"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
          />

          <Field
            label="Descripción (opcional)"
            value={draft.caption}
            onChange={(v) => setDraft({ ...draft, caption: v })}
            placeholder="Texto que se muestra en la historia"
          />

          <InlineError message={uploadError ?? (create.error ? apiError(create.error) : null)} />

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setUploadOpen(false)} className="btn-ghost flex-1">Cancelar</button>
            <button
              type="button"
              onClick={() => create.mutate({ mediaUrl: draft.mediaUrl, caption: draft.caption || undefined })}
              disabled={create.isPending || !draft.mediaUrl}
              className="btn-primary flex-1"
            >
              {create.isPending ? 'Publicando…' : 'Publicar historia'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StoryTile({ story, userLabel, onDelete }: { story: any; userLabel: string; onDelete: () => void }) {
  const isVideo = story.mediaUrl && /\.(mp4|mov|webm)$/i.test(story.mediaUrl);
  return (
    <article className="card card-hover overflow-hidden group relative">
      <div className="relative aspect-[9/16] bg-elevated overflow-hidden">
        {isVideo ? (
          <video src={story.mediaUrl} className="w-full h-full object-cover" controls preload="metadata" />
        ) : (
          <img src={story.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
          <p className="text-xs font-semibold truncate text-white drop-shadow">{userLabel}</p>
          <p className="text-[10px] text-white/70 mt-0.5">
            {new Date(story.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          title="Eliminar historia"
          className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 backdrop-blur text-danger opacity-0 group-hover:opacity-100 transition hover:bg-danger/30"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-3 space-y-1">
        {story.caption && <p className="text-xs text-zinc-300 line-clamp-2">{story.caption}</p>}
        <div className="flex items-center justify-between text-[10px] text-muted">
          {typeof story.viewsCount === 'number' && (
            <span className="inline-flex items-center gap-1"><Eye size={10} /> {story.viewsCount}</span>
          )}
        </div>
      </div>
    </article>
  );
}
