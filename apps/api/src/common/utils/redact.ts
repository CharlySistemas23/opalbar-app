// ─────────────────────────────────────────────
//  redact() — strip sensitive fields before logging
//  Use whenever you log a DTO, request body, or user-derived payload.
// ─────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'otp',
  'code',
  'secret',
  'apikey',
  'api_key',
  'authtoken',
]);

const REDACTED = '[REDACTED]';

export function redact<T>(input: T, depth = 0): T {
  if (depth > 4 || input == null) return input;
  if (Array.isArray(input)) {
    return input.map((v) => redact(v, depth + 1)) as unknown as T;
  }
  if (typeof input !== 'object') return input;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = REDACTED;
    } else if (v && typeof v === 'object') {
      out[k] = redact(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
