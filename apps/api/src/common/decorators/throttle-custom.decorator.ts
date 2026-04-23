// ─────────────────────────────────────────────
//  @ThrottleAuth() / @ThrottleOtp() — custom rate limit decorators
// ─────────────────────────────────────────────
import { Throttle } from '@nestjs/throttler';

/** DEV: 1000 requests / 60s — relax for testing */
export const ThrottleAuth = () =>
  Throttle({ auth: { limit: 1000, ttl: 60000 } });

/** DEV: 100 requests / 60s — relax OTP for testing */
export const ThrottleOtp = () =>
  Throttle({ otp: { limit: 100, ttl: 60000 } });
