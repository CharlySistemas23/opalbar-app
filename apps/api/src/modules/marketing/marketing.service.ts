// ─────────────────────────────────────────────
//  MarketingService — email campaigns composed from mobile admin
//  · Template rendering (server-side HTML)
//  · Audience segmentation (consent-aware)
//  · Batched delivery via nodemailer (shares OTP transporter pattern)
//  · Open tracking (pixel) + unsubscribe token flow
// ─────────────────────────────────────────────
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailAudienceType,
  EmailCampaignTemplate,
  Prisma,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import {
  AudienceCountDto,
  AudienceFilterDto,
  CreateCampaignDto,
  RenderPreviewDto,
  UploadAssetDto,
} from './dto/marketing.dto';
import {
  renderEmailHtml,
  renderEmailText,
  TEMPLATE_CATALOG,
  TemplateMeta,
} from './templates';

const BATCH_SIZE = 25;
const BATCH_PAUSE_MS = 1200;

@Injectable()
export class MarketingService implements OnModuleInit {
  private readonly logger = new Logger(MarketingService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('email.host'),
      port: config.get<number>('email.port'),
      secure: config.get<boolean>('email.secure'),
      auth: {
        user: config.get<string>('email.user'),
        pass: config.get<string>('email.pass'),
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  onModuleInit() {
    // Dispatch any scheduled campaigns that are due on service boot.
    // Lightweight polling — every minute check SCHEDULED campaigns whose
    // scheduledAt <= now and kick them off. Fine for small-to-medium lists;
    // swap for Bull/Redis queue when you need horizontal scale.
    setInterval(() => this.dispatchDue().catch(() => undefined), 60_000);
  }

  // ─────────────────────────────────────────
  //  Templates
  // ─────────────────────────────────────────

  listTemplates(): TemplateMeta[] {
    return TEMPLATE_CATALOG;
  }

  renderPreview(dto: RenderPreviewDto): { html: string; text: string } {
    const html = renderEmailHtml({
      ...dto,
      recipientFirstName: 'Carlos',
      unsubscribeUrl: '#preview-unsubscribe',
    });
    const text = renderEmailText({
      ...dto,
      recipientFirstName: 'Carlos',
    });
    return { html, text };
  }

  // ─────────────────────────────────────────
  //  Audience
  // ─────────────────────────────────────────

  async countAudience(dto: AudienceCountDto): Promise<{ total: number; sample: Array<{ id: string; email: string; firstName: string }> }> {
    const where = this.buildAudienceWhere(dto.audienceType, dto.audienceFilter);
    const [total, sample] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          profile: { select: { firstName: true } },
        },
      }),
    ]);
    return {
      total,
      sample: sample.map((u) => ({
        id: u.id,
        email: u.email ?? '',
        firstName: u.profile?.firstName ?? '',
      })),
    };
  }

  /**
   * Build a Prisma `where` that only includes:
   *  · users with a non-null email
   *  · marketing consent granted
   *  · not banned or deleted
   * …then layers the segment-specific filter on top.
   */
  private buildAudienceWhere(
    type: EmailAudienceType,
    filter?: AudienceFilterDto | null,
  ): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = {
      email: { not: null },
      status: 'ACTIVE',
      consent: { marketingConsent: true },
    };

    switch (type) {
      case 'ALL':
        break;
      case 'NEW_7D': {
        const since = new Date();
        since.setDate(since.getDate() - 7);
        base.createdAt = { gte: since };
        break;
      }
      case 'VIP':
        // Top-tier: anyone already on a loyalty level (seeded levels represent tiers)
        base.profile = { is: { loyaltyLevelId: { not: null } } };
        break;
      case 'BIRTHDAY_MONTH': {
        // Approximation — Prisma doesn't support MONTH() portable across all DBs.
        // Pull candidates w/ birthDate and filter in memory via raw interval.
        // For correctness we use a raw query escape via $queryRaw in sendCampaign
        // but for the *count* we accept the approximation via createdAt range.
        // Better: narrow to users w/ birthDate present, then filter later.
        base.profile = { is: { birthDate: { not: null } } };
        break;
      }
      case 'INACTIVE_30D': {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        // Users whose last updatedAt (session, profile) is older than 30d
        base.updatedAt = { lt: cutoff };
        break;
      }
      case 'CUSTOM':
        break;
    }

    if (filter) {
      const and: Prisma.UserWhereInput[] = [];
      if (filter.cities?.length) {
        and.push({ profile: { is: { city: { in: filter.cities } } } });
      }
      if (filter.interestIds?.length) {
        and.push({ interests: { some: { categoryId: { in: filter.interestIds } } } });
      }
      if (filter.loyaltyLevelIds?.length) {
        and.push({
          profile: { is: { loyaltyLevelId: { in: filter.loyaltyLevelIds } } },
        });
      }
      if (typeof filter.minPoints === 'number') {
        and.push({ points: { gte: filter.minPoints } });
      }
      if (and.length) base.AND = and;
    }

    return base;
  }

  /**
   * For BIRTHDAY_MONTH we need in-memory month filtering because the
   * Prisma `where` can't do `MONTH(birthDate) = MONTH(now)` portably.
   */
  private filterBirthdayMonth<T extends { profile?: { birthDate?: Date | null } | null }>(
    users: T[],
  ): T[] {
    const month = new Date().getMonth();
    return users.filter((u) => {
      const bd = u.profile?.birthDate;
      return bd instanceof Date && bd.getMonth() === month;
    });
  }

  // ─────────────────────────────────────────
  //  Campaigns CRUD
  // ─────────────────────────────────────────

  async createCampaign(dto: CreateCampaignDto, adminId: string) {
    const scheduled = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduled && scheduled.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    const campaign = await this.prisma.emailCampaign.create({
      data: {
        subject: dto.subject,
        preheader: dto.preheader,
        headline: dto.headline,
        body: dto.body,
        ctaLabel: dto.ctaLabel,
        ctaUrl: dto.ctaUrl,
        heroImageUrl: dto.heroImageUrl,
        template: dto.template,
        audienceType: dto.audienceType,
        audienceFilter: dto.audienceFilter
          ? (dto.audienceFilter as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        status: scheduled ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: scheduled,
        createdById: adminId,
      },
    });

    // If no schedule provided, admin can press "Enviar ahora" explicitly.
    // Returning the DRAFT here lets the mobile show a confirm preview before dispatch.
    return campaign;
  }

  async listCampaigns() {
    return this.prisma.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        subject: true,
        template: true,
        status: true,
        audienceType: true,
        scheduledAt: true,
        sentAt: true,
        recipientCount: true,
        sentCount: true,
        openCount: true,
        unsubCount: true,
        failCount: true,
        createdAt: true,
      },
    });
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const [recentOpens, recentUnsubs] = await Promise.all([
      this.prisma.emailCampaignRecipient.findMany({
        where: { campaignId: id, openedAt: { not: null } },
        orderBy: { openedAt: 'desc' },
        take: 10,
        select: { email: true, openedAt: true },
      }),
      this.prisma.emailCampaignRecipient.findMany({
        where: { campaignId: id, unsubedAt: { not: null } },
        orderBy: { unsubedAt: 'desc' },
        take: 10,
        select: { email: true, unsubedAt: true },
      }),
    ]);

    const openRate =
      campaign.sentCount > 0
        ? Math.round((campaign.openCount / campaign.sentCount) * 100)
        : 0;

    return { ...campaign, openRate, recentOpens, recentUnsubs };
  }

  async deleteCampaign(id: string) {
    const campaign = await this.prisma.emailCampaign.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'SENDING') {
      throw new BadRequestException(
        'No se puede eliminar una campaña mientras está enviando. Cancélala primero.',
      );
    }
    // Recipient rows cascade via the FK; no manual cleanup needed.
    await this.prisma.emailCampaign.delete({ where: { id } });
    return { deleted: true };
  }

  async cancelCampaign(id: string) {
    const campaign = await this.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'SCHEDULED' && campaign.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only DRAFT or SCHEDULED campaigns can be cancelled',
      );
    }
    return this.prisma.emailCampaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // ─────────────────────────────────────────
  //  Send
  // ─────────────────────────────────────────

  /**
   * Admin-triggered "send now". Dispatches in the background so the HTTP
   * response returns quickly — mobile shows "enviando…" and polls detail.
   */
  async sendCampaignNow(id: string): Promise<{ started: true }> {
    const campaign = await this.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'SENDING' || campaign.status === 'SENT') {
      throw new BadRequestException('Campaign is already being sent or sent');
    }
    if (campaign.status === 'CANCELLED') {
      throw new BadRequestException('Campaign was cancelled');
    }

    await this.prisma.emailCampaign.update({
      where: { id },
      data: { status: 'SENDING' },
    });

    // Fire-and-forget — errors surface via status=FAILED + logger
    this.runSend(id).catch((err) => {
      this.logger.error(`Campaign ${id} failed mid-send: ${err?.message ?? err}`);
      this.prisma.emailCampaign.update({
        where: { id },
        data: { status: 'FAILED' },
      }).catch(() => undefined);
    });

    return { started: true };
  }

  private async dispatchDue() {
    const due = await this.prisma.emailCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
      select: { id: true },
      take: 5,
    });
    for (const c of due) {
      this.logger.log(`Dispatching scheduled campaign ${c.id}`);
      await this.sendCampaignNow(c.id).catch(() => undefined);
    }
  }

  private async runSend(id: string): Promise<void> {
    const campaign = await this.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) return;

    // Resolve audience
    const audienceFilter = campaign.audienceFilter as AudienceFilterDto | null;
    const where = this.buildAudienceWhere(campaign.audienceType, audienceFilter);
    let users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        profile: { select: { firstName: true, birthDate: true } },
      },
    });

    if (campaign.audienceType === 'BIRTHDAY_MONTH') {
      users = this.filterBirthdayMonth(users);
    }

    // Persist recipients (skips duplicates thanks to unique constraint)
    if (users.length) {
      await this.prisma.emailCampaignRecipient.createMany({
        data: users
          .filter((u) => u.email)
          .map((u) => ({
            campaignId: campaign.id,
            userId: u.id,
            email: u.email as string,
          })),
        skipDuplicates: true,
      });
    }

    const recipients = await this.prisma.emailCampaignRecipient.findMany({
      where: { campaignId: campaign.id, sentAt: null, unsubedAt: null },
      include: {
        // include minimal user data via a secondary lookup since we removed
        // the User relation from the schema to keep it lean
      },
    });

    await this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { recipientCount: recipients.length },
    });

    // Fetch firstNames in one batch for personalization
    const names = await this.prisma.userProfile.findMany({
      where: { userId: { in: recipients.map((r) => r.userId) } },
      select: { userId: true, firstName: true },
    });
    const nameMap = new Map(names.map((n) => [n.userId, n.firstName]));

    // Send in batches
    const appUrl = this.config.get<string>('appUrl') || 'http://localhost:3000';
    const apiPrefix = this.config.get<string>('apiPrefix') || 'api/v1';
    const from = this.config.get<string>('email.from');

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (r) => {
          const trackingPixelUrl = `${appUrl}/${apiPrefix}/email/track/open/${r.id}.gif`;
          const unsubscribeUrl = `${appUrl}/${apiPrefix}/email/unsubscribe/${r.unsubToken}`;

          const html = renderEmailHtml({
            template: campaign.template as EmailCampaignTemplate,
            subject: campaign.subject,
            preheader: campaign.preheader,
            headline: campaign.headline,
            body: campaign.body,
            ctaLabel: campaign.ctaLabel,
            ctaUrl: campaign.ctaUrl,
            heroImageUrl: campaign.heroImageUrl,
            recipientFirstName: nameMap.get(r.userId) ?? undefined,
            trackingPixelUrl,
            unsubscribeUrl,
          });
          const text = renderEmailText({
            template: campaign.template as EmailCampaignTemplate,
            subject: campaign.subject,
            headline: campaign.headline,
            body: campaign.body,
            ctaLabel: campaign.ctaLabel,
            ctaUrl: campaign.ctaUrl,
            recipientFirstName: nameMap.get(r.userId) ?? undefined,
            unsubscribeUrl,
          });

          try {
            await this.transporter.sendMail({
              from,
              to: r.email,
              subject: campaign.subject,
              html,
              text,
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                'X-Campaign-Id': campaign.id,
              },
            });
            await this.prisma.emailCampaignRecipient.update({
              where: { id: r.id },
              data: { sentAt: new Date() },
            });
            sent++;
          } catch (err: any) {
            await this.prisma.emailCampaignRecipient.update({
              where: { id: r.id },
              data: { failedReason: String(err?.message ?? err).slice(0, 290) },
            });
            failed++;
            this.logger.warn(
              `[marketing] send fail to ${r.email} (${campaign.id}): ${err?.message ?? err}`,
            );
          }
        }),
      );

      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((res) => setTimeout(res, BATCH_PAUSE_MS));
      }

      // Incremental counter update so mobile progress reflects live state
      await this.prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { sentCount: sent, failCount: failed },
      });
    }

    await this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: failed > 0 && sent === 0 ? 'FAILED' : 'SENT',
        sentAt: new Date(),
        sentCount: sent,
        failCount: failed,
      },
    });

    this.logger.log(
      `[marketing] campaign ${campaign.id} finished — sent=${sent} failed=${failed}`,
    );
  }

  // ─────────────────────────────────────────
  //  Tracking (public endpoints)
  // ─────────────────────────────────────────

  async markOpened(recipientId: string): Promise<void> {
    const recipient = await this.prisma.emailCampaignRecipient.findUnique({
      where: { id: recipientId },
    });
    if (!recipient || recipient.openedAt) return;

    await this.prisma.$transaction([
      this.prisma.emailCampaignRecipient.update({
        where: { id: recipientId },
        data: { openedAt: new Date() },
      }),
      this.prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { openCount: { increment: 1 } },
      }),
    ]);
  }

  // ─────────────────────────────────────────
  //  Assets (hero images uploaded from mobile)
  // ─────────────────────────────────────────

  private readonly ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);
  private readonly MAX_ASSET_BYTES = 8 * 1024 * 1024; // 8 MB binary

  async uploadAsset(dto: UploadAssetDto, adminId: string): Promise<{ id: string; url: string }> {
    const match = /^data:([\w+/.-]+);base64,(.+)$/.exec(dto.dataUrl.trim());
    if (!match) {
      throw new BadRequestException('Invalid data URI');
    }
    const mimeType = match[1].toLowerCase();
    if (!this.ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException(`Unsupported image type: ${mimeType}`);
    }
    const data = Buffer.from(match[2], 'base64');
    if (data.length === 0) {
      throw new BadRequestException('Empty image payload');
    }
    if (data.length > this.MAX_ASSET_BYTES) {
      throw new BadRequestException('Image exceeds 8MB limit');
    }

    const asset = await this.prisma.marketingAsset.create({
      data: {
        mimeType,
        sizeBytes: data.length,
        data,
        uploadedBy: adminId,
      },
      select: { id: true },
    });

    const appUrl = this.config.get<string>('appUrl') || 'http://localhost:3000';
    const apiPrefix = this.config.get<string>('apiPrefix') || 'api/v1';
    const url = `${appUrl.replace(/\/$/, '')}/${apiPrefix.replace(/^\/|\/$/g, '')}/email/asset/${asset.id}`;

    return { id: asset.id, url };
  }

  async getAsset(id: string): Promise<{ mimeType: string; data: Buffer } | null> {
    const asset = await this.prisma.marketingAsset.findUnique({
      where: { id },
      select: { mimeType: true, data: true },
    });
    if (!asset) return null;
    return {
      mimeType: asset.mimeType,
      data: Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data),
    };
  }

  async unsubscribeByToken(token: string): Promise<{ email: string }> {
    const recipient = await this.prisma.emailCampaignRecipient.findUnique({
      where: { unsubToken: token },
    });
    if (!recipient) throw new NotFoundException('Invalid unsubscribe link');

    if (recipient.unsubedAt) {
      return { email: recipient.email };
    }

    await this.prisma.$transaction([
      this.prisma.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: { unsubedAt: new Date() },
      }),
      this.prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { unsubCount: { increment: 1 } },
      }),
      this.prisma.userConsent.updateMany({
        where: { userId: recipient.userId },
        data: { marketingConsent: false },
      }),
    ]);

    return { email: recipient.email };
  }
}
