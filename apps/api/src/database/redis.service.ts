// ─────────────────────────────────────────────
//  RedisService — ioredis wrapper for NestJS
// ─────────────────────────────────────────────
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Thrown when `withLock` cannot acquire the lock. Callers translate to 409. */
export class LockBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockBusyError';
  }
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('redis.host', 'localhost');
    const port = this.config.get<number>('redis.port', 6379);
    const password = this.config.get<string>('redis.password');
    const db = this.config.get<number>('redis.db', 0);

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });

    this.client.on('connect', () => this.logger.log('[REDIS] Connected'));
    this.client.on('error', (err) => this.logger.error('Redis error:', err));
    this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting…'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  // ── Basic Operations ─────────────────────────

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  // ── JSON helpers ─────────────────────────────

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.set(key, serialized, ttlSeconds);
  }

  // ── Increment / Decrement (rate limiting) ────

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrBy(key: string, value: number): Promise<number> {
    return this.client.incrby(key, value);
  }

  // ── Set operations ───────────────────────────

  async sadd(key: string, ...members: string[]): Promise<void> {
    await this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    await this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  // ── Hash operations ──────────────────────────

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  // ── Key patterns ─────────────────────────────

  /** OTP keys */
  static otpKey(identifier: string, type: string): string {
    return `otp:${type}:${identifier}`;
  }

  /** OTP attempt counter key */
  static otpAttemptsKey(identifier: string, type: string): string {
    return `otp_attempts:${type}:${identifier}`;
  }

  /** Rate limit key */
  static rateLimitKey(prefix: string, identifier: string): string {
    return `rate_limit:${prefix}:${identifier}`;
  }

  /** Session blocklist key */
  static sessionBlocklistKey(jti: string): string {
    return `session_blocklist:${jti}`;
  }

  /** User sessions set key */
  static userSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  // ── Cache helpers ────────────────────────────

  /** Build a cache key with a namespace prefix. e.g. cache:events:list:{hash} */
  static cacheKey(namespace: string, ...parts: (string | number | undefined | null)[]): string {
    const tail = parts.filter((p) => p !== undefined && p !== null).join(':');
    return `cache:${namespace}${tail ? ':' + tail : ''}`;
  }

  /**
   * Try cache; on miss run loader, store with TTL, return.
   * Use for read-heavy public endpoints (event list, offer list, venue detail).
   */
  async cacheWrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null && cached !== undefined) return cached as T;
    const fresh = await loader();
    await this.setJson(key, fresh, ttlSeconds);
    return fresh;
  }

  /**
   * Delete all keys matching a glob pattern via SCAN (non-blocking).
   * Call after mutations to invalidate public caches.
   * e.g. await redis.cacheDelPattern('cache:events:*') after creating an event.
   */
  async cacheDelPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        await this.client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    return deleted;
  }

  // ── Distributed lock (SETNX) ────────────────

  /**
   * Run `fn` while holding an exclusive lock on `key`.
   * Prevents race conditions when multiple requests mutate the same resource
   * (e.g. two users redeeming the last offer stock simultaneously).
   *
   * Throws LockBusyError if the lock is already held. Callers should translate
   * that into a 409 Conflict response.
   */
  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const lockKey = `lock:${key}`;
    const token = Math.random().toString(36).slice(2);
    const acquired = await this.client.set(lockKey, token, 'EX', ttlSeconds, 'NX');
    if (acquired !== 'OK') {
      throw new LockBusyError(`Lock busy: ${key}`);
    }
    try {
      return await fn();
    } finally {
      // Only delete if token matches (avoid deleting someone else's lock after expiry)
      const current = await this.client.get(lockKey);
      if (current === token) await this.client.del(lockKey);
    }
  }

  // ── Health ───────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
