import { Module } from '@nestjs/common';
import {
  AdminMarketingController,
  EmailPublicController,
} from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  controllers: [AdminMarketingController, EmailPublicController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
