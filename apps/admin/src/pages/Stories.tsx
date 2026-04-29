import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Film, Trash2, Eye } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';
import {
  PageHeader, EmptyState, SkeletonRows, InlineError, StatCard, ConfirmDialog,
} from '@/components/ui';

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

  const storiesQuery = useQuery({
    queryKey: ['admin', 'stories'],
    queryFn: async () => unwrap<any>(await adminApi.listStories()),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteStory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'stories'] }),
  });

  const data = storiesQuery.data ?? {};
  const venue: any[] = data.venue?.stories ?? data.venue ?? [];
  const personal: any[] = data.personal ?? [];
  const allUserStories = personal.flatMap((g: any) => (g.stories ?? []).map((s: any) => ({ ...s, _user: g.user })));

  return (
    <div className="page-shell page-shell--scroll">
      <PageHeader icon={Film} title="Historias" subtitle="Moderación de stories del bar y de usuarios (24h)" />

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
