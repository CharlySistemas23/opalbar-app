import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DmPolicy, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FriendshipsService } from '../friendships/friendships.service';
import { UpdateProfileDto, UpdateInterestsDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly friendships: FriendshipsService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: { include: { loyaltyLevel: true } },
        interests: { include: { category: true } },
        consent: true,
        notificationSettings: true,
        _count: {
          select: {
            reservations: true,
            offerRedemptions: true,
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...safe } = user as any;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
        ...(dto.language && { language: dto.language }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.occupation !== undefined && { occupation: dto.occupation }),
        ...(dto.discoverySource !== undefined && { discoverySource: dto.discoverySource }),
      },
      create: {
        userId,
        firstName: dto.firstName || '',
        lastName: dto.lastName || '',
        bio: dto.bio,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        city: dto.city,
        country: dto.country || 'MX',
        avatarUrl: dto.avatarUrl,
        coverUrl: dto.coverUrl,
        language: dto.language || 'es',
        gender: dto.gender,
        occupation: dto.occupation,
        discoverySource: dto.discoverySource,
      },
    });
    this.realtime.toUserAndStaff(userId, 'user', 'updated', { id: userId });
    return profile;
  }

  async updateInterests(userId: string, dto: UpdateInterestsDto) {
    // Delete existing and re-insert
    await this.prisma.userInterest.deleteMany({ where: { userId } });
    if (dto.categoryIds.length > 0) {
      await this.prisma.userInterest.createMany({
        data: dto.categoryIds.map((categoryId) => ({ userId, categoryId })),
        skipDuplicates: true,
      });
    }
    return this.prisma.userInterest.findMany({
      where: { userId },
      include: { category: true },
    });
  }

  async updateDmPolicy(userId: string, policy: DmPolicy) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { dmPolicy: policy },
      select: { id: true, dmPolicy: true },
    });
  }

  async updateNotificationSettings(userId: string, settings: Record<string, boolean>) {
    // The mobile UI uses simple toggle names ("community", "marketing", …)
    // while the Prisma model has more granular columns (communityReplies,
    // communityReactions, marketingEmails, …). Translate before writing —
    // otherwise Prisma rejects the unknown fields and the optimistic toggle
    // silently reverts on the client.
    const patch: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value !== 'boolean') continue;
      switch (key) {
        case 'events':
          patch.newEvents = value;
          patch.eventReminders = value;
          break;
        case 'offers':
          patch.newOffers = value;
          break;
        case 'community':
          patch.communityReplies = value;
          patch.communityReactions = value;
          break;
        case 'reservations':
          // No dedicated column yet — ride on eventReminders so the toggle
          // still has behavior attached instead of being a silent no-op.
          patch.eventReminders = value;
          break;
        case 'marketing':
          patch.marketingEmails = value;
          break;
        default:
          // Accept raw column names too (pushEnabled, weeklyDigest, …) so
          // future screens can target them directly.
          patch[key] = value;
      }
    }

    return this.prisma.notificationSettings.upsert({
      where: { userId },
      update: patch,
      create: { userId, ...patch },
    });
  }

  async requestDataExport(userId: string) {
    return this.prisma.dataExportRequest.create({
      data: { userId, status: 'PENDING' },
    });
  }

  async requestAccountDeletion(userId: string, reason?: string) {
    const deletionDays = 30;
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + deletionDays);

    return this.prisma.dataDeletionRequest.create({
      data: { userId, reason, scheduledFor, status: 'PENDING' },
    });
  }

  async updateConsent(userId: string, consent: Record<string, boolean>) {
    // The privacy screen also posts profile-visibility keys (showProfile,
    // showActivity, allowMessages) that have no UserConsent column yet.
    // Drop unknown keys so Prisma doesn't reject the upsert — otherwise the
    // toggle errors out and silently reverts on the client.
    const allowed = new Set([
      'termsAccepted', 'privacyAccepted',
      'marketingConsent', 'analyticsConsent', 'pushConsent',
    ]);
    const patch: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(consent)) {
      if (typeof v === 'boolean' && allowed.has(k)) patch[k] = v;
    }

    return this.prisma.userConsent.upsert({
      where: { userId },
      update: { ...patch, updatedAt: new Date() },
      create: { userId, ...patch },
    });
  }

  async uploadAvatar(userId: string, avatarUrl: string) {
    return this.prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl },
    });
  }

  // ─────────────────────────────────────────────
  //  SEARCH
  // ─────────────────────────────────────────────

  async search(query: string, limit: number) {
    const q = query.trim();
    if (!q) return [];
    // Audit fix: el endpoint era @Public y devolvia emails reales + cuentas
    // baneadas/soft-deleted. Excluimos BANNED y DELETED — pero PENDING_VERIFICATION
    // (default al registrarse) sigue siendo searchable porque la verificacion
    // toma minutos y la gente quiere encontrar amigos apenas se registra.
    // Tampoco devolvemos email (PII), y la busqueda por email exige el email
    // completo (no fragmento) para evitar enumeracion.
    const looksLikeEmail = /^[^@\s]+@[^@\s]+/.test(q);
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['BANNED', 'DELETED'] },
        OR: [
          ...(looksLikeEmail ? [{ email: q.toLowerCase() }] : []),
          { profile: { firstName: { contains: q, mode: 'insensitive' as const } } },
          { profile: { lastName: { contains: q, mode: 'insensitive' as const } } },
        ],
      },
      select: {
        id: true, points: true, isPrivate: true,
        profile: { select: { firstName: true, lastName: true, avatarUrl: true, bio: true } },
        _count: { select: { followers: true, following: true, posts: true, events: true } },
      },
      take: Math.min(limit, 50),
    });
  }

  // ─────────────────────────────────────────────
  //  PUBLIC PROFILE
  // ─────────────────────────────────────────────

  async getPublicProfile(id: string, viewerId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, email: true, createdAt: true, points: true,
        friendPolicy: true, isPrivate: true,
        profile: {
          select: {
            firstName: true, lastName: true, avatarUrl: true, coverUrl: true, bio: true,
            city: true, country: true,
            birthDate: true, gender: true, occupation: true, language: true,
            loyaltyLevel: { select: { name: true, color: true, icon: true } },
          },
        },
        _count: {
          select: {
            followers: true, following: true, posts: true,
            events: true, offerRedemptions: true,
          },
        },
      },
    });
    if (!user) return null;

    let isFollowing = false;
    let friendship: Awaited<ReturnType<FriendshipsService['getProfileContext']>> = {
      status: 'none',
      isFriend: false,
      mutualCount: 0,
    };
    if (viewerId && viewerId !== id) {
      const [existing, fctx] = await Promise.all([
        this.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: id } },
        }),
        this.friendships.getProfileContext(viewerId, id),
      ]);
      isFollowing = !!existing;
      friendship = fctx;
    }
    // friendsCount derived once so the UI can show "X amigos" alongside followers/following.
    const friendIds = await this.friendships.getFriendIds(id);

    // Audit fix: si la cuenta es privada y el viewer no es el dueño / amigo /
    // follower aceptado, ocultamos los campos sensibles (bio, ciudad, fecha de
    // nacimiento, genero, ocupacion). Mantenemos la misma SHAPE para no romper
    // el front (todos los campos siguen presentes, simplemente vacios/null).
    const isOwner = !!viewerId && viewerId === id;
    const hasAccess = isOwner || isFollowing || friendship.isFriend;
    if (user.isPrivate && !hasAccess) {
      return {
        id: user.id,
        email: null,
        createdAt: user.createdAt,
        points: 0,
        friendPolicy: user.friendPolicy,
        isPrivate: true,
        profile: {
          firstName: user.profile?.firstName ?? '',
          lastName: user.profile?.lastName ?? '',
          avatarUrl: user.profile?.avatarUrl ?? null,
          coverUrl: null,
          bio: null,
          city: null,
          country: null,
          birthDate: null,
          gender: null,
          occupation: null,
          language: user.profile?.language ?? 'es',
          loyaltyLevel: null,
        },
        isFollowing,
        friendship,
        _count: {
          followers: user._count.followers,
          following: user._count.following,
          posts: 0,
          events: 0,
          offerRedemptions: 0,
          friends: 0,
        },
      };
    }

    return {
      ...user,
      // Audit fix: nunca devuelvas el email del usuario en perfil publico,
      // independientemente de privacidad. Solo el dueno via /me lo ve.
      email: isOwner ? user.email : null,
      isFollowing,
      friendship,
      _count: { ...user._count, friends: friendIds.length },
    };
  }

  // ─────────────────────────────────────────────
  //  FOLLOWS
  // ─────────────────────────────────────────────

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error("Can't follow yourself");
    }
    const result = await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId },
      update: {},
    });
    this.realtime.toUsers([followerId, followingId], 'user', 'updated', { id: followingId, data: { follow: true, by: followerId } });

    // Only notify when the follow row was actually created (upsert returned a
    // brand-new id). Otherwise re-clicking "follow" would re-spam the user.
    const isNew = result.createdAt.getTime() > Date.now() - 5_000;
    if (isNew) {
      const actor = await this.prisma.userProfile.findUnique({
        where: { userId: followerId },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      const actorName =
        `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || 'Alguien';
      this.notifications
        .createNotification({
          userId: followingId,
          type: NotificationType.COMMUNITY_FOLLOW,
          title: 'Nuevo seguidor',
          titleEn: 'New follower',
          body: `${actorName} ahora te sigue.`,
          bodyEn: `${actorName} is now following you.`,
          data: { actorId: followerId, actorName, actorAvatarUrl: actor?.avatarUrl ?? null },
        })
        .catch(() => {});
    }

    return { ok: true, isFollowing: true };
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    this.realtime.toUsers([followerId, followingId], 'user', 'updated', { id: followingId, data: { follow: false, by: followerId } });
    return { ok: true, isFollowing: false };
  }

  async listFollowers(userId: string, limit: number, viewerId?: string) {
    // Audit fix: si la cuenta es privada, solo el dueno + sus followers /
    // amigos pueden ver el listado de seguidores. Antes era @Public abierto.
    await this.assertCanViewFollowList(userId, viewerId);
    const rows = await this.prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((r) => r.follower);
  }

  async listFollowing(userId: string, limit: number, viewerId?: string) {
    await this.assertCanViewFollowList(userId, viewerId);
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((r) => r.following);
  }

  // Helper: la lista de followers/following solo es visible para el dueno,
  // para alguien que ya sigue al user, o para amigos. Anonimos pueden verla
  // SOLO si la cuenta es publica (no isPrivate). Devuelve void o lanza 403.
  private async assertCanViewFollowList(targetId: string, viewerId?: string): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { isPrivate: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!target.isPrivate) return; // cuenta publica → cualquiera puede ver
    if (!viewerId) throw new ForbiddenException('Private account');
    if (viewerId === targetId) return;
    const [follow, fctx] = await Promise.all([
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      }),
      this.friendships.getProfileContext(viewerId, targetId),
    ]);
    if (!follow && !fctx.isFriend) {
      throw new ForbiddenException('Private account — follow first to see this list');
    }
  }

  // ─────────────────────────────────────────────
  //  SAVED ITEMS
  // ─────────────────────────────────────────────

  async listSaved(userId: string, type?: string) {
    return this.prisma.savedItem.findMany({
      where: { userId, ...(type ? { type: type.toUpperCase() as any } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async toggleSave(userId: string, type: string, targetId: string) {
    const typeEnum = type.toUpperCase() as any;
    const existing = await this.prisma.savedItem.findUnique({
      where: { userId_type_targetId: { userId, type: typeEnum, targetId } },
    });
    if (existing) {
      await this.prisma.savedItem.delete({ where: { id: existing.id } });
      return { saved: false };
    }
    await this.prisma.savedItem.create({
      data: { userId, type: typeEnum, targetId },
    });
    return { saved: true };
  }
}
