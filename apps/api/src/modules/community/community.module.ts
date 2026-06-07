import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CommunityService } from './community.service';
import { AdminCommunityController, CommunityController } from './community.controller';
import { CommunityGateway } from './community.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { MentionsModule } from '../mentions/mentions.module';

@Module({
	// JwtModule.register({}) is required so CommunityGateway can verify tokens
	// on websocket handshake (audit P0 #4 — gateway was previously unauthenticated).
	imports: [JwtModule.register({}), NotificationsModule, MentionsModule],
	controllers: [CommunityController, AdminCommunityController],
	providers: [CommunityService, CommunityGateway],
	exports: [CommunityService, CommunityGateway],
})
export class CommunityModule {}
