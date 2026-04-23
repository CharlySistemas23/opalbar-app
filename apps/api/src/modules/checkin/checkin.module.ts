import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
