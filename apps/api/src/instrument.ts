// ─────────────────────────────────────────────
//  Sentry init — must be imported FIRST in main.ts (before any other module)
//  No-op when SENTRY_DSN is not set (local dev).
// ─────────────────────────────────────────────
import * as Sentry from '@sentry/nestjs';

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['SENTRY_ENVIRONMENT'] || process.env['NODE_ENV'] || 'development',
    release: process.env['npm_package_version'] || '1.0.0',
    tracesSampleRate: parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] || '0.2'),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-refresh-token'];
      }
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, unknown>;
        for (const k of ['password', 'newPassword', 'currentPassword', 'token', 'refreshToken', 'otp', 'code']) {
          if (k in data) data[k] = '[REDACTED]';
        }
      }
      return event;
    },
  });
}
