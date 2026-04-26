import { Module } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { MentionsController } from './mentions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { FriendshipsModule } from '../friendships/friendships.module';

@Module({
  imports: [NotificationsModule, FriendshipsModule],
  controllers: [MentionsController],
  providers: [MentionsService],
  exports: [MentionsService],
})
export class MentionsModule {}
