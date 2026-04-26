import { Module } from '@nestjs/common';
import { CommunityService } from './community.service';
import { AdminCommunityController, CommunityController } from './community.controller';
import { CommunityGateway } from './community.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { MentionsModule } from '../mentions/mentions.module';

@Module({
	imports: [NotificationsModule, MentionsModule],
	controllers: [CommunityController, AdminCommunityController],
	providers: [CommunityService, CommunityGateway],
	exports: [CommunityService, CommunityGateway],
})
export class CommunityModule {}
