import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { PushModule } from '../push/push.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PushModule, WalletModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
