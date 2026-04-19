// ─────────────────────────────────────────────
//  AppModule — raíz de la aplicación NestJS
// ─────────────────────────────────────────────
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Config
import configuration from '../config/configuration';
import { validationSchema } from '../config/validation.schema';

// Database
import { PrismaModule } from '../database/prisma.module';
import { RedisModule } from '../database/redis.module';

// Common
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// Feature Modules
import { AuthModule } from '../modules/auth/auth.module';
import { OtpModule } from '../modules/otp/otp.module';
import { UsersModule } from '../modules/users/users.module';
import { EventsModule } from '../modules/events/events.module';
import { OffersModule } from '../modules/offers/offers.module';
import { CommunityModule } from '../modules/community/community.module';
import { WalletModule } from '../modules/wallet/wallet.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { AdminModule } from '../modules/admin/admin.module';
import { HealthModule } from '../modules/health/health.module';

@Module({
  imports: [
    // ── Config ────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),

    // ── Rate Limiting ─────────────────────────
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 10 },
      { name: 'otp', ttl: 300000, limit: 3 },
    ]),

    // ── Database ──────────────────────────────
    PrismaModule,
    RedisModule,

    // ── Feature Modules ───────────────────────
    AuthModule,
    OtpModule,
    UsersModule,
    EventsModule,
    OffersModule,
    CommunityModule,
    WalletModule,
    NotificationsModule,
    AdminModule,
    HealthModule,
  ],

  providers: [
    // Global exception filter
    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    // Global interceptors (order matters: logging first, then transform)
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },

    // Global guards (JWT on all routes — @Public() to bypass)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
