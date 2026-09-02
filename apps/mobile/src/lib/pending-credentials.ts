// ─────────────────────────────────────────────
//  Pending credentials — in-memory only
//
//  During registration / "email not verified" login the OTP screen needs
//  the password to auto-login after verification. We NEVER pass it as a
//  route param (params end up in navigation state, logs and deep-link
//  URLs). Instead the originating screen parks it here and the OTP screen
//  takes it once. Nothing is persisted; a cold start clears it.
// ─────────────────────────────────────────────

interface Pending {
  identifier: string;
  password: string;
}

let pending: Pending | null = null;

function norm(id: string): string {
  return id.trim().toLowerCase();
}

/** Park a password for the given identifier (email or E.164 phone). */
export function setPendingPassword(identifier: string, password: string): void {
  pending = { identifier: norm(identifier), password };
}

/** True when a password is parked for this identifier. */
export function hasPendingPassword(identifier: string | undefined): boolean {
  return !!identifier && !!pending && pending.identifier === norm(identifier);
}

/**
 * Read AND clear the parked password. Returns null when nothing is parked
 * for that identifier (stale entry for another account is discarded too).
 */
export function takePendingPassword(identifier: string | undefined): string | null {
  const pw = hasPendingPassword(identifier) ? pending!.password : null;
  pending = null;
  return pw;
}

export function clearPendingPassword(): void {
  pending = null;
}
