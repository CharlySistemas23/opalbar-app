// ─────────────────────────────────────────────
//  @ThrottleAuth() / @ThrottleOtp() — custom rate limit decorators
// ─────────────────────────────────────────────
import { Throttle } from '@nestjs/throttler';

/** 10 requests / 60s — for auth endpoints (login, register) */
export const ThrottleAuth = () =>
  Throttle({ auth: { limit: 10, ttl: 60000 } });

/** 3 requests / 5min — for OTP send endpoints */
export const ThrottleOtp = () =>
  Throttle({ otp: { limit: 3, ttl: 300000 } });
