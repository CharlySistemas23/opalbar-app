// ─────────────────────────────────────────────
//  Sentry — admin web crash reporting
//  Currently a no-op. The previous implementation imported `@sentry/react`
//  but that package is not in package.json, so Vercel builds were failing.
//  If/when crash reporting is wanted again: `npm i @sentry/react` and
//  restore the original init block here.
// ─────────────────────────────────────────────

export const Sentry = {
  init: () => {},
  captureException: () => {},
  captureMessage: () => {},
};
