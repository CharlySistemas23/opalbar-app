// ─────────────────────────────────────────────
//  Date-only helpers (reservations, offers, venue hours).
//
//  The API stores reservation dates as UTC midnight (`2026-09-02T00:00:00.000Z`).
//  `new Date(iso)` then renders as *Sept 1st* on any device west of UTC, which is
//  every phone in Mexico. Every date-only value goes through `parseDateOnly` so
//  the calendar day the guest picked is the day we show.
//
//  The venue is in Puerto Vallarta → America/Mexico_City. "Today" and "open
//  now" are venue-local, not device-local (a tourist on US time still sees the
//  bar's real status).
// ─────────────────────────────────────────────

export const MX_TZ = 'America/Mexico_City';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `'2026-09-02'` or `'2026-09-02T00:00:00.000Z'` → local `Date(2026, 8, 2)` at midnight. */
export function parseDateOnly(iso?: string | Date | null): Date | null {
  if (!iso) return null;
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return null;
    // A Date coming from JSON is UTC midnight — read the UTC fields.
    return new Date(iso.getUTCFullYear(), iso.getUTCMonth(), iso.getUTCDate());
  }
  const m = DATE_ONLY_RE.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `'2026-09-02T…'` → `'2026-09-02'` (no timezone shift). */
export function toDateOnly(iso?: string | Date | null): string | null {
  if (!iso) return null;
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return null;
    return `${iso.getUTCFullYear()}-${pad(iso.getUTCMonth() + 1)}-${pad(iso.getUTCDate())}`;
  }
  const m = DATE_ONLY_RE.exec(iso);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Local `Date` → `'YYYY-MM-DD'` using the device's calendar fields (for pickers). */
export function formatLocalDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface FormatDateOnlyOptions {
  weekday?: 'short' | 'long' | false;
  month?: 'short' | 'long' | 'numeric';
  year?: boolean;
}

/** Human date for a date-only value: `mié, 2 de septiembre`. */
export function formatDateOnly(
  iso: string | Date | null | undefined,
  lang: 'es' | 'en' = 'es',
  opts: FormatDateOnlyOptions = {},
): string {
  const d = parseDateOnly(iso);
  if (!d) return '';
  const { weekday = 'short', month = 'long', year = false } = opts;
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', {
      ...(weekday ? { weekday } : {}),
      day: 'numeric',
      month,
      ...(year ? { year: 'numeric' } : {}),
    }).format(d);
  } catch {
    return formatLocalDateOnly(d);
  }
}

/** Venue-local calendar day as `'YYYY-MM-DD'`. */
export function todayMx(now: Date = new Date()): string {
  try {
    // en-CA renders ISO order: 2026-09-02
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: MX_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return formatLocalDateOnly(now);
  }
}

/** Next `count` venue-local days as `'YYYY-MM-DD'`, starting today. */
export function nextDaysMx(count = 21, now: Date = new Date()): string[] {
  const start = parseDateOnly(todayMx(now)) ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(formatLocalDateOnly(d));
  }
  return out;
}

/** Venue-local wall clock as `'HH:mm'`. */
export function nowTimeMx(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: MX_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${h === '24' ? '00' : h}:${m}`;
  } catch {
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}

/** Venue-local weekday, 0 = Sunday … 6 = Saturday (matches `Offer.daysOfWeek`). */
export function weekdayMx(now: Date = new Date()): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: MX_TZ, weekday: 'short' }).format(now);
    const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
    return idx >= 0 ? idx : now.getDay();
  } catch {
    return now.getDay();
  }
}

export function toMinutes(hhmm?: string | null): number | null {
  if (!hhmm || !HHMM_RE.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Is `time` inside [start, end)? Handles windows that cross midnight
 * (`22:00`–`02:00`). Missing bounds are open-ended.
 */
export function isWithinWindow(time: string, start?: string | null, end?: string | null): boolean {
  const t = toMinutes(time);
  if (t == null) return false;
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s == null && e == null) return true;
  if (s == null) return t < (e as number);
  if (e == null) return t >= s;
  if (s === e) return true; // 24h
  return s < e ? t >= s && t < e : t >= s || t < e;
}

/** Venue open right now (venue-local clock), overnight-aware. */
export function isOpenNow(openTime?: string | null, closeTime?: string | null, now: Date = new Date()): boolean {
  if (!openTime || !closeTime) return false;
  return isWithinWindow(nowTimeMx(now), openTime, closeTime);
}

/** `'2026-09-02'` is strictly before venue-local today. */
export function isPastDateOnly(iso?: string | Date | null, now: Date = new Date()): boolean {
  const d = toDateOnly(iso);
  return !!d && d < todayMx(now);
}

/** `'2026-09-02'` equals venue-local today. */
export function isTodayMx(iso?: string | Date | null, now: Date = new Date()): boolean {
  const d = toDateOnly(iso);
  return !!d && d === todayMx(now);
}

/** Slot on `date` (venue-local) has already started. */
export function isPastSlot(date?: string | Date | null, timeSlot?: string | null, now: Date = new Date()): boolean {
  const d = toDateOnly(date);
  if (!d) return false;
  const today = todayMx(now);
  if (d < today) return true;
  if (d > today) return false;
  const slot = toMinutes(timeSlot);
  const cur = toMinutes(nowTimeMx(now));
  return slot != null && cur != null && slot <= cur;
}

/** `'20:30'` → `'8:30 PM'` (en) / `'20:30'` (es). */
export function formatTimeSlot(hhmm?: string | null, lang: 'es' | 'en' = 'es'): string {
  const mins = toMinutes(hhmm);
  if (mins == null) return hhmm ?? '';
  if (lang === 'es') return hhmm as string;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
