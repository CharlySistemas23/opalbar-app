// ─────────────────────────────────────────────
//  Tiempo relativo: "ahora" / "5m" / "2h" / "3d".
//  Clampea diferencias negativas a 0 para evitar el bug "-3594s" cuando
//  el reloj del dispositivo está ligeramente atrasado vs el server (DST,
//  sync NTP pendiente, etc).
// ─────────────────────────────────────────────
export function relativeTime(input: Date | string | number, isSpanish = true): string {
  const d = input instanceof Date ? input : new Date(input);
  const ts = d.getTime();
  if (!Number.isFinite(ts)) return '';

  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));

  if (diff < 5) return isSpanish ? 'ahora' : 'now';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 86400)}d`;
  if (diff < 365 * 86400) return `${Math.floor(diff / (30 * 86400))}mo`;
  return `${Math.floor(diff / (365 * 86400))}y`;
}
