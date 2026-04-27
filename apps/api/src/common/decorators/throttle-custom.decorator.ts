// ─────────────────────────────────────────────
//  Per-endpoint rate-limit decorators
//  Production limits are STRICT. Development relaxes them so manual testing
//  isn't blocked. Set NODE_ENV=production to enforce real caps.
// ─────────────────────────────────────────────
import { Throttle } from '@nestjs/throttler';

const isDev = process.env['NODE_ENV'] === 'development';

/** Auth endpoints (login, register, refresh, password reset). */
export const ThrottleAuth = () =>
  Throttle({
    auth: {
      limit: isDev ? 1000 : 10,
      ttl: 60000,
    },
  });

/** OTP send/verify — strictest tier (prevents enumeration + SMS-cost abuse). */
export const ThrottleOtp = () =>
  Throttle({
    otp: {
      limit: isDev ? 100 : 5,
      ttl: 300_000, // 5min
    },
  });

/** Outbound user content (post, comment, message, story). Spam mitigation. */
export const ThrottleWrite = () =>
  Throttle({
    default: {
      limit: isDev ? 1000 : 30,
      ttl: 60_000,
    },
  });

/** Push token register / settings. Should be invoked once per session. */
export const ThrottlePush = () =>
  Throttle({
    default: {
      limit: isDev ? 1000 : 10,
      ttl: 60_000,
    },
  });
