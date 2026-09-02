// ─────────────────────────────────────────────
//  Venue-local time helpers (Puerto Vallarta → America/Mexico_City).
//
//  The server runs in UTC; every "today", "now", day-of-week and opening
//  window comparison must be done in the venue's timezone, never with the
//  bare `Date` getters. Reservation dates are date-only strings stored as
//  UTC midnight — use `dateOnlyToUtc` to build the DB value.
// ─────────────────────────────────────────────

export const MX_TZ = 'America/Mexico_City';

const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: MX_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: MX_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MxParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  weekday: number; // 0 = Sunday … 6 = Saturday (matches JS Date#getDay)
  minutes: number; // minutes since local midnight
}

function partsOf(at: Date): MxParts {
  const parts = PARTS_FMT.formatToParts(at);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = Number(pick('hour')) % 24; // some ICU builds print "24" at midnight
  const minute = Number(pick('minute'));
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    time: `${hh}:${mm}`,
    weekday: Math.max(0, WEEKDAYS.indexOf(pick('weekday'))),
    minutes: hour * 60 + minute,
  };
}

/** Calendar date in Mexico City as YYYY-MM-DD. */
export function todayMx(now: Date = new Date()): string {
  return DATE_FMT.format(now);
}

/** Wall-clock time in Mexico City as HH:mm. */
export function nowTimeMx(now: Date = new Date()): string {
  return partsOf(now).time;
}

/** Day of week in Mexico City (0 = Sunday). */
export function weekdayMx(now: Date = new Date()): number {
  return partsOf(now).weekday;
}

/** Full local snapshot (date, time, weekday, minutes). */
export function nowMx(now: Date = new Date()): MxParts {
  return partsOf(now);
}

/** "HH:mm" → minutes since midnight. Returns NaN on malformed input. */
export function toMinutes(hhmm: string | null | undefined): number {
  if (!hhmm) return NaN;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMinutes(total: number): string {
  const norm = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Normalises any ISO-ish date input to its YYYY-MM-DD prefix. */
export function toDateOnly(input: string | Date): string {
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  return input.slice(0, 10);
}

/** Date-only string → the UTC-midnight `Date` the DB stores. */
export function dateOnlyToUtc(date: string): Date {
  return new Date(`${toDateOnly(date)}T00:00:00.000Z`);
}

export function isValidDateOnly(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = dateOnlyToUtc(date);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** Adds `days` calendar days to a YYYY-MM-DD string. */
export function addDays(date: string, days: number): string {
  const d = dateOnlyToUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * True when `time` (HH:mm) falls inside [start, end). Handles overnight
 * windows such as 20:00 → 02:00. A missing start or end means "no bound".
 */
export function isWithinWindow(
  time: string,
  start?: string | null,
  end?: string | null,
): boolean {
  const t = toMinutes(time);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (Number.isNaN(t)) return false;
  if (Number.isNaN(s) && Number.isNaN(e)) return true;
  if (Number.isNaN(s)) return t < e;
  if (Number.isNaN(e)) return t >= s;
  if (s === e) return true; // 24h window
  if (s < e) return t >= s && t < e;
  return t >= s || t < e; // overnight
}

/** Offset (minutes) of Mexico City vs UTC at the given instant. */
function mxOffsetMinutes(at: Date): number {
  const p = partsOf(at);
  const [y, mo, d] = p.date.split('-').map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, Math.floor(p.minutes / 60), p.minutes % 60, 0);
  const truncated = Math.floor(at.getTime() / 60000) * 60000;
  return Math.round((asUtc - truncated) / 60000);
}

/** Wall-clock (date + HH:mm) in Mexico City → absolute UTC instant. */
export function mxLocalToUtc(date: string, time: string): Date {
  const [y, mo, d] = toDateOnly(date).split('-').map(Number);
  const mins = toMinutes(time);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0);
  const offset = mxOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000);
}

/**
 * Builds the reservable slots for a venue day. Overnight hours (close <=
 * open) roll into the following calendar day; the last slot ends before
 * closing time. Returns [] when hours are not configured.
 */
export function buildSlots(
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
  slotMinutes = 30,
): string[] {
  const open = toMinutes(openTime);
  let close = toMinutes(closeTime);
  const step = Math.max(5, Number(slotMinutes) || 30);
  if (Number.isNaN(open) || Number.isNaN(close)) return [];
  if (close <= open) close += 1440;
  const out: string[] = [];
  for (let t = open; t < close; t += step) out.push(fromMinutes(t));
  return out;
}

/**
 * Absolute instant of a reservation slot. For overnight venues a slot that
 * starts before opening time belongs to the *next* calendar day (the
 * reservation date is the "service night").
 */
export function slotInstant(
  date: string,
  time: string,
  openTime?: string | null,
  closeTime?: string | null,
): Date {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  const t = toMinutes(time);
  const overnight = !Number.isNaN(open) && !Number.isNaN(close) && close <= open;
  const day = overnight && !Number.isNaN(t) && t < open ? addDays(date, 1) : toDateOnly(date);
  return mxLocalToUtc(day, time);
}
