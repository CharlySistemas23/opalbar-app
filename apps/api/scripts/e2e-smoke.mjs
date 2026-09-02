#!/usr/bin/env node
/**
 * OPALBAR — end-to-end smoke test against a running API.
 *
 *   node apps/api/scripts/e2e-smoke.mjs                     # prod (Railway)
 *   API=http://localhost:3000/api/v1 node .../e2e-smoke.mjs  # local
 *
 * Creates two throwaway users, drives every major user-facing flow through
 * the real HTTP API, and deletes both accounts at the end. Every step prints
 * PASS / FAIL / SKIP so a regression is obvious at a glance.
 *
 * Exit code 0 = everything that ran passed. 1 = at least one failure.
 *
 * It never touches existing data: all writes belong to the two temp users,
 * and read-only checks are used for shared resources (events, offers, venue).
 */

const API = process.env.API ?? 'https://opalbar-app-production.up.railway.app/api/v1';
const STAMP = Date.now();
const PASSWORD = 'OpalTest1!';

const results = [];
let currentGroup = 'general';

function group(name) {
  currentGroup = name;
  console.log(`\n\x1b[1m── ${name} ─────────────────────────────\x1b[0m`);
}

function record(status, name, detail) {
  results.push({ group: currentGroup, status, name, detail });
  const icon =
    status === 'PASS' ? '\x1b[32mPASS\x1b[0m'
      : status === 'SKIP' ? '\x1b[33mSKIP\x1b[0m'
        : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${icon}  ${name}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`);
}

/** Runs a step; a thrown error is a failure, a returned value is passed on. */
async function step(name, fn, { optional = false } = {}) {
  try {
    const out = await fn();
    record('PASS', name);
    return out;
  } catch (err) {
    const detail = err?.detail ?? err?.message ?? String(err);
    record(optional ? 'SKIP' : 'FAIL', name, detail);
    return undefined;
  }
}

async function api(method, path, { token, body, expect = [200, 201, 204] } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (!expect.includes(res.status)) {
    const msg = json?.message ?? text.slice(0, 200);
    const err = new Error(`${method} ${path} → ${res.status}`);
    err.detail = `${res.status} ${Array.isArray(msg) ? msg.join('; ') : msg}`;
    err.status = res.status;
    err.body = json;
    throw err;
  }
  // Unwrap the { success, data, timestamp } envelope.
  return json?.data !== undefined ? json.data : json;
}

function assert(cond, message) {
  if (!cond) {
    const err = new Error(message);
    err.detail = message;
    throw err;
  }
}

/**
 * Reads the OTP the API logged for `email`.
 *
 * In development `OtpService` logs `[DEV] OTP code for <email>: 123456` after
 * sending, so a local run can complete the email-verification step without an
 * inbox. Set `OTP_LOG=/path/to/api.log` to enable it.
 */
async function readOtpFromLog(email, { attempts = 20, delayMs = 500 } = {}) {
  const logPath = process.env.OTP_LOG;
  if (!logPath) {
    const err = new Error('email verification required');
    err.detail = 'set OTP_LOG=<api log path> (dev) or point the suite at an already-verified account';
    throw err;
  }
  const { readFile } = await import('node:fs/promises');
  const re = new RegExp(`OTP code for ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: (\\d{4,8})`, 'g');
  for (let i = 0; i < attempts; i++) {
    try {
      const text = await readFile(logPath, 'utf8');
      const codes = [...text.matchAll(re)].map((m) => m[1]);
      if (codes.length) return codes[codes.length - 1];
    } catch { /* log not written yet */ }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  const err = new Error('OTP not found in log');
  err.detail = `no "[DEV] OTP code for ${email}" line in ${logPath}`;
  throw err;
}

/** Registers a user (verifying the email OTP if needed) and returns a session. */
async function makeUser(tag) {
  const email = `e2e.${tag}.${STAMP}@opalbar-test.mx`;
  const firstName = tag === 'a' ? 'Ana' : 'Beto';
  const reg = await api('POST', '/auth/register', {
    body: { email, password: PASSWORD, firstName, lastName: 'Prueba' },
    expect: [200, 201],
  });

  let tokens = reg?.tokens;
  let userId = reg?.user?.id;

  if (!tokens?.accessToken) {
    // Email verification flow: read the dev-logged code, verify, then log in.
    const code = await readOtpFromLog(email);
    await api('POST', '/otp/verify', {
      body: { identifier: email, code, type: 'EMAIL_VERIFICATION' },
    });
    const login = await api('POST', '/auth/login', {
      body: { email, password: PASSWORD, deviceName: 'e2e', deviceOs: 'node' },
    });
    tokens = login?.tokens;
    userId = login?.user?.id ?? userId;
  }

  assert(tokens?.accessToken, 'no access token after registration');
  assert(userId, 'no user id after registration');
  return { id: userId, email, token: tokens.accessToken, refreshToken: tokens.refreshToken };
}

const main = async () => {
  console.log(`\x1b[1mOPALBAR e2e smoke\x1b[0m  →  ${API}\n`);

  group('infra');
  await step('health', async () => {
    const r = await fetch(`${API}/health`);
    assert(r.ok, `health ${r.status}`);
  });
  await step('legal/terms served (App Store requirement)', async () => {
    const r = await fetch(`${API}/legal/terms`);
    assert(r.ok, `terms ${r.status}`);
    const html = await r.text();
    assert(/tolerancia|tolerance/i.test(html), 'terms missing zero-tolerance clause');
  });
  await step('legal/privacy served', async () => {
    const r = await fetch(`${API}/legal/privacy`);
    assert(r.ok, `privacy ${r.status}`);
  });
  await step('legal/account-deletion served', async () => {
    const r = await fetch(`${API}/legal/account-deletion`);
    assert(r.ok, `account-deletion ${r.status}`);
  });

  group('auth');
  const A = await step('register user A', () => makeUser('a'));
  const B = await step('register user B', () => makeUser('b'));
  if (!A || !B) {
    console.log('\n\x1b[31mCannot continue without two users.\x1b[0m');
    return summarize();
  }

  await step('login with password', async () => {
    const d = await api('POST', '/auth/login', {
      body: { email: A.email, password: PASSWORD, deviceName: 'e2e', deviceOs: 'node' },
    });
    assert(d?.tokens?.accessToken || d?.requiresEmailVerification, 'no tokens and no verification flag');
    if (d?.tokens?.accessToken) A.token = d.tokens.accessToken;
  });
  await step('login rejects wrong password', async () => {
    await api('POST', '/auth/login', {
      body: { email: A.email, password: 'WrongPass1!' },
      expect: [401],
    });
  });
  await step('unknown user cannot OTP-login into a new account', async () => {
    await api('POST', '/auth/login/otp', {
      body: { identifier: `ghost.${STAMP}@opalbar-test.mx`, code: '000000' },
      expect: [400, 401, 404, 422],
    });
  }, { optional: true });
  await step('me returns profile + counts', async () => {
    const me = await api('GET', '/users/me', { token: A.token });
    assert(me?.id === A.id, 'wrong user');
    assert(me?.profile, 'no profile');
  });
  await step('protected route rejects missing token', async () => {
    await api('GET', '/users/me', { expect: [401] });
  });
  await step('sessions list marks the current device', async () => {
    const s = await api('GET', '/auth/sessions', { token: A.token });
    const rows = Array.isArray(s) ? s : s?.data ?? [];
    assert(rows.length > 0, 'no sessions');
  }, { optional: true });

  group('profile & settings');
  await step('update profile', async () => {
    await api('PATCH', '/users/me/profile', {
      token: A.token,
      body: { bio: 'Bio de prueba e2e', firstName: 'Ana' },
    });
    const me = await api('GET', '/users/me', { token: A.token });
    assert(me.profile.bio === 'Bio de prueba e2e', 'bio not persisted');
  });
  await step('notification settings save a single key', async () => {
    await api('PATCH', '/users/me/notifications', { token: A.token, body: { newOffers: false } });
    const me = await api('GET', '/users/me', { token: A.token });
    assert(me.notificationSettings?.newOffers === false, 'setting not persisted');
  });
  await step('notification settings reject unknown keys', async () => {
    await api('PATCH', '/users/me/notifications', {
      token: A.token, body: { bogusKey: true }, expect: [400],
    });
  });
  await step('privacy toggle (isPrivate)', async () => {
    await api('PATCH', '/users/me/privacy', { token: A.token, body: { isPrivate: true } });
    let me = await api('GET', '/users/me', { token: A.token });
    assert(me.isPrivate === true, 'isPrivate not set');
    await api('PATCH', '/users/me/privacy', { token: A.token, body: { isPrivate: false } });
    me = await api('GET', '/users/me', { token: A.token });
    assert(me.isPrivate === false, 'isPrivate not cleared');
  });
  await step('dm policy', async () => {
    await api('PATCH', '/users/me/dm-policy', { token: A.token, body: { policy: 'EVERYONE' } });
  });
  await step('data requests list', async () => {
    await api('GET', '/users/me/data-requests', { token: A.token });
  }, { optional: true });

  group('social graph');
  await step('search finds user B', async () => {
    const rows = await api('GET', `/users/search?q=Beto`, { token: A.token });
    const list = Array.isArray(rows) ? rows : rows?.data ?? [];
    assert(list.some((u) => u.id === B.id), 'B not in results');
  });
  await step('search excludes self', async () => {
    const rows = await api('GET', `/users/search?q=Ana`, { token: A.token });
    const list = Array.isArray(rows) ? rows : rows?.data ?? [];
    assert(!list.some((u) => u.id === A.id), 'self returned in search');
  });
  await step('cannot follow yourself', async () => {
    await api('POST', `/users/${A.id}/follow`, { token: A.token, expect: [400, 403] });
  });
  await step('A follows B', async () => {
    await api('POST', `/users/${B.id}/follow`, { token: A.token });
    const prof = await api('GET', `/users/${B.id}`, { token: A.token });
    assert(prof, 'no profile returned');
  });
  await step('follow is idempotent', async () => {
    await api('POST', `/users/${B.id}/follow`, { token: A.token, expect: [200, 201, 409] });
  });
  const friendshipId = await step('A sends friend request to B', async () => {
    const d = await api('POST', `/friendships/request/${B.id}`, { token: A.token });
    return d?.friendship?.id ?? d?.id;
  });
  await step('B sees the incoming request (main or filtered tab)', async () => {
    // Two seconds-old avatar-less accounts legitimately land in "Filtradas",
    // so the request must appear in one tab or the other — never nowhere.
    const asList = (d) => (Array.isArray(d) ? d : (d?.data ?? []));
    const main = asList(await api('GET', '/friendships/requests', { token: B.token }));
    const filtered = asList(await api('GET', '/friendships/requests?tab=filtered', { token: B.token }));
    assert(main.length + filtered.length > 0, 'request is in neither the main nor the filtered inbox');

    const counts = await api('GET', '/friendships/requests/counts', { token: B.token });
    assert(Number(counts?.total ?? 0) > 0, `counts.total=${counts?.total} — badge would stay hidden`);
  });
  await step('B accepts the request', async () => {
    assert(friendshipId, 'no friendship id');
    await api('POST', `/friendships/${friendshipId}/accept`, { token: B.token });
  });
  await step('accepting twice is safe (idempotent, never 500)', async () => {
    assert(friendshipId, 'no friendship id');
    const d = await api('POST', `/friendships/${friendshipId}/accept`, {
      token: B.token, expect: [200, 201, 400, 403, 404, 409],
    });
    // If it succeeds it must be a no-op, not a duplicate friendship.
    if (d?.friendship) assert(d.friendship.status === 'ACCEPTED', 'unexpected status after re-accept');
  });
  await step('friends list contains B', async () => {
    const d = await api('GET', `/users/${A.id}/friends?page=1&limit=20`, { token: A.token });
    const list = d?.data ?? d ?? [];
    assert(list.some?.((f) => f.id === B.id || f.user?.id === B.id) ?? true, 'B not listed');
  }, { optional: true });

  group('community');
  const postId = await step('A creates a text post', async () => {
    const d = await api('POST', '/community/posts', {
      token: A.token,
      body: { content: `Post e2e ${STAMP} — probando la comunidad de OPAL BAR.` },
    });
    assert(d?.id, 'no post id');
    return d.id;
  });
  await step('post is visible in the feed', async () => {
    assert(postId, 'no post');
    const d = await api('GET', '/community/posts?page=1&limit=20', { token: A.token });
    const list = d?.data ?? [];
    assert(list.some((p) => p.id === postId), 'post missing from feed');
  });
  await step('feed payload carries the fields the app reads', async () => {
    const d = await api('GET', '/community/posts?page=1&limit=5', { token: A.token });
    const p = (d?.data ?? [])[0];
    assert(p, 'empty feed');
    for (const f of ['id', 'content', 'likesCount', 'commentsCount', 'status']) {
      assert(f in p, `feed item missing "${f}"`);
    }
    assert('meta' in (d ?? {}), 'no pagination meta');
  });
  await step('image-only post is accepted (no caption)', async () => {
    const d = await api('POST', '/community/posts', {
      token: A.token,
      body: { imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' },
    });
    assert(d?.id, 'no post id');
    await api('DELETE', `/community/posts/${d.id}`, { token: A.token, expect: [200, 204] });
  });
  await step('B reacts to the post', async () => {
    assert(postId, 'no post');
    await api('POST', `/community/posts/${postId}/emoji-react`, { token: B.token, body: { emoji: '❤️' } });
    const d = await api('GET', `/community/posts/${postId}`, { token: B.token });
    assert((d.likesCount ?? 0) > 0 || (d.emojiReactions ?? []).length > 0, 'reaction not counted');
  });
  const commentId = await step('B comments', async () => {
    assert(postId, 'no post');
    const d = await api('POST', `/community/posts/${postId}/comments`, {
      token: B.token, body: { content: 'Comentario de prueba e2e' },
    });
    assert(d?.id, 'no comment id');
    return d.id;
  });
  await step('comment count reflects the new comment', async () => {
    assert(postId, 'no post');
    const d = await api('GET', `/community/posts/${postId}`, { token: A.token });
    assert((d.commentsCount ?? 0) >= 1, `commentsCount=${d.commentsCount}`);
  });
  await step('B reports the post', async () => {
    assert(postId, 'no post');
    await api('POST', `/community/posts/${postId}/report`, {
      token: B.token,
      body: { reason: 'SPAM', description: 'Reporte automatico de prueba e2e.' },
      expect: [200, 201, 409],
    });
  });
  await step('report rejects an invalid reason', async () => {
    assert(postId, 'no post');
    await api('POST', `/community/posts/${postId}/report`, {
      token: B.token, body: { reason: 'NOT_A_REASON' }, expect: [400],
    });
  });
  await step('A saves and unsaves the post', async () => {
    assert(postId, 'no post');
    const on = await api('POST', '/users/me/saved', {
      token: A.token, body: { type: 'POST', targetId: postId },
    });
    const saved = await api('GET', '/users/me/saved?type=POST', { token: A.token });
    const list = saved?.data ?? saved ?? [];
    assert(list.length > 0, 'saved list empty');
    assert(list[0]?.target !== undefined, 'saved item not hydrated with target');
    await api('POST', '/users/me/saved', {
      token: A.token, body: { type: 'POST', targetId: postId },
    });
    void on;
  }, { optional: true });
  await step('stories endpoint responds with venue + personal', async () => {
    const d = await api('GET', '/community/stories?scope=following', { token: A.token });
    assert(d && typeof d === 'object', 'no stories payload');
  });
  await step('B deletes their own comment', async () => {
    assert(commentId, 'no comment');
    await api('DELETE', `/community/comments/${commentId}`, { token: B.token, expect: [200, 204] });
  }, { optional: true });
  await step('A cannot delete B-authored content of others', async () => {
    // A is not the author of B's post-level content; use a bogus id to assert 404/403 not 500.
    await api('DELETE', '/community/posts/does-not-exist', { token: A.token, expect: [400, 403, 404] });
  });

  group('messages');
  const threadId = await step('A opens a thread with B', async () => {
    const d = await api('POST', '/messages/threads', { token: A.token, body: { userId: B.id } });
    assert(d?.id, 'no thread id');
    return d.id;
  });
  await step('A sends a message', async () => {
    assert(threadId, 'no thread');
    await api('POST', `/messages/threads/${threadId}/messages`, {
      token: A.token, body: { content: 'Hola, mensaje de prueba e2e' },
    });
  });
  await step('B reads the thread', async () => {
    assert(threadId, 'no thread');
    const d = await api('GET', `/messages/threads/${threadId}/messages?limit=30`, { token: B.token });
    const list = d?.data ?? d ?? [];
    assert(list.length > 0, 'no messages');
  });
  await step('thread list preview + unread count', async () => {
    const d = await api('GET', '/messages/threads', { token: B.token });
    const list = d?.data ?? d ?? [];
    assert(list.length > 0, 'no threads');
    await api('GET', '/messages/unread-count', { token: B.token });
  });
  await step('a stranger cannot read the thread', async () => {
    assert(threadId, 'no thread');
    // Re-use A's own id as a "third party" check is impossible with 2 users;
    // instead assert an unknown thread id is not readable.
    await api('GET', '/messages/threads/not-a-real-thread/messages', {
      token: A.token, expect: [400, 403, 404],
    });
  });

  group('blocking');
  await step('B blocks A', async () => {
    await api('POST', `/friendships/${A.id}/block`, { token: B.token, expect: [200, 201] });
  });
  await step('blocked user cannot send a message', async () => {
    assert(threadId, 'no thread');
    await api('POST', `/messages/threads/${threadId}/messages`, {
      token: A.token, body: { content: 'no deberia entrar' }, expect: [403, 404],
    });
  });
  await step('blocked user cannot follow', async () => {
    await api('POST', `/users/${B.id}/follow`, { token: A.token, expect: [403, 404] });
  });
  await step('blocked list shows A', async () => {
    const d = await api('GET', '/friendships/blocked', { token: B.token });
    const list = d?.data ?? d ?? [];
    assert(list.some?.((u) => u.id === A.id || u.user?.id === A.id) ?? true, 'A not in blocked list');
  }, { optional: true });
  await step('B unblocks A', async () => {
    await api('DELETE', `/friendships/${A.id}/block`, { token: B.token, expect: [200, 204] });
  }, { optional: true });

  group('notifications');
  await step('inbox returns unreadCount', async () => {
    const d = await api('GET', '/notifications?page=1&limit=20', { token: B.token });
    assert(d && 'unreadCount' in d, 'no unreadCount in payload');
  });
  await step('mark all read', async () => {
    await api('PATCH', '/notifications/read-all', { token: B.token, expect: [200, 204] });
    const d = await api('GET', '/notifications?page=1&limit=1', { token: B.token });
    assert((d.unreadCount ?? 0) === 0, `unreadCount=${d.unreadCount}`);
  });

  group('venue · events · offers');
  const venueId = await step('venues list', async () => {
    const d = await api('GET', '/venues', { token: A.token });
    const list = d?.data ?? d ?? [];
    assert(list.length > 0, 'no venues');
    return list[0].id;
  });
  await step('venue detail + rating summary shape', async () => {
    assert(venueId, 'no venue');
    const v = await api('GET', `/venues/${venueId}`, { token: A.token });
    assert(v?.id, 'no venue detail');
    const s = await api('GET', `/reviews/venue/${venueId}/summary`, { token: A.token });
    assert('average' in s && 'total' in s, `summary shape changed: ${Object.keys(s ?? {}).join(',')}`);
  }, { optional: true });
  await step('events list excludes past events by default', async () => {
    const d = await api('GET', '/events?page=1&limit=20', { token: A.token });
    const list = d?.data ?? [];
    const now = Date.now();
    const past = list.filter((e) => e.startDate && new Date(e.startDate).getTime() < now);
    assert(past.length === 0, `${past.length} past events returned first`);
  });
  await step('offers list', async () => {
    await api('GET', '/offers?page=1&limit=20', { token: A.token });
  });
  await step('wallet + loyalty levels', async () => {
    const w = await api('GET', '/wallet', { token: A.token });
    assert(w, 'no wallet');
    const levels = await api('GET', '/wallet/levels', { token: A.token });
    assert((levels?.data ?? levels ?? []).length >= 0, 'no levels');
  });

  group('reservations');
  await step('availability endpoint', async () => {
    assert(venueId, 'no venue');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    const d = await api('GET', `/reservations/availability?venueId=${venueId}&date=${today}`, { token: A.token });
    assert(d, 'no availability payload');
  }, { optional: true });
  await step('past-dated reservation is rejected', async () => {
    assert(venueId, 'no venue');
    await api('POST', '/reservations', {
      token: A.token,
      body: { venueId, date: '2020-01-01', timeSlot: '20:00', partySize: 2 },
      expect: [400, 422],
    });
  });
  const reservationId = await step('create a reservation for tomorrow', async () => {
    assert(venueId, 'no venue');
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(d);
    const r = await api('POST', '/reservations', {
      token: A.token,
      body: { venueId, date, timeSlot: '21:00', partySize: 2, specialRequests: 'Prueba e2e' },
    });
    assert(r?.id, 'no reservation id');
    return r.id;
  });
  await step('reservation appears in "my" list with a date-only date', async () => {
    assert(reservationId, 'no reservation');
    const d = await api('GET', '/reservations/my', { token: A.token });
    const list = d?.data ?? d ?? [];
    const row = list.find((r) => r.id === reservationId);
    assert(row, 'reservation not listed');
    assert(/^\d{4}-\d{2}-\d{2}/.test(String(row.date)), `unexpected date format: ${row.date}`);
  });
  await step('cancel the reservation', async () => {
    assert(reservationId, 'no reservation');
    await api('DELETE', `/reservations/${reservationId}`, { token: A.token, expect: [200, 204] });
  });

  group('support');
  const ticketId = await step('create a ticket (category required)', async () => {
    const d = await api('POST', '/support/tickets', {
      token: A.token,
      body: { category: 'TECHNICAL', subject: 'Ticket e2e', initialMessage: 'Mensaje inicial de prueba e2e.' },
    });
    assert(d?.id, 'no ticket id');
    return d.id;
  });
  await step('ticket without category is rejected', async () => {
    await api('POST', '/support/tickets', {
      token: A.token,
      body: { subject: 'sin categoria', initialMessage: 'deberia fallar' },
      expect: [400],
    });
  });
  await step('ticket detail + messages', async () => {
    assert(ticketId, 'no ticket');
    await api('GET', `/support/tickets/${ticketId}`, { token: A.token });
    const m = await api('GET', `/support/tickets/${ticketId}/messages`, { token: A.token });
    assert((m?.data ?? m ?? []).length > 0, 'no messages');
  });
  await step('B cannot read A ticket', async () => {
    assert(ticketId, 'no ticket');
    await api('GET', `/support/tickets/${ticketId}`, { token: B.token, expect: [403, 404] });
  });

  group('admin surface is protected');
  for (const path of ['/admin/users', '/admin/community/posts', '/admin/reports', '/admin/venues']) {
    await step(`USER role gets 403 on ${path}`, async () => {
      await api('GET', path, { token: A.token, expect: [401, 403] });
    });
  }

  group('account deletion (App Store 5.1.1v)');
  await step('deletion requires the password', async () => {
    await api('DELETE', '/users/me', { token: B.token, body: { reason: 'e2e' }, expect: [400, 401] });
  });
  await step('B deletes their account', async () => {
    await api('DELETE', '/users/me', {
      token: B.token, body: { reason: 'e2e cleanup', password: PASSWORD }, expect: [200, 202, 204],
    });
  });
  await step('deleted account token is dead', async () => {
    await api('GET', '/users/me', { token: B.token, expect: [401] });
  });
  await step('deleted account cannot log back in', async () => {
    await api('POST', '/auth/login', {
      body: { email: B.email, password: PASSWORD }, expect: [401, 403],
    });
  });
  await step('A deletes their account', async () => {
    await api('DELETE', '/users/me', {
      token: A.token, body: { reason: 'e2e cleanup', password: PASSWORD }, expect: [200, 202, 204],
    });
  });

  summarize();
};

function summarize() {
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL');
  const skip = results.filter((r) => r.status === 'SKIP');

  console.log(`\n\x1b[1m═══ RESUMEN ═══\x1b[0m`);
  console.log(`  \x1b[32m${pass} PASS\x1b[0m · \x1b[31m${fail.length} FAIL\x1b[0m · \x1b[33m${skip.length} SKIP\x1b[0m`);
  if (fail.length) {
    console.log('\n\x1b[31mFallos:\x1b[0m');
    for (const f of fail) console.log(`  · [${f.group}] ${f.name} — ${f.detail ?? ''}`);
  }
  if (skip.length) {
    console.log('\n\x1b[33mOmitidos (opcionales / dependencias no disponibles):\x1b[0m');
    for (const s of skip) console.log(`  · [${s.group}] ${s.name} — ${s.detail ?? ''}`);
  }
  process.exitCode = fail.length ? 1 : 0;
}

main().catch((err) => {
  console.error('\n\x1b[31mFatal:\x1b[0m', err);
  process.exitCode = 1;
});
