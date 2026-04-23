// ─────────────────────────────────────────────
//  Image upload — compresses + uploads to Cloudinary, returns a CDN URL.
//
//  Flow:
//    1. Local URI from ImagePicker (file:// on Android, ph:// on iOS, etc).
//    2. expo-image-manipulator resizes to ≤1600px long edge + JPEG 0.8.
//    3. Multipart POST to Cloudinary unsigned upload endpoint.
//    4. Returns the `secure_url` we then save in the DB.
//
//  Avoids the old base64-in-Postgres path that bloated the Railway DB and
//  made rich share previews impossible (data: URIs can't be attached).
// ─────────────────────────────────────────────
import * as ImageManipulator from 'expo-image-manipulator';

const CLOUD_NAME = process.env['EXPO_PUBLIC_CLOUDINARY_CLOUD'] ?? 'dl9o0umy3';
const UPLOAD_PRESET = process.env['EXPO_PUBLIC_CLOUDINARY_PRESET'] ?? 'opalbar_unsigned';

export type UploadKind = 'post' | 'story' | 'avatar' | 'cover' | 'venue' | 'event' | 'offer' | 'marketing';

export interface UploadOptions {
  /** What we're uploading — controls max dimension + folder. */
  kind?: UploadKind;
  /** Override max long-edge in px. Default depends on kind. */
  maxDim?: number;
  /** JPEG compression 0..1. Default 0.8. */
  quality?: number;
  /** Abort signal to cancel long uploads. */
  signal?: AbortSignal;
}

const MAX_DIM: Record<UploadKind, number> = {
  post: 1600,
  story: 1440,
  avatar: 512,
  cover: 1600,
  venue: 1600,
  event: 1600,
  offer: 1600,
  marketing: 1600,
};

export class UploadError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Compresses a local image URI and uploads it to Cloudinary.
 * Returns the CDN URL (`https://res.cloudinary.com/...`).
 *
 * Already-hosted URLs (http/https) are returned as-is — safe to call when the
 * user didn't actually change the image.
 */
export async function uploadImage(uri: string, opts: UploadOptions = {}): Promise<string> {
  if (!uri) throw new UploadError('No image URI provided');

  // Already a remote URL? Nothing to do.
  if (/^https?:\/\//i.test(uri)) return uri;

  const kind = opts.kind ?? 'post';
  const maxDim = opts.maxDim ?? MAX_DIM[kind];
  const quality = opts.quality ?? 0.8;

  // Compress + resize locally BEFORE hitting the network. Avoids uploading 8MB
  // originals only to have Cloudinary resize them server-side.
  let processedUri: string;
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxDim } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
    );
    processedUri = result.uri;
  } catch (err) {
    throw new UploadError('Could not process image', err);
  }

  const form = new FormData();
  // React Native multipart: Cloudinary expects `file` as a {uri, type, name}
  // object, not a Blob. The Expo/RN FormData polyfill handles this shape.
  form.append('file', {
    uri: processedUri,
    type: 'image/jpeg',
    name: `upload_${Date.now()}.jpg`,
  } as any);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', `opalbar/${kind}`);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      body: form as any,
      signal: opts.signal,
    });
  } catch (err) {
    throw new UploadError('Network error during upload', err);
  }

  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.error?.message) detail = body.error.message;
    } catch {}
    throw new UploadError(`Cloudinary upload failed: ${detail}`);
  }

  const json = await resp.json().catch(() => null);
  const url = json?.secure_url || json?.url;
  if (typeof url !== 'string' || !url) {
    throw new UploadError('Cloudinary response missing secure_url');
  }
  return url;
}

/**
 * Strips any legacy `data:image/...;base64,...` prefix so we never accidentally
 * send a base64 payload to the backend. Used as a guard in submit handlers.
 */
export function assertRemoteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return null;
  return url;
}
