import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default';
  // Expo translates this into FCM bigPicture/largeIcon (Android) and APNs
  // attachments (iOS). Used to show the sender's avatar on DM pushes etc.
  richContent?: { image?: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send a push notification to everyone holding one of the given roles.
   * Used to alert admins/moderators about urgent tickets, severe flags,
   * today's pending reservations, etc. Silent on network errors.
   */
  async sendToRoles(roles: UserRole[], payload: Omit<PushPayload, 'to'>): Promise<{ sent: number }> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (users.length === 0) return { sent: 0 };

    const results = await Promise.all(
      users.map((u) => this.sendToUser(u.id, payload).catch(() => ({ sent: 0 }))),
    );
    return { sent: results.reduce((acc, r) => acc + r.sent, 0) };
  }

  async register(userId: string, token: string, platform: string) {
    return this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });
  }

  async unregister(token: string) {
    try {
      await this.prisma.pushToken.delete({ where: { token } });
    } catch {}
    return { ok: true };
  }

  async sendToUser(userId: string, payload: Omit<PushPayload, 'to'>) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return { sent: 0 };

    const messages: PushPayload[] = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
      ...(payload.richContent?.image ? { richContent: { image: payload.richContent.image } } : {}),
    }));

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        this.logger.warn(`Expo push returned ${res.status}`);
      }

      const body: any = await res.json().catch(() => null);
      const receipts = body?.data ?? [];
      const invalidTokens: string[] = [];
      receipts.forEach((r: any, i: number) => {
        if (r?.status === 'error' && r?.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(tokens[i].token);
        }
      });
      if (invalidTokens.length) {
        await this.prisma.pushToken.deleteMany({ where: { token: { in: invalidTokens } } });
      }
      return { sent: receipts.length - invalidTokens.length };
    } catch (err: any) {
      this.logger.error(`Push send failed: ${err?.message}`);
      return { sent: 0 };
    }
  }
}
