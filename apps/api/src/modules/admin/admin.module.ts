import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ReservationsModule } from '../reservations/reservations.module';
import { SupportService } from '../support/support.service';
import { ReviewsService } from '../reviews/reviews.service';
import { PushModule } from '../push/push.module';
import { CommunityModule } from '../community/community.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ReservationsModule, PushModule, CommunityModule, NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService, SupportService, ReviewsService],
})
export class AdminModule {}
