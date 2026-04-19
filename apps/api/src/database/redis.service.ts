// ─────────────────────────────────────────────
//  RedisService — ioredis wrapper for NestJS
// ─────────────────────────────────────────────
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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

    this.client.on('connect', () => this.logger.log('✅ Redis connected'));
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
