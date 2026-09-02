#!/usr/bin/env node
/**
 * dev-redis.mjs — tiny in-memory Redis for LOCAL testing only.
 *
 * The dev machine has no Redis (no Docker, no WSL, no Memurai) but the API
 * needs one for OTP codes, rate limits, session blocklists, caches and the
 * redemption lock. This implements just the RESP subset `RedisService` uses:
 *
 *   PING GET SET(EX/PX/NX/XX) SETEX DEL EXISTS EXPIRE TTL INCR INCRBY
 *   HSET HGET HDEL SADD SREM SMEMBERS SCAN EVAL(compare-and-del) QUIT
 *   plus the INFO / COMMAND / CLIENT / SELECT handshake ioredis performs.
 *
 * NOT a Redis replacement: no persistence, no clustering, single client
 * semantics, and EVAL only recognises the one Lua script the app ships.
 *
 *   node apps/api/scripts/dev-redis.mjs [port]
 */
import net from 'node:net';

const PORT = Number(process.argv[2] ?? 6379);

/** key → { value, type, expiresAt|null } */
const store = new Map();

function now() { return Date.now(); }

function live(key) {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expiresAt !== null && e.expiresAt <= now()) {
    store.delete(key);
    return undefined;
  }
  return e;
}

// ── RESP encoding ────────────────────────────
const CRLF = '\r\n';
const enc = {
  simple: (s) => `+${s}${CRLF}`,
  error: (s) => `-ERR ${s}${CRLF}`,
  int: (n) => `:${n}${CRLF}`,
  bulk: (s) => (s === null || s === undefined ? `$-1${CRLF}` : `$${Buffer.byteLength(String(s))}${CRLF}${s}${CRLF}`),
  array: (items) => `*${items.length}${CRLF}${items.join('')}`,
};

// ── RESP request parser (clients always send arrays of bulk strings) ──
function parseRequests(buffer) {
  const out = [];
  let offset = 0;

  while (offset < buffer.length) {
    const start = offset;
    if (buffer[offset] !== 0x2a /* '*' */) {
      // Inline command (redis-cli style); read one line.
      const nl = buffer.indexOf('\n', offset);
      if (nl === -1) break;
      const line = buffer.toString('utf8', offset, nl).trim();
      offset = nl + 1;
      if (line) out.push(line.split(/\s+/));
      continue;
    }
    const headerEnd = buffer.indexOf('\r\n', offset);
    if (headerEnd === -1) break;
    const count = Number(buffer.toString('utf8', offset + 1, headerEnd));
    offset = headerEnd + 2;

    const args = [];
    let incomplete = false;
    for (let i = 0; i < count; i++) {
      if (offset >= buffer.length || buffer[offset] !== 0x24 /* '$' */) { incomplete = true; break; }
      const lenEnd = buffer.indexOf('\r\n', offset);
      if (lenEnd === -1) { incomplete = true; break; }
      const len = Number(buffer.toString('utf8', offset + 1, lenEnd));
      const valStart = lenEnd + 2;
      const valEnd = valStart + len;
      if (buffer.length < valEnd + 2) { incomplete = true; break; }
      args.push(buffer.toString('utf8', valStart, valEnd));
      offset = valEnd + 2;
    }
    if (incomplete) { offset = start; break; }
    out.push(args);
  }
  return { requests: out, rest: buffer.subarray(offset) };
}

// ── Command implementations ──────────────────
function cmdSet(args) {
  const [key, value, ...opts] = args;
  let ttlMs = null;
  let nx = false;
  let xx = false;
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i].toUpperCase();
    if (o === 'EX') ttlMs = Number(opts[++i]) * 1000;
    else if (o === 'PX') ttlMs = Number(opts[++i]);
    else if (o === 'NX') nx = true;
    else if (o === 'XX') xx = true;
  }
  const existing = live(key);
  if (nx && existing) return enc.bulk(null);
  if (xx && !existing) return enc.bulk(null);
  store.set(key, { value: String(value), type: 'string', expiresAt: ttlMs ? now() + ttlMs : null });
  return enc.simple('OK');
}

function asHash(key) {
  const e = live(key);
  if (e && e.type === 'hash') return e;
  if (e) return null;
  const fresh = { value: new Map(), type: 'hash', expiresAt: null };
  store.set(key, fresh);
  return fresh;
}

function asSet(key) {
  const e = live(key);
  if (e && e.type === 'set') return e;
  if (e) return null;
  const fresh = { value: new Set(), type: 'set', expiresAt: null };
  store.set(key, fresh);
  return fresh;
}

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function handle(args) {
  if (!args.length) return enc.error('empty command');
  const cmd = args[0].toUpperCase();
  const a = args.slice(1);

  switch (cmd) {
    case 'PING': return a.length ? enc.bulk(a[0]) : enc.simple('PONG');
    case 'QUIT': return enc.simple('OK');
    case 'SELECT': case 'CLIENT': case 'HELLO': case 'AUTH': return enc.simple('OK');
    case 'COMMAND': return enc.array([]);
    case 'INFO': return enc.bulk('# Server\nredis_version:7.0.0-devstub\n');

    case 'GET': {
      const e = live(a[0]);
      if (!e) return enc.bulk(null);
      if (e.type !== 'string') return enc.error('WRONGTYPE');
      return enc.bulk(e.value);
    }
    case 'SET': return cmdSet(a);
    case 'SETEX': {
      store.set(a[0], { value: String(a[2]), type: 'string', expiresAt: now() + Number(a[1]) * 1000 });
      return enc.simple('OK');
    }
    case 'DEL': {
      let n = 0;
      for (const k of a) if (store.delete(k)) n++;
      return enc.int(n);
    }
    case 'EXISTS': {
      let n = 0;
      for (const k of a) if (live(k)) n++;
      return enc.int(n);
    }
    case 'EXPIRE': {
      const e = live(a[0]);
      if (!e) return enc.int(0);
      e.expiresAt = now() + Number(a[1]) * 1000;
      return enc.int(1);
    }
    case 'TTL': {
      const e = live(a[0]);
      if (!e) return enc.int(-2);
      if (e.expiresAt === null) return enc.int(-1);
      return enc.int(Math.max(0, Math.ceil((e.expiresAt - now()) / 1000)));
    }
    case 'INCR': case 'INCRBY': {
      const by = cmd === 'INCR' ? 1 : Number(a[1]);
      const e = live(a[0]);
      const next = (e ? Number(e.value) : 0) + by;
      store.set(a[0], { value: String(next), type: 'string', expiresAt: e?.expiresAt ?? null });
      return enc.int(next);
    }

    case 'HSET': {
      const h = asHash(a[0]);
      if (!h) return enc.error('WRONGTYPE');
      let added = 0;
      for (let i = 1; i < a.length; i += 2) {
        if (!h.value.has(a[i])) added++;
        h.value.set(a[i], a[i + 1]);
      }
      return enc.int(added);
    }
    case 'HGET': {
      const e = live(a[0]);
      if (!e || e.type !== 'hash') return enc.bulk(null);
      return enc.bulk(e.value.get(a[1]) ?? null);
    }
    case 'HDEL': {
      const e = live(a[0]);
      if (!e || e.type !== 'hash') return enc.int(0);
      let n = 0;
      for (const f of a.slice(1)) if (e.value.delete(f)) n++;
      return enc.int(n);
    }

    case 'SADD': {
      const s = asSet(a[0]);
      if (!s) return enc.error('WRONGTYPE');
      let n = 0;
      for (const m of a.slice(1)) if (!s.value.has(m)) { s.value.add(m); n++; }
      return enc.int(n);
    }
    case 'SREM': {
      const e = live(a[0]);
      if (!e || e.type !== 'set') return enc.int(0);
      let n = 0;
      for (const m of a.slice(1)) if (e.value.delete(m)) n++;
      return enc.int(n);
    }
    case 'SMEMBERS': {
      const e = live(a[0]);
      if (!e || e.type !== 'set') return enc.array([]);
      return enc.array([...e.value].map((m) => enc.bulk(m)));
    }

    case 'KEYS': {
      const re = globToRegex(a[0] ?? '*');
      const keys = [...store.keys()].filter((k) => live(k) && re.test(k));
      return enc.array(keys.map((k) => enc.bulk(k)));
    }
    case 'SCAN': {
      // Single-shot cursor: return everything, then cursor 0.
      let match = '*';
      for (let i = 1; i < a.length; i++) {
        if (a[i].toUpperCase() === 'MATCH') match = a[i + 1];
      }
      const re = globToRegex(match);
      const keys = [...store.keys()].filter((k) => live(k) && re.test(k));
      return enc.array([enc.bulk('0'), enc.array(keys.map((k) => enc.bulk(k)))]);
    }

    case 'EVAL': {
      // Only the compare-and-delete lock release script is supported.
      const script = a[0] ?? '';
      const numKeys = Number(a[1] ?? 0);
      const keys = a.slice(2, 2 + numKeys);
      const argv = a.slice(2 + numKeys);
      if (/get.*==.*del/is.test(script)) {
        const e = live(keys[0]);
        if (e && e.value === argv[0]) {
          store.delete(keys[0]);
          return enc.int(1);
        }
        return enc.int(0);
      }
      return enc.error(`unsupported script in dev-redis: ${script.slice(0, 60)}`);
    }

    case 'FLUSHALL': case 'FLUSHDB': store.clear(); return enc.simple('OK');
    case 'DBSIZE': return enc.int(store.size);

    default:
      return enc.error(`unknown command '${cmd}' (dev-redis stub)`);
  }
}

const server = net.createServer((socket) => {
  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const { requests, rest } = parseRequests(buffer);
    buffer = rest;
    for (const req of requests) {
      let reply;
      try {
        reply = handle(req);
      } catch (err) {
        reply = enc.error(String(err?.message ?? err));
      }
      socket.write(reply);
      if (req[0]?.toUpperCase() === 'QUIT') socket.end();
    }
  });
  socket.on('error', () => { /* client went away */ });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-redis] in-memory Redis stub listening on 127.0.0.1:${PORT}`);
});
