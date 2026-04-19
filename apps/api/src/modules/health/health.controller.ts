import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check — returns status of all services' })
  async check() {
    const [db, cache] = await Promise.all([
      this.prisma.ping(),
      this.redis.ping(),
    ]);

    const status = db && cache ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] || '1.0.0',
      services: {
        api: 'ok',
        database: db ? 'ok' : 'error',
        redis: cache ? 'ok' : 'error',
      },
    };
  }
}
