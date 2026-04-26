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
import { ReservationsModule } from '../modules/reservations/reservations.module';
import { SupportModule } from '../modules/support/support.module';
import { ContentMonitorModule } from '../modules/content-monitor/content-monitor.module';
import { ReviewsModule } from '../modules/reviews/reviews.module';
import { MessagesModule } from '../modules/messages/messages.module';
import { FriendshipsModule } from '../modules/friendships/friendships.module';
import { CheckinModule } from '../modules/checkin/checkin.module';
import { VenuesModule } from '../modules/venues/venues.module';
import { PushModule } from '../modules/push/push.module';
import { MarketingModule } from '../modules/marketing/marketing.module';
import { RealtimeModule } from '../modules/realtime/realtime.module';

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
    // Skip throttling entirely in development mode (infinite limit = disabled)
    // In production, stricter limits apply
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: process.env.NODE_ENV === 'development' ? 999999 : 1200,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: process.env.NODE_ENV === 'development' ? 999999 : 30,
      },
      {
        name: 'otp',
        ttl: 300000,
        limit: 5,
      },
    ]),

    // ── Database ──────────────────────────────
    PrismaModule,
    RedisModule,
    RealtimeModule,

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
    ReservationsModule,
    SupportModule,
    ContentMonitorModule,
    ReviewsModule,
    MessagesModule,
    FriendshipsModule,
    CheckinModule,
    VenuesModule,
    PushModule,
    MarketingModule,
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
    // Throttle Guard DISABLED in development to allow unlimited testing
    // Re-enable in production by uncommenting the line below
    // { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
