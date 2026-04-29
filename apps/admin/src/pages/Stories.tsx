import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Film, Trash2 } from 'lucide-react';
import { adminApi, apiError } from '@/api/client';

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
    <div className="p-8 space-y-6 h-full flex flex-col overflow-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Film className="text-accent" size={22} /> Historias
        </h1>
        <p className="text-muted text-sm mt-1">
          {venue.length} stories del bar · {allUserStories.length} stories de usuarios activas
        </p>
      </div>

      {del.error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {apiError(del.error)}
        </div>
      )}

      {/* Venue stories */}
      {venue.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted uppercase">OPAL BAR</h2>
          <div className="grid grid-cols-4 gap-3">
            {venue.map((s: any) => (
              <StoryTile key={s.id} story={s} userLabel="OPAL BAR" onDelete={() => {
                if (confirm('Eliminar esta historia?')) del.mutate(s.id);
              }} />
            ))}
          </div>
        </section>
      )}

      {/* User stories */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted uppercase">Usuarios</h2>
        {storiesQuery.isLoading ? (
          <p className="text-muted text-sm">Cargando…</p>
        ) : allUserStories.length === 0 ? (
          <p className="text-muted text-sm">Sin historias de usuarios activas.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {allUserStories.map((s: any) => (
              <StoryTile
                key={s.id}
                story={s}
                userLabel={userLabel(s._user)}
                onDelete={() => {
                  if (confirm('Eliminar esta historia? El usuario será notificado por moderación.')) del.mutate(s.id);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StoryTile({ story, userLabel, onDelete }: { story: any; userLabel: string; onDelete: () => void }) {
  const isVideo = story.mediaUrl && /\.(mp4|mov|webm)$/i.test(story.mediaUrl);
  return (
    <div className="card overflow-hidden group relative">
      {isVideo ? (
        <video src={story.mediaUrl} className="w-full aspect-[9/16] object-cover" controls preload="metadata" />
      ) : (
        <img src={story.mediaUrl} alt="" className="w-full aspect-[9/16] object-cover" loading="lazy" />
      )}
      <div className="p-3 space-y-1">
        <p className="text-xs font-semibold truncate">{userLabel}</p>
        <p className="text-[10px] text-muted">
          {new Date(story.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
        {story.caption && <p className="text-[10px] text-zinc-300 line-clamp-2">{story.caption}</p>}
        {typeof story.viewsCount === 'number' && (
          <p className="text-[10px] text-muted">{story.viewsCount} vistas</p>
        )}
      </div>
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-danger opacity-0 group-hover:opacity-100 transition hover:bg-danger/30"
        title="Eliminar historia"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
