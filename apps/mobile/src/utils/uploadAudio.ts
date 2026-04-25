// Voice-note upload — pushes a local m4a/aac/3gp file to Cloudinary via the
// video/upload endpoint (which accepts audio-only payloads) and returns the
// secure CDN URL. Mirrors uploadImage's shape so call sites are symmetric.
const CLOUD_NAME = process.env['EXPO_PUBLIC_CLOUDINARY_CLOUD'] ?? 'dl9o0umy3';
const UPLOAD_PRESET = process.env['EXPO_PUBLIC_CLOUDINARY_PRESET'] ?? 'opalbar_unsigned';

export class UploadError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'UploadError';
  }
}

export async function uploadAudio(uri: string): Promise<string> {
  if (!uri) throw new UploadError('No audio URI provided');
  if (/^https?:\/\//i.test(uri)) return uri;

  const form = new FormData();
  const ext = uri.split('.').pop()?.toLowerCase() || 'm4a';
  const mime = ext === 'm4a' || ext === 'mp4' ? 'audio/mp4'
    : ext === '3gp' ? 'audio/3gpp'
    : ext === 'aac' ? 'audio/aac'
    : 'audio/mp4';
  form.append('file', {
    uri,
    type: mime,
    name: `voice_${Date.now()}.${ext}`,
  } as any);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', 'opalbar/voice');
  form.append('resource_type', 'video');

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;
  let resp: Response;
  try {
    resp = await fetch(endpoint, { method: 'POST', body: form as any });
  } catch (err) {
    throw new UploadError('Network error during audio upload', err);
  }
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.error?.message) detail = body.error.message;
    } catch {}
    throw new UploadError(`Cloudinary audio upload failed: ${detail}`);
  }
  const json = await resp.json().catch(() => null);
  const url = json?.secure_url || json?.url;
  if (typeof url !== 'string' || !url) {
    throw new UploadError('Cloudinary response missing secure_url');
  }
  return url;
}
