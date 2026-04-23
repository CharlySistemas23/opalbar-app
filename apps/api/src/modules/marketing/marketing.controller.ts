// ─────────────────────────────────────────────
//  MarketingController
//  · Admin-only routes under /admin/marketing — mounted from mobile wizard
//  · Public routes under /email for open-tracking pixel + unsubscribe
// ─────────────────────────────────────────────
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AudienceCountDto,
  CreateCampaignDto,
  RenderPreviewDto,
  UploadAssetDto,
} from './dto/marketing.dto';
import { MarketingService } from './marketing.service';

// 1×1 transparent GIF — universal open-tracking pixel
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@ApiTags('Admin Marketing')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
@SkipThrottle()
@Controller('admin/marketing')
export class AdminMarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('templates')
  @ApiOperation({ summary: 'List email templates available to admins' })
  listTemplates() {
    return this.marketing.listTemplates();
  }

  @Post('preview')
  @ApiOperation({ summary: 'Render HTML + text preview for a draft' })
  preview(@Body() dto: RenderPreviewDto) {
    return this.marketing.renderPreview(dto);
  }

  @Post('audience-count')
  @ApiOperation({ summary: 'Count recipients for a segment + return sample users' })
  audienceCount(@Body() dto: AudienceCountDto) {
    return this.marketing.countAudience(dto);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List recent campaigns with stats' })
  listCampaigns() {
    return this.marketing.listCampaigns();
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create a campaign (DRAFT or SCHEDULED)' })
  createCampaign(@CurrentUser() admin: User, @Body() dto: CreateCampaignDto) {
    return this.marketing.createCampaign(dto, admin.id);
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Campaign detail + open rate + recent opens/unsubs' })
  getCampaign(@Param('id') id: string) {
    return this.marketing.getCampaign(id);
  }

  @Post('campaigns/:id/send')
  @ApiOperation({ summary: 'Trigger send now (runs in background)' })
  sendNow(@Param('id') id: string) {
    return this.marketing.sendCampaignNow(id);
  }

  @Patch('campaigns/:id/cancel')
  @ApiOperation({ summary: 'Cancel a DRAFT or SCHEDULED campaign' })
  cancel(@Param('id') id: string) {
    return this.marketing.cancelCampaign(id);
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Delete a campaign (cascades recipients)' })
  deleteCampaign(@Param('id') id: string) {
    return this.marketing.deleteCampaign(id);
  }

  @Post('assets')
  @ApiOperation({ summary: 'Upload hero image as data URI; returns public URL' })
  uploadAsset(@CurrentUser() admin: User, @Body() dto: UploadAssetDto) {
    return this.marketing.uploadAsset(dto, admin.id);
  }
}

@ApiTags('Email')
@Controller('email')
export class EmailPublicController {
  constructor(private readonly marketing: MarketingService) {}

  @Public()
  @Get('track/open/:recipientId.gif')
  @ApiOperation({ summary: 'Open-tracking pixel (1×1 gif)' })
  async trackOpen(
    @Param('recipientId') recipientId: string,
    @Res() res: Response,
  ) {
    // Record asynchronously; always respond with the pixel regardless.
    this.marketing.markOpened(recipientId).catch(() => undefined);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', PIXEL_GIF.length.toString());
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.end(PIXEL_GIF);
  }

  @Public()
  @Get('asset/:id')
  @ApiOperation({ summary: 'Serve marketing asset bytes (used in email <img src>)' })
  async serveAsset(@Param('id') id: string, @Res() res: Response) {
    const asset = await this.marketing.getAsset(id);
    if (!asset) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', asset.data.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.end(asset.data);
  }

  @Public()
  @Get('unsubscribe/:token')
  @ApiOperation({ summary: 'One-click unsubscribe via per-recipient token' })
  async unsubscribeGet(@Param('token') token: string, @Res() res: Response) {
    try {
      const { email } = await this.marketing.unsubscribeByToken(token);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderUnsubPage(email, true));
    } catch {
      res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderUnsubPage('', false));
    }
  }

  @Public()
  @Post('unsubscribe/:token')
  @ApiOperation({ summary: 'One-click unsubscribe POST (RFC 8058)' })
  async unsubscribePost(@Param('token') token: string, @Res() res: Response) {
    try {
      await this.marketing.unsubscribeByToken(token);
      res.status(200).send('OK');
    } catch {
      res.status(404).send('Not found');
    }
  }
}

function renderUnsubPage(email: string, ok: boolean): string {
  const title = ok ? 'Suscripción cancelada' : 'Enlace inválido';
  const message = ok
    ? `Hemos dado de baja <strong>${escapeHtml(email)}</strong> de nuestras comunicaciones de marketing. No recibirás más correos promocionales.`
    : 'Este enlace no es válido o ha expirado.';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title} · OPALBAR</title></head>
<body style="margin:0;background:#0D0D0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#F4F4F5;">
  <div style="max-width:480px;margin:80px auto;padding:32px 24px;background:#17171B;border-radius:16px;text-align:center;">
    <div style="font-size:20px;font-weight:800;letter-spacing:1px;color:#F4A340;margin-bottom:24px;">OPALBAR</div>
    <div style="font-size:22px;font-weight:800;margin-bottom:12px;">${title}</div>
    <div style="color:#D4D4D8;font-size:14px;line-height:1.6;">${message}</div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
