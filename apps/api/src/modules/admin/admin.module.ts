import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { GdprDownloadController } from './gdpr-download.controller';
import { ReservationsModule } from '../reservations/reservations.module';
import { SupportService } from '../support/support.service';
import { ReviewsService } from '../reviews/reviews.service';
import { PushModule } from '../push/push.module';
import { CommunityModule } from '../community/community.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [ReservationsModule, PushModule, CommunityModule, NotificationsModule, OtpModule],
  controllers: [AdminController, GdprDownloadController],
  providers: [AdminService, SupportService, ReviewsService],
  exports: [AdminService],
})
export class AdminModule {}
