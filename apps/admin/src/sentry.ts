// ─────────────────────────────────────────────
//  Sentry — admin web crash reporting
//  No-op when VITE_SENTRY_DSN is not set.
// ─────────────────────────────────────────────
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.2'),
    integrations: [Sentry.browserTracingIntegration()],
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, string>)['authorization'];
        delete (event.request.headers as Record<string, string>)['cookie'];
      }
      return event;
    },
  });
}

export { Sentry };
