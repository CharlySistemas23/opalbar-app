// ─────────────────────────────────────────────
//  Message preview helpers — shared by the inbox list, the requests list and
//  the in-app banner so a voice note / photo / sticker / deleted message
//  reads the same everywhere.
// ─────────────────────────────────────────────

export interface PreviewableMessage {
  content?: string | null;
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  imageUrl?: string | null;
  stickerKey?: string | null;
  deletedAt?: string | Date | null;
  senderId?: string | null;
}

function fmtDuration(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Human preview for a message row. `es` picks the language. Returns '' for
 * a missing message so callers can substitute their own "start chatting".
 */
export function messagePreview(msg: PreviewableMessage | null | undefined, es: boolean): string {
  if (!msg) return '';
  if (msg.deletedAt) return es ? 'Mensaje eliminado' : 'Message deleted';
  if (msg.audioUrl) {
    const d = typeof msg.audioDurationSec === 'number' && msg.audioDurationSec > 0
      ? ` · ${fmtDuration(msg.audioDurationSec)}`
      : '';
    return `🎤 ${es ? 'Nota de voz' : 'Voice note'}${d}`;
  }
  if (msg.imageUrl) return `📷 ${es ? 'Foto' : 'Photo'}`;
  if (msg.stickerKey) return `${msg.stickerKey} ${es ? 'Sticker' : 'Sticker'}`;
  return (msg.content ?? '').replace(/\s+/g, ' ').trim();
}

/** Same as messagePreview but prefixed with "Tú:" / "You:" for own messages. */
export function threadPreview(
  msg: PreviewableMessage | null | undefined,
  meId: string | undefined,
  es: boolean,
): string {
  const body = messagePreview(msg, es);
  if (!body) return '';
  const mine = !!meId && msg?.senderId === meId;
  return mine ? `${es ? 'Tú' : 'You'}: ${body}` : body;
}

/** Compact relative timestamp for list rows ("ahora", "5m", "3h", "2d", "12 mar"). */
export function relTime(d?: string | Date | null, es = true): string {
  if (!d) return '';
  const ms = new Date(d).getTime();
  if (Number.isNaN(ms)) return '';
  const diff = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diff < 60) return es ? 'ahora' : 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(ms).toLocaleDateString(es ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' });
}
