// ─────────────────────────────────────────────
//  Email Marketing Templates
//  Server-side HTML rendering for campaigns composed from mobile.
//  All templates share the same data contract so the mobile wizard
//  never has to think in HTML.
// ─────────────────────────────────────────────

import { EmailCampaignTemplate } from '@prisma/client';

export interface TemplateMeta {
  id: EmailCampaignTemplate;
  name: string;
  description: string;
  accent: string;
  icon: string; // Feather icon name, consumed by mobile picker
}

export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: 'OFFER',
    name: 'Oferta',
    description: 'Promociones y descuentos con CTA destacado',
    accent: '#F4A340',
    icon: 'tag',
  },
  {
    id: 'EVENT',
    name: 'Evento',
    description: 'Invita a un evento con imagen protagonista',
    accent: '#A855F7',
    icon: 'calendar',
  },
  {
    id: 'BIRTHDAY',
    name: 'Cumpleaños',
    description: 'Mensaje celebratorio con regalo sorpresa',
    accent: '#EC4899',
    icon: 'gift',
  },
  {
    id: 'WELCOME',
    name: 'Bienvenida',
    description: 'Da la bienvenida a nuevos miembros',
    accent: '#38C793',
    icon: 'user-plus',
  },
  {
    id: 'NEWS',
    name: 'Novedades',
    description: 'Comparte noticias y actualizaciones',
    accent: '#60A5FA',
    icon: 'message-square',
  },
  {
    id: 'GENERIC',
    name: 'Genérico',
    description: 'Plantilla neutral para cualquier tema',
    accent: '#F4A340',
    icon: 'mail',
  },
];

export interface RenderInput {
  template: EmailCampaignTemplate;
  subject: string;
  preheader?: string | null;
  headline: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  heroImageUrl?: string | null;
  trackingPixelUrl?: string;
  unsubscribeUrl?: string;
  recipientFirstName?: string;
}

export function renderEmailHtml(input: RenderInput): string {
  // Design homologated across all templates — editorial, sober, light theme.
  // Per-template accents were dropped from the rendered email (they remain in
  // the admin picker only) to keep every OPALBAR email feeling like the same
  // brand.

  const greeting = input.recipientFirstName
    ? `Hola, ${escapeHtml(input.recipientFirstName)}.`
    : 'Hola.';

  const bodyHtml = markdownLite(input.body);
  const preheader = input.preheader ? escapeHtml(input.preheader) : '';

  // Skip hero image when the URL points somewhere Gmail/Outlook cannot reach
  // (localhost, private IPs).
  const heroReachable = isPublicHttpUrl(input.heroImageUrl);
  const hero = heroReachable && input.heroImageUrl
    ? `<tr><td style="padding:0 0 32px;">
         <img src="${escapeAttr(input.heroImageUrl)}"
              alt="${escapeAttr(input.headline || 'OPALBAR')}"
              width="560"
              style="display:block;width:100%;max-width:560px;height:auto;background:#EFEDE7;border-radius:2px;" />
       </td></tr>`
    : '';

  const cta = input.ctaLabel && input.ctaUrl
    ? `<tr>
         <td style="padding:8px 0 0;">
           <a href="${escapeAttr(input.ctaUrl)}"
              style="display:inline-block;background:#1A1A1E;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:15px 28px;border-radius:2px;text-decoration:none;">${escapeHtml(input.ctaLabel)}</a>
         </td>
       </tr>`
    : '';

  const trackingPixel = input.trackingPixelUrl
    ? `<img src="${escapeAttr(input.trackingPixelUrl)}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;opacity:0;" />`
    : '';

  const unsub = input.unsubscribeUrl
    ? `<a href="${escapeAttr(input.unsubscribeUrl)}" style="color:#8A8A92;text-decoration:underline;">Cancelar suscripción</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F5F3EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1A1E;">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EE;">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;">

        <!-- Wordmark -->
        <tr>
          <td align="center" style="padding:40px 48px 8px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:400;letter-spacing:6px;color:#1A1A1E;text-transform:uppercase;">OPALBAR</div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 48px 36px;">
            <div style="width:32px;height:1px;background:#1A1A1E;margin:0 auto;"></div>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:0 48px;">
            <table role="presentation" width="100%"><tbody>${hero}</tbody></table>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:0 48px 16px;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#8A8A92;">
            ${greeting}
          </td>
        </tr>

        <!-- Headline -->
        <tr>
          <td style="padding:0 48px 20px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;line-height:1.2;letter-spacing:-0.4px;color:#1A1A1E;">
            ${escapeHtml(input.headline)}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:0 48px 32px;font-size:15px;line-height:1.7;color:#3A3A42;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 48px 48px;">
            <table role="presentation"><tbody>${cta}</tbody></table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 48px;">
            <div style="height:1px;background:#E5E3DD;"></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:28px 48px 40px;color:#8A8A92;font-size:11px;line-height:1.8;letter-spacing:0.3px;">
            <div style="font-family:Georgia,'Times New Roman',serif;letter-spacing:3px;text-transform:uppercase;color:#1A1A1E;font-size:10px;margin-bottom:6px;">OPALBAR</div>
            © ${new Date().getFullYear()} · Siempre hay algo pasando<br />
            ${unsub}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
${trackingPixel}
</body>
</html>`;
}

export function renderEmailText(input: RenderInput): string {
  const lines = [
    'OPALBAR',
    '',
    input.headline,
    '',
    stripMarkdown(input.body),
  ];
  if (input.ctaLabel && input.ctaUrl) {
    lines.push('', `${input.ctaLabel}: ${input.ctaUrl}`);
  }
  if (input.unsubscribeUrl) {
    lines.push('', '', `Darse de baja: ${input.unsubscribeUrl}`);
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Gmail/Outlook fetch images from their own servers (image-proxy). URLs that
 * only resolve on the operator's machine — localhost, 127.x.x.x, private LAN
 * ranges — will ALWAYS break for the recipient, so we skip them server-side
 * instead of shipping a guaranteed-broken <img> to inboxes.
 */
function isPublicHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0') return false;
    // IPv4 private ranges
    const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
    if (ipv4) {
      const [, a, b] = ipv4.map(Number) as [number, number, number, number, number];
      if (a === 10) return false;                              // 10.0.0.0/8
      if (a === 127) return false;                             // loopback
      if (a === 192 && b === 168) return false;                // 192.168.0.0/16
      if (a === 172 && b >= 16 && b <= 31) return false;       // 172.16.0.0/12
      if (a === 169 && b === 254) return false;                // link-local
    }
    // IPv6 loopback
    if (host === '::1' || host.startsWith('[::1]')) return false;
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * Markdown-lite: **bold**, double-newline = paragraph, single newline = <br>.
 * Safe subset so admins composing from mobile don't need to think in HTML.
 */
function markdownLite(body: string): string {
  const paragraphs = escapeHtml(body).split(/\n{2,}/);
  return paragraphs
    .map((p) => {
      const withBreaks = p.replace(/\n/g, '<br />');
      const withBold = withBreaks.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return `<p style="margin:0 0 14px;">${withBold}</p>`;
    })
    .join('');
}

function stripMarkdown(body: string): string {
  return body.replace(/\*\*(.+?)\*\*/g, '$1');
}
