import { Module } from '@nestjs/common';
import { ContentMonitorService } from './content-monitor.service';
import { ContentMonitorController } from './content-monitor.controller';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule],
  controllers: [ContentMonitorController],
  providers: [ContentMonitorService],
  exports: [ContentMonitorService],
})
export class ContentMonitorModule {}
