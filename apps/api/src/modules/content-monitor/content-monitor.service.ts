import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FlagSeverity, FlagStatus, FlagTargetType, FilterRuleAction, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { PushService } from '../push/push.service';
import { CreateFilterRuleDto, FlagFilterDto, ReviewFlagDto, RuleFilterDto, UpdateFilterRuleDto } from './dto/content-monitor.dto';

@Injectable()
export class ContentMonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  // ── Flags ─────────────────────────────────

  async getFlags(filter: FlagFilterDto) {
    const { page = 1, limit = 20, status, severity, targetType } = filter;
    const skip = getPaginationOffset(page, limit);
    const where: any = {
      ...(status && { status }),
      ...(severity && { severity }),
      ...(targetType && { targetType }),
    };

    const [data, total] = await Promise.all([
      this.prisma.contentFlag.findMany({
        where,
        skip,
        take: limit,
        include: {
          reviewedBy: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.contentFlag.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getFlagStats() {
    const [total, pending, critical, high] = await Promise.all([
      this.prisma.contentFlag.count(),
      this.prisma.contentFlag.count({ where: { status: FlagStatus.PENDING } }),
      this.prisma.contentFlag.count({ where: { severity: FlagSeverity.CRITICAL } }),
      this.prisma.contentFlag.count({ where: { severity: FlagSeverity.HIGH } }),
    ]);
    return { total, pending, critical, high };
  }

  async reviewFlag(id: string, dto: ReviewFlagDto, reviewerId: string) {
    const flag = await this.prisma.contentFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Flag not found');

    return this.prisma.contentFlag.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        ...(dto.actionTaken && { actionTaken: dto.actionTaken }),
      },
    });
  }

  // ── Rules ─────────────────────────────────

  async getRules(filter: RuleFilterDto) {
    const { page = 1, limit = 50, isActive, severity } = filter;
    const skip = getPaginationOffset(page, limit);
    const where: any = {
      ...(isActive !== undefined && { isActive }),
      ...(severity && { severity }),
    };

    const [data, total] = await Promise.all([
      this.prisma.filterRule.findMany({
        where,
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.filterRule.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async createRule(dto: CreateFilterRuleDto, userId: string) {
    const exists = await this.prisma.filterRule.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('A rule with this name already exists');

    return this.prisma.filterRule.create({
      data: {
        name: dto.name,
        pattern: dto.pattern,
        isRegex: dto.isRegex ?? false,
        severity: dto.severity ?? FlagSeverity.MEDIUM,
        action: dto.action ?? FilterRuleAction.FLAG,
        createdById: userId,
      },
    });
  }

  async updateRule(id: string, dto: UpdateFilterRuleDto) {
    const rule = await this.prisma.filterRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');

    return this.prisma.filterRule.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.pattern && { pattern: dto.pattern }),
        ...(dto.isRegex !== undefined && { isRegex: dto.isRegex }),
        ...(dto.severity && { severity: dto.severity }),
        ...(dto.action && { action: dto.action }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteRule(id: string) {
    const rule = await this.prisma.filterRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    return this.prisma.filterRule.update({ where: { id }, data: { isActive: false } });
  }

  // ── Content scanning (called internally) ──

  async scanContent(targetType: FlagTargetType, targetId: string, text: string): Promise<void> {
    const rules = await this.prisma.filterRule.findMany({ where: { isActive: true } });

    for (const rule of rules) {
      let matched = false;
      let matchedText: string | undefined;

      if (rule.isRegex) {
        const regex = new RegExp(rule.pattern, 'i');
        const match = regex.exec(text);
        if (match) { matched = true; matchedText = match[0]; }
      } else {
        if (text.toLowerCase().includes(rule.pattern.toLowerCase())) {
          matched = true;
          matchedText = rule.pattern;
        }
      }

      if (matched) {
        await this.prisma.$transaction([
          this.prisma.contentFlag.create({
            data: {
              targetType,
              targetId,
              triggeredBy: rule.name,
              severity: rule.severity,
              matchedText,
            },
          }),
          this.prisma.filterRule.update({
            where: { id: rule.id },
            data: { matchCount: { increment: 1 } },
          }),
        ]);

        // Push admins only for high-impact severities. MEDIUM/LOW pile up in the
        // inbox and are reviewed on schedule; HIGH/CRITICAL need attention now.
        if (rule.severity === FlagSeverity.HIGH || rule.severity === FlagSeverity.CRITICAL) {
          this.push.sendToRoles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR], {
            title: rule.severity === FlagSeverity.CRITICAL ? 'Flag crítico' : 'Flag importante',
            body: `${rule.name} · ${targetType}`,
            data: { type: 'CONTENT_FLAG', severity: rule.severity, targetType, targetId, deepLink: '/(admin)/flags' },
          }).catch(() => {});
        }
      }
    }
  }
}
