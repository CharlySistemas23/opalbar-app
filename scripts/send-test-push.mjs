// One-shot: pull the user's Expo push tokens from prod DB and fire a test.
// Usage: DATABASE_URL=... EMAIL=carlosalonsog966@gmail.com node scripts/send-test-push.mjs
import pg from 'pg';

const email = process.env.EMAIL;
const dbUrl = process.env.DATABASE_URL;
if (!email || !dbUrl) {
  console.error('EMAIL and DATABASE_URL env vars required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

const u = await client.query(
  `SELECT u.id, p."firstName" || ' ' || p."lastName" AS name FROM "User" u LEFT JOIN "UserProfile" p ON p."userId" = u.id WHERE u.email = $1`,
  [email],
);
if (u.rowCount === 0) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}
const user = u.rows[0];
console.log(`→ user: ${user.name ?? '(no name)'} (${user.id})`);

const t = await client.query(
  'SELECT token, platform, "updatedAt" FROM "PushToken" WHERE "userId" = $1',
  [user.id],
);
console.log(`→ found ${t.rowCount} push token(s)`);
if (t.rowCount === 0) {
  console.error('  user has NO push tokens registered — abrir la app y aceptar permiso de notificaciones.');
  await client.end();
  process.exit(1);
}

for (const r of t.rows) {
  console.log(`  · ${r.platform}  ${r.token.slice(0, 28)}…  updated ${new Date(r.updatedAt).toISOString()}`);
}

const payload = t.rows.map((r) => ({
  to: r.token,
  sound: 'default',
  title: 'OPAL BAR — test',
  body: 'Si lees esto, las notificaciones están funcionando ✅',
  data: { test: true },
}));

const res = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(payload),
});

const body = await res.json();
console.log(`\nExpo response (${res.status}):`);
console.log(JSON.stringify(body, null, 2));

await client.end();
