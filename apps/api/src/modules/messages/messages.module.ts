import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesAdminController } from './messages-admin.controller';
import { MessagesGateway } from './messages.gateway';

@Module({
  imports: [
    // JwtService is used by the gateway for websocket auth
    JwtModule.register({}),
  ],
  controllers: [MessagesController, MessagesAdminController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesService],
})
export class MessagesModule {}
