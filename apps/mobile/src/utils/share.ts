// ─────────────────────────────────────────────
//  Share helpers — richer text for react-native Share API.
//
//  The native RN Share API is limited (message + url), so the best we can do
//  without adding expo-sharing is: (a) pack a well-formatted multi-line
//  message with deep link + web URL + hashtags, and (b) on iOS pass the
//  image URL as `url` so Messages/Mail attach it as a preview.
// ─────────────────────────────────────────────
import { Platform, Share, type ShareContent } from 'react-native';

const APP_BRAND = 'OPAL BAR';
const APP_WEB = 'https://opalbar.app';
const APP_DEEP_SCHEME = 'opalbar://';

function appendDownloadFooter(lines: string[]) {
  lines.push('');
  lines.push(`✨ ${APP_BRAND} · ${APP_WEB}`);
}

function pushIfContent(lines: string[], value: string | undefined | null) {
  const trimmed = value?.trim();
  if (trimmed) lines.push(trimmed);
}

function isSafeImageUrl(u?: string | null) {
  return !!u && typeof u === 'string' && /^https?:\/\//.test(u) && !u.startsWith('data:');
}

// ── Posts ────────────────────────────────────
export interface SharePostInput {
  id: string;
  content?: string | null;
  authorName: string;
  imageUrl?: string | null;
  likes?: number;
  comments?: number;
  t: boolean; // language === 'es'
}

export async function sharePost(p: SharePostInput) {
  const { id, content, authorName, imageUrl, likes = 0, comments = 0, t } = p;
  const deepLink = `${APP_DEEP_SCHEME}community/posts/${id}`;
  const webLink = `${APP_WEB}/p/${id}`;

  const lines: string[] = [];
  pushIfContent(lines, content ? `"${content.trim()}"` : undefined);
  lines.push(`— ${authorName} ${t ? 'en' : 'on'} ${APP_BRAND}`);
  if (likes > 0 || comments > 0) {
    const stats: string[] = [];
    if (likes > 0) stats.push(`❤ ${likes}`);
    if (comments > 0) stats.push(`💬 ${comments}`);
    lines.push(stats.join('  ·  '));
  }
  lines.push('');
  lines.push(`${t ? 'Abre la publicación' : 'Open the post'}: ${webLink}`);
  appendDownloadFooter(lines);
  lines.push('');
  lines.push('#OpalBar #NightLife');

  const message = lines.join('\n');
  const content_: ShareContent = Platform.OS === 'ios' && isSafeImageUrl(imageUrl)
    ? { message, url: imageUrl! }
    : { message: isSafeImageUrl(imageUrl) ? `${message}\n\n${imageUrl}` : message };

  try {
    await Share.share(content_, {
      dialogTitle: t ? 'Compartir publicación' : 'Share post',
      subject: `${authorName} · ${APP_BRAND}`,
    });
  } catch {
    // user dismissed
  }
  return { deepLink, webLink };
}

// ── Venues ───────────────────────────────────
export interface ShareVenueInput {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  address?: string | null;
  rating?: number;
  t: boolean;
}

export async function shareVenue(v: ShareVenueInput) {
  const webLink = `${APP_WEB}/v/${v.id}`;
  const lines: string[] = [];
  lines.push(`📍 ${v.name}`);
  if (typeof v.rating === 'number' && v.rating > 0) lines.push(`⭐ ${v.rating.toFixed(1)}`);
  pushIfContent(lines, v.address);
  pushIfContent(lines, v.description);
  lines.push('');
  lines.push(`${v.t ? 'Reserva en' : 'Book on'} ${APP_BRAND}: ${webLink}`);
  appendDownloadFooter(lines);

  const message = lines.join('\n');
  const content_: ShareContent = Platform.OS === 'ios' && isSafeImageUrl(v.imageUrl)
    ? { message, url: v.imageUrl! }
    : { message: isSafeImageUrl(v.imageUrl) ? `${message}\n\n${v.imageUrl}` : message };

  try {
    await Share.share(content_, {
      dialogTitle: v.t ? 'Compartir lugar' : 'Share venue',
      subject: `${v.name} · ${APP_BRAND}`,
    });
  } catch {}
  return { webLink };
}

// ── Events ───────────────────────────────────
export interface ShareEventInput {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startDate?: string | Date | null;
  venueName?: string | null;
  t: boolean;
}

export async function shareEvent(e: ShareEventInput) {
  const webLink = `${APP_WEB}/e/${e.id}`;
  const lines: string[] = [];
  lines.push(`🎉 ${e.title}`);
  if (e.startDate) {
    const d = typeof e.startDate === 'string' ? new Date(e.startDate) : e.startDate;
    if (!isNaN(d.getTime())) {
      lines.push(
        `📅 ${d.toLocaleDateString(e.t ? 'es' : 'en', {
          weekday: 'short', day: 'numeric', month: 'long',
        })} · ${d.toLocaleTimeString(e.t ? 'es' : 'en', {
          hour: '2-digit', minute: '2-digit',
        })}`
      );
    }
  }
  if (e.venueName) lines.push(`📍 ${e.venueName}`);
  pushIfContent(lines, e.description);
  lines.push('');
  lines.push(`${e.t ? 'Reserva tu lugar' : 'Get your spot'}: ${webLink}`);
  appendDownloadFooter(lines);

  const message = lines.join('\n');
  const content_: ShareContent = Platform.OS === 'ios' && isSafeImageUrl(e.imageUrl)
    ? { message, url: e.imageUrl! }
    : { message: isSafeImageUrl(e.imageUrl) ? `${message}\n\n${e.imageUrl}` : message };

  try {
    await Share.share(content_, {
      dialogTitle: e.t ? 'Compartir evento' : 'Share event',
      subject: `${e.title} · ${APP_BRAND}`,
    });
  } catch {}
  return { webLink };
}

// ── Offers ───────────────────────────────────
export interface ShareOfferInput {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  pointsCost?: number | null;
  discount?: string | null;
  t: boolean;
}

export async function shareOffer(o: ShareOfferInput) {
  const webLink = `${APP_WEB}/o/${o.id}`;
  const lines: string[] = [];
  lines.push(`🎁 ${o.title}`);
  if (o.discount) lines.push(`💸 ${o.discount}`);
  if (typeof o.pointsCost === 'number' && o.pointsCost > 0) {
    lines.push(`🪙 ${o.pointsCost} ${o.t ? 'puntos' : 'points'}`);
  }
  pushIfContent(lines, o.description);
  lines.push('');
  lines.push(`${o.t ? 'Canjea en' : 'Redeem on'} ${APP_BRAND}: ${webLink}`);
  appendDownloadFooter(lines);

  const message = lines.join('\n');
  const content_: ShareContent = Platform.OS === 'ios' && isSafeImageUrl(o.imageUrl)
    ? { message, url: o.imageUrl! }
    : { message: isSafeImageUrl(o.imageUrl) ? `${message}\n\n${o.imageUrl}` : message };

  try {
    await Share.share(content_, {
      dialogTitle: o.t ? 'Compartir oferta' : 'Share offer',
      subject: `${o.title} · ${APP_BRAND}`,
    });
  } catch {}
  return { webLink };
}
