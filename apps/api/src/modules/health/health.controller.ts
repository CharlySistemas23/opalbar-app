// ─────────────────────────────────────────────
//  Health Controller
//  · GET /health        → liveness (fast, used by Railway healthcheck)
//  · GET /health/ready  → readiness (DB + Redis + FCM reachability)
// ─────────────────────────────────────────────
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

interface ServiceCheck {
  status: 'ok' | 'degraded' | 'error' | 'skipped';
  latencyMs?: number;
  error?: string;
}

const VERSION = process.env['npm_package_version'] || '1.0.0';
const STARTED_AT = Date.now();

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness — fast 200 if API process is running' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: VERSION,
      uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness — checks DB, Redis, FCM reachability' })
  async readiness() {
    const [database, redis, fcm] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkFcm(),
    ]);

    const checks = [database, redis, fcm];
    const hasError = checks.some((c) => c.status === 'error');
    const hasDegraded = checks.some((c) => c.status === 'degraded');
    const status = hasError ? 'error' : hasDegraded ? 'degraded' : 'ok';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: VERSION,
      uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
      services: {
        api: { status: 'ok' } as ServiceCheck,
        database,
        redis,
        fcm,
      },
    };
  }

  private async checkDatabase(): Promise<ServiceCheck> {
    const start = Date.now();
    try {
      const ok = await this.prisma.ping();
      return ok
        ? { status: 'ok', latencyMs: Date.now() - start }
        : { status: 'error', latencyMs: Date.now() - start, error: 'ping returned false' };
    } catch (err: unknown) {
      return { status: 'error', latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<ServiceCheck> {
    const start = Date.now();
    try {
      const ok = await this.redis.ping();
      return ok
        ? { status: 'ok', latencyMs: Date.now() - start }
        : { status: 'degraded', latencyMs: Date.now() - start, error: 'ping returned false' };
    } catch (err: unknown) {
      return { status: 'degraded', latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  // FCM check — verify Firebase domain is reachable. Cheap HEAD with 3s timeout.
  // Skipped when no FCM_SERVER_KEY is set (local dev). Marked 'degraded' on
  // failure (not 'error') because push delivery is async and the API can still
  // serve all other endpoints.
  private async checkFcm(): Promise<ServiceCheck> {
    if (!process.env['FCM_SERVER_KEY']) {
      return { status: 'skipped' };
    }
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('https://fcm.googleapis.com/', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.status < 500
        ? { status: 'ok', latencyMs: Date.now() - start }
        : { status: 'degraded', latencyMs: Date.now() - start, error: `fcm returned ${res.status}` };
    } catch (err: unknown) {
      return { status: 'degraded', latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
