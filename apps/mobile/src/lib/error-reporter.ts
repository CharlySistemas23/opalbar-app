// ─────────────────────────────────────────────
//  Error Reporter — frontend Sentry stub
//
//  Hook for future @sentry/react-native integration. Until that ships
//  (native deps would break OTA), we:
//    1. Log to console in dev (so devs see errors during local runs).
//    2. Best-effort POST to /client-errors so the backend Sentry
//       (@sentry/nestjs) captures it server-side — gives us one shared
//       inbox for client+server crashes without adding RN native deps.
//
//  When @sentry/react-native is integrated later, only this file changes:
//    - reportError → Sentry.captureException
//    - setUser → Sentry.setUser
//    The call sites (ErrorBoundary, auth.store) stay identical.
// ─────────────────────────────────────────────
import { apiClient } from '../api/client';

interface UserContext {
  id: string | null;
  email?: string;
}

// Module-level user context — attached to every report. Kept in memory only
// (no persistence): if the user logs out we drop it; on next login setUser
// is called again from auth.store.
let _user: UserContext | null = null;

export function setUser(id: string | null, email?: string): void {
  if (id === null) {
    _user = null;
    return;
  }
  _user = { id, ...(email ? { email } : {}) };
}

export function reportError(err: unknown, context?: Record<string, unknown>): void {
  const error = err instanceof Error ? err : new Error(String(err));
  const message = error.message || 'Unknown error';
  const stack = error.stack;

  // 1) Console for local visibility (DEV only — avoid noisy prod logs).
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[error-reporter]', message, { stack, context, user: _user });
  }

  // 2) Ship to backend best-effort. Silent on any failure: error reporting
  //    must never throw or block the calling code path (ErrorBoundary
  //    fallback UI, etc).
  const payload = {
    message: message.length > 5000 ? message.slice(0, 5000) : message,
    stack,
    context: {
      ...(context ?? {}),
      ...(_user ? { user: _user } : {}),
      platform: 'mobile',
    },
  };

  try {
    apiClient
      .post('/client-errors', payload)
      .catch(() => {
        /* silent — best-effort */
      });
  } catch {
    /* silent — never let reporter break the app */
  }
}
