import { Module } from '@nestjs/common';
import { CommunityService } from './community.service';
import { AdminCommunityController, CommunityController } from './community.controller';
import { CommunityGateway } from './community.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
	imports: [NotificationsModule],
	controllers: [CommunityController, AdminCommunityController],
	providers: [CommunityService, CommunityGateway],
	exports: [CommunityService],
})
export class CommunityModule {}
