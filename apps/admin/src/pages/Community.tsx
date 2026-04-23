import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { adminApi } from '@/api/client';

export function Community() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'community' | 'wall'>('all');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'posts', 'pending', page],
    queryFn: async () => {
      const r = await adminApi.posts({ page, limit: 20 });
      return r.data?.data ?? r.data;
    },
  });

  const approve = useMutation({
    mutationFn: (postId: string) => adminApi.approvePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  const reject = useMutation({
    mutationFn: async (payload: { postId: string; reason: string }) =>
      adminApi.rejectPost(payload.postId, payload.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  const posts = data?.data || [];
  const pagination = data || {};

  // Filter posts based on surface (community vs wall)
  const filteredPosts = posts.filter((post: any) => {
    if (filter === 'all') return true;
    return post.surface === filter;
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Moderar Posts</h1>
        <p className="text-muted text-sm mt-1">Aprueba o rechaza publicaciones pendientes de revisión</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setFilter('all');
            setPage(1);
          }}
          className={`px-4 py-2 rounded transition ${
            filter === 'all'
              ? 'bg-accent text-white'
              : 'bg-surface text-muted hover:bg-surface-hover'
          }`}
        >
          Todos ({posts.length})
        </button>
        <button
          onClick={() => {
            setFilter('community');
            setPage(1);
          }}
          className={`px-4 py-2 rounded transition ${
            filter === 'community'
              ? 'bg-accent text-white'
              : 'bg-surface text-muted hover:bg-surface-hover'
          }`}
        >
          Comunidad ({posts.filter((p: any) => p.surface === 'community').length})
        </button>
        <button
          onClick={() => {
            setFilter('wall');
            setPage(1);
          }}
          className={`px-4 py-2 rounded transition ${
            filter === 'wall'
              ? 'bg-accent text-white'
              : 'bg-surface text-muted hover:bg-surface-hover'
          }`}
        >
          Muro ({posts.filter((p: any) => p.surface === 'wall').length})
        </button>
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted">Cargando posts...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare size={48} className="mx-auto text-muted mb-3" />
          <p className="text-muted text-sm">No hay posts pendientes en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post: any) => (
            <PostCard
              key={post.id}
              post={post}
              onApprove={(id) => approve.mutate(id)}
              onReject={(id, reason) => reject.mutate({ postId: id, reason })}
              isApproving={approve.isPending}
              isRejecting={reject.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${
                page === p
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:bg-surface-hover'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PostCardProps {
  post: any;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function PostCard({
  post,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: PostCardProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = () => {
    if (rejectReason.trim()) {
      onReject(post.id, rejectReason);
      setShowRejectForm(false);
      setRejectReason('');
    }
  };

  const author = post.user;
  const isCommunity = post.surface === 'community';
  const isWall = post.surface === 'wall';

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {author?.profile?.avatarUrl && (
              <img
                src={author.profile.avatarUrl}
                alt={author.profile?.firstName}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <p className="font-semibold">
                {author?.profile?.firstName} {author?.profile?.lastName}
              </p>
              <p className="text-xs text-muted">{author?.email}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center mt-2">
            {isCommunity && (
              <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">
                Comunidad
              </span>
            )}
            {isWall && (
              <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded">
                Muro
              </span>
            )}
            <span className="text-xs text-muted">
              {new Date(post.createdAt).toLocaleString('es-ES')}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface-hover p-4 rounded border border-border">
        <p className="text-sm leading-relaxed">{post.content}</p>
        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt="Post"
            className="mt-3 rounded max-h-64 object-cover"
          />
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted">
        <span>{post._count?.reactions ?? 0} reacciones</span>
        <span>{post._count?.comments ?? 0} comentarios</span>
      </div>

      {/* Actions */}
      {!showRejectForm ? (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(post.id)}
            disabled={isApproving || isRejecting}
            className="flex-1 btn-success flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle size={16} />
            Aprobar
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isApproving || isRejecting}
            className="flex-1 btn-danger flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <XCircle size={16} />
            Rechazar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo del rechazo (opcional)"
            className="w-full p-2 rounded bg-surface border border-border text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isRejecting || !rejectReason.trim()}
              className="flex-1 btn-danger disabled:opacity-50"
            >
              Confirmar rechazo
            </button>
            <button
              onClick={() => {
                setShowRejectForm(false);
                setRejectReason('');
              }}
              disabled={isRejecting}
              className="flex-1 btn-ghost"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
