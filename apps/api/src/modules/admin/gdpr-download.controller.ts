import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AdminService } from './admin.service';

@ApiTags('GDPR')
@Controller('users/me/export')
export class GdprDownloadController {
  constructor(private readonly adminService: AdminService) {}

  @Get('download/:id')
  @Public()
  @SkipThrottle()
  @Header('Content-Type', 'application/json; charset=utf-8')
  @ApiOperation({ summary: 'Public signed download for a completed GDPR export bundle' })
  async download(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const payload = await this.adminService.fetchExportPayload(id, token ?? '');
    res.setHeader('Content-Disposition', `attachment; filename="opalbar-export-${id}.json"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(JSON.stringify(payload, null, 2));
  }
}
