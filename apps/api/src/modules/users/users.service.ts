import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DmPolicy, NotificationType, SavedItemType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FriendshipsService, FriendshipContext } from '../friendships/friendships.service';
import { paginate } from '../../common/dto/pagination.dto';
import { UpdateProfileDto, UpdateInterestsDto } from './dto/update-profile.dto';
import { UpdateNotificationSettingsDto } from './dto/account-settings.dto';

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
    // Semántica: `undefined` = no tocar, `null` = limpiar el campo. Strings
    // vacíos en campos opcionales también se guardan como null para que el
    // perfil no acumule "" y el front pueda usar `?? placeholder`.
    const clean = (v: string | null | undefined): string | null | undefined =>
      v === undefined ? undefined : (v === null || v.trim() === '' ? null : v.trim());
    const birthDate =
      dto.birthDate === undefined ? undefined : dto.birthDate === null ? null : new Date(dto.birthDate);
    if (birthDate instanceof Date) {
      if (Number.isNaN(birthDate.getTime())) throw new BadRequestException('birthDate must be a valid date');
      if (birthDate.getTime() > Date.now()) throw new BadRequestException('birthDate cannot be in the future');
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        // `@IsOptional()` also lets `null` through, and both columns are
        // required — treat a null/blank name as "leave it alone" instead of
        // crashing on `.trim()` or writing an empty name.
        ...(dto.firstName?.trim() ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName?.trim() ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.bio !== undefined && { bio: clean(dto.bio) }),
        ...(birthDate !== undefined && { birthDate }),
        ...(dto.city !== undefined && { city: clean(dto.city) }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: clean(dto.avatarUrl) }),
        ...(dto.coverUrl !== undefined && { coverUrl: clean(dto.coverUrl) }),
        ...(dto.language && { language: dto.language }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.occupation !== undefined && { occupation: clean(dto.occupation) }),
        ...(dto.discoverySource !== undefined && { discoverySource: dto.discoverySource }),
      },
      create: {
        userId,
        firstName: dto.firstName?.trim() || '',
        lastName: dto.lastName?.trim() || '',
        bio: clean(dto.bio) ?? undefined,
        birthDate: birthDate ?? undefined,
        city: clean(dto.city) ?? undefined,
        country: dto.country || 'MX',
        avatarUrl: clean(dto.avatarUrl) ?? undefined,
        coverUrl: clean(dto.coverUrl) ?? undefined,
        language: dto.language || 'es',
        gender: dto.gender ?? undefined,
        occupation: clean(dto.occupation) ?? undefined,
        discoverySource: dto.discoverySource,
      },
    });
    this.realtime.toUserAndStaff(userId, 'user', 'updated', { id: userId });
    return profile;
  }

  async updatePrivacy(userId: string, isPrivate: boolean) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isPrivate },
      select: { id: true, isPrivate: true, dmPolicy: true, friendPolicy: true, mentionPolicy: true },
    });
    this.realtime.toUserAndStaff(userId, 'user', 'updated', { id: userId, data: { isPrivate } });
    return user;
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

  // Columnas reales del modelo NotificationSettings (whitelist).
  private static readonly NOTIFICATION_COLUMNS = new Set([
    'pushEnabled', 'emailEnabled', 'eventReminders', 'newEvents', 'newOffers',
    'communityReplies', 'communityReactions', 'pointsUpdates', 'marketingEmails', 'weeklyDigest',
  ]);

  // Alias del móvil → columna(s). Sin colisiones: `events` solo toca newEvents
  // y `reservations` solo eventReminders, así un toggle nunca pisa a otro.
  private static readonly NOTIFICATION_ALIASES: Record<string, string[]> = {
    events: ['newEvents'],
    offers: ['newOffers'],
    community: ['communityReplies', 'communityReactions'],
    reservations: ['eventReminders'],
    marketing: ['marketingEmails'],
  };

  async updateNotificationSettings(userId: string, settings: UpdateNotificationSettingsDto) {
    const patch: Record<string, boolean> = {};
    const unknown: string[] = [];
    for (const [key, value] of Object.entries(settings ?? {})) {
      if (value === undefined) continue;
      if (typeof value !== 'boolean') {
        throw new BadRequestException(`${key} must be a boolean`);
      }
      const alias = UsersService.NOTIFICATION_ALIASES[key];
      if (alias) {
        for (const col of alias) patch[col] = value;
      } else if (UsersService.NOTIFICATION_COLUMNS.has(key)) {
        patch[key] = value;
      } else {
        unknown.push(key);
      }
    }
    if (unknown.length) {
      throw new BadRequestException(`Unknown notification setting: ${unknown.join(', ')}`);
    }
    if (!Object.keys(patch).length) {
      throw new BadRequestException('No notification settings provided');
    }

    return this.prisma.notificationSettings.upsert({
      where: { userId },
      update: patch,
      create: { userId, ...patch },
    });
  }

  // ─────────────────────────────────────────────
  //  GDPR — export / deletion / requests
  // ─────────────────────────────────────────────

  async requestDataExport(userId: string) {
    // Dedupe: si ya hay una exportación en curso devolvemos esa en vez de
    // encolar otra (evita spam a admins y varios correos al usuario).
    const existing = await this.prisma.dataExportRequest.findFirst({
      where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { ...existing, alreadyRequested: true };
    const created = await this.prisma.dataExportRequest.create({
      data: { userId, status: 'PENDING' },
    });
    this.realtime.toStaff('user', 'updated', { id: userId, data: { gdpr: 'export_requested' } });
    return { ...created, alreadyRequested: false };
  }

  async listDataRequests(userId: string) {
    const [exports, deletions] = await Promise.all([
      this.prisma.dataExportRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, status: true, createdAt: true, processedAt: true,
          downloadUrl: true, expiresAt: true,
        },
      }),
      this.prisma.dataDeletionRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, createdAt: true, scheduledFor: true, processedAt: true },
      }),
    ]);
    // Un enlace de descarga caducado no se expone: el cliente lo mostraría
    // como "listo" y el endpoint respondería 410.
    const now = Date.now();
    return {
      exports: exports.map((e) => ({
        ...e,
        downloadUrl: e.downloadUrl && e.expiresAt && e.expiresAt.getTime() < now ? null : e.downloadUrl,
        expired: !!(e.expiresAt && e.expiresAt.getTime() < now),
      })),
      deletions,
    };
  }

  /**
   * Solicitud de eliminación (GDPR). Flujo:
   *   1. Verifica la contraseña (si la cuenta tiene una).
   *   2. Dedupe: si ya hay una solicitud PENDING la devolvemos tal cual.
   *   3. Soft-delete INMEDIATO: status DELETED + deletedAt. JwtStrategy y
   *      JwtRefreshStrategy rechazan usuarios DELETED en cada request, así que
   *      todos los tokens vivos mueren al instante sin tocar Redis.
   *   4. Sesiones y push tokens se desactivan; la DataDeletionRequest queda
   *      programada a 30 días para que un admin apruebe la anonimización
   *      definitiva (AdminService.softDeleteUser) — mientras tanto soporte
   *      puede revertir. El email/teléfono se conservan en esa ventana para
   *      que el login pueda responder "Account scheduled for deletion".
   */
  async requestAccountDeletion(userId: string, opts: { reason?: string; password?: string } = {}) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, status: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.passwordHash) {
      if (!opts.password) throw new BadRequestException('Password is required to delete your account');
      const ok = await bcrypt.compare(opts.password, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Current password is incorrect');
    }

    const existing = await this.prisma.dataDeletionRequest.findFirst({
      where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing && user.status === UserStatus.DELETED) {
      return { ...existing, alreadyRequested: true };
    }

    const deletionDays = 30;
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + deletionDays);
    const reason = opts.reason?.trim() || undefined;

    const [request] = await this.prisma.$transaction([
      existing
        ? this.prisma.dataDeletionRequest.update({
            where: { id: existing.id },
            data: { reason: reason ?? existing.reason, scheduledFor },
          })
        : this.prisma.dataDeletionRequest.create({
            data: { userId, reason, scheduledFor, status: 'PENDING' },
          }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.DELETED, deletedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.pushToken.deleteMany({ where: { userId } }),
    ]);

    this.realtime.toStaff('user', 'updated', { id: userId, data: { gdpr: 'deletion_requested', scheduledFor } });
    return { ...request, alreadyRequested: false };
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

  async search(query: string, limit: number, viewerId?: string) {
    const q = (query ?? '').trim();
    // Min 2 chars: a single letter matches half the user base and is useless.
    if (q.length < 2) return [];
    // Audit fix: el endpoint era @Public y devolvia emails reales + cuentas
    // baneadas/soft-deleted. Excluimos BANNED y DELETED — pero PENDING_VERIFICATION
    // (default al registrarse) sigue siendo searchable porque la verificacion
    // toma minutos y la gente quiere encontrar amigos apenas se registra.
    // Tampoco devolvemos email (PII), y la busqueda por email exige el email
    // completo (no fragmento) para evitar enumeracion.
    // Se excluye al propio viewer y a cualquier usuario bloqueado en
    // cualquier direccion (un bloqueado no debe poder encontrarte).
    const looksLikeEmail = /^[^@\s]+@[^@\s]+/.test(q);
    const excluded = new Set<string>();
    if (viewerId) {
      excluded.add(viewerId);
      for (const id of await this.friendships.getBlockedIds(viewerId)) excluded.add(id);
    }
    const [first, ...rest] = q.split(/\s+/);
    const last = rest.join(' ');
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['BANNED', 'DELETED'] },
        ...(excluded.size ? { id: { notIn: [...excluded] } } : {}),
        OR: [
          ...(looksLikeEmail ? [{ email: q.toLowerCase() }] : []),
          { profile: { firstName: { contains: q, mode: 'insensitive' as const } } },
          { profile: { lastName: { contains: q, mode: 'insensitive' as const } } },
          // "Ana Lopez" → firstName contains "Ana" AND lastName contains "Lopez"
          ...(last
            ? [{
                profile: {
                  firstName: { contains: first, mode: 'insensitive' as const },
                  lastName: { contains: last, mode: 'insensitive' as const },
                },
              }]
            : []),
        ],
      },
      select: {
        id: true, isPrivate: true,
        profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: [{ profile: { firstName: 'asc' } }, { profile: { lastName: 'asc' } }],
      take: Math.min(Math.max(1, limit || 20), 20),
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
    let friendship: FriendshipContext = {
      status: viewerId === id ? 'self' : 'none',
      isFriend: false,
      mutualCount: 0,
      friendshipId: null,
      blockedByMe: false,
      isBlocked: false,
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

    // Bloqueo (en cualquier direccion): perfil enmascarado. Solo nombre y
    // avatar — sin posts, sin contadores, sin bio. `blockedByMe` permite al
    // front mostrar "Desbloquear"; si me bloquearon a mi, no hay accion.
    if (friendship.isBlocked) {
      return {
        id: user.id,
        email: null,
        createdAt: user.createdAt,
        points: 0,
        friendPolicy: user.friendPolicy,
        isPrivate: user.isPrivate,
        isBlocked: true,
        blockedByMe: friendship.blockedByMe,
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
        isFollowing: false,
        friendship,
        _count: { followers: 0, following: 0, posts: 0, events: 0, offerRedemptions: 0, friends: 0 },
      };
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
        isBlocked: false,
        blockedByMe: false,
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
      isBlocked: false,
      blockedByMe: false,
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
      throw new BadRequestException("Can't follow yourself");
    }
    const target = await this.prisma.user.findFirst({
      where: { id: followingId, deletedAt: null, status: { notIn: ['BANNED', 'DELETED'] } },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (await this.friendships.isBlockedEitherWay(followerId, followingId)) {
      throw new ForbiddenException('Cannot follow this user');
    }

    // Idempotent: already following → return current state, no notification.
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { id: true },
    });
    if (existing) return { ok: true, isFollowing: true };

    let isNew = true;
    try {
      await this.prisma.follow.create({ data: { followerId, followingId } });
    } catch (err: any) {
      // Race between two taps → unique constraint. Treat as already following.
      if (err?.code === 'P2002') isNew = false;
      else throw err;
    }
    this.realtime.toUsers([followerId, followingId], 'user', 'updated', { id: followingId, data: { follow: true, by: followerId } });

    // Only notify when the follow row was actually created. Otherwise
    // re-clicking "follow" would re-spam the user.
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
    // Idempotent: deleteMany is a no-op when there is nothing to remove.
    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    if (count > 0) {
      this.realtime.toUsers([followerId, followingId], 'user', 'updated', { id: followingId, data: { follow: false, by: followerId } });
    }
    return { ok: true, isFollowing: false };
  }

  private static readonly FOLLOW_USER_SELECT = {
    id: true,
    isPrivate: true,
    profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
  } as const;

  private clampPage(page?: number, limit?: number) {
    return {
      page: Math.max(1, page || 1),
      limit: Math.min(Math.max(1, limit || 30), 100),
    };
  }

  /** Paginated followers of `userId` → `{ data, meta }`. */
  async listFollowers(userId: string, page: number, limit: number, viewerId?: string) {
    // Audit fix: si la cuenta es privada, solo el dueno + sus followers /
    // amigos pueden ver el listado de seguidores. Antes era @Public abierto.
    await this.assertCanViewFollowList(userId, viewerId);
    const p = this.clampPage(page, limit);
    const where = { followingId: userId };
    const [total, rows] = await Promise.all([
      this.prisma.follow.count({ where }),
      this.prisma.follow.findMany({
        where,
        include: { follower: { select: UsersService.FOLLOW_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
    ]);
    return paginate(rows.map((r) => ({ ...r.follower, since: r.createdAt })), total, p.page, p.limit);
  }

  /** Paginated accounts `userId` follows → `{ data, meta }`. */
  async listFollowing(userId: string, page: number, limit: number, viewerId?: string) {
    await this.assertCanViewFollowList(userId, viewerId);
    const p = this.clampPage(page, limit);
    const where = { followerId: userId };
    const [total, rows] = await Promise.all([
      this.prisma.follow.count({ where }),
      this.prisma.follow.findMany({
        where,
        include: { following: { select: UsersService.FOLLOW_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
    ]);
    return paginate(rows.map((r) => ({ ...r.following, since: r.createdAt })), total, p.page, p.limit);
  }

  /**
   * Paginated friends of `userId` → `{ data, meta }`.
   * `mutual` → only friends the viewer shares with them. Same privacy rule as
   * followers/following (owner / follower / friend can see a private list).
   */
  async listFriends(userId: string, viewerId: string | undefined, page: number, limit: number, mutual = false) {
    await this.assertCanViewFollowList(userId, viewerId);
    const p = this.clampPage(page, limit);
    return this.friendships.listFriendsOf(userId, viewerId, p.page, p.limit, mutual);
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
    if (viewerId && viewerId !== targetId) {
      // Un usuario bloqueado (en cualquier direccion) no ve listas ajenas.
      if (await this.friendships.isBlockedEitherWay(viewerId, targetId)) {
        throw new ForbiddenException('You are blocked from viewing this user');
      }
    }
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

  /**
   * Saved items with the target hydrated per type. Rows whose target no
   * longer exists (deleted post/event/offer/venue) are dropped so the client
   * never renders a dead card.
   */
  async listSaved(userId: string, type?: string) {
    const rows = await this.prisma.savedItem.findMany({
      where: { userId, ...(type ? { type: type.toUpperCase() as SavedItemType } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (rows.length === 0) return [];

    const idsOf = (t: SavedItemType) => rows.filter((r) => r.type === t).map((r) => r.targetId);
    const postIds = idsOf(SavedItemType.POST);
    const eventIds = idsOf(SavedItemType.EVENT);
    const offerIds = idsOf(SavedItemType.OFFER);
    const venueIds = idsOf(SavedItemType.VENUE);

    const [posts, events, offers, venues] = await Promise.all([
      postIds.length
        ? this.prisma.post.findMany({
            where: { id: { in: postIds }, deletedAt: null, status: { notIn: ['DELETED', 'HIDDEN', 'REJECTED'] } },
            select: {
              id: true, content: true, imageUrl: true, mediaUrls: true, createdAt: true,
              user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            },
          })
        : Promise.resolve([]),
      eventIds.length
        ? this.prisma.event.findMany({
            where: { id: { in: eventIds } },
            select: {
              id: true, title: true, imageUrl: true, coverUrl: true, startDate: true, status: true,
              venue: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      offerIds.length
        ? this.prisma.offer.findMany({
            where: { id: { in: offerIds } },
            select: { id: true, title: true, imageUrl: true, status: true, venue: { select: { name: true } } },
          })
        : Promise.resolve([]),
      venueIds.length
        ? this.prisma.venue.findMany({
            where: { id: { in: venueIds } },
            select: { id: true, name: true, coverUrl: true, imageUrl: true, city: true },
          })
        : Promise.resolve([]),
    ]);

    const postMap = new Map(posts.map((p) => [p.id, p]));
    const eventMap = new Map(events.map((e) => [e.id, e]));
    const offerMap = new Map(offers.map((o) => [o.id, o]));
    const venueMap = new Map(venues.map((v) => [v.id, v]));

    const out: any[] = [];
    for (const r of rows) {
      let target: any = null;
      switch (r.type) {
        case SavedItemType.POST: {
          const p = postMap.get(r.targetId);
          if (!p) continue;
          const media = (p.mediaUrls ?? []).filter((u) => !u.startsWith('__'));
          target = {
            id: p.id,
            content: p.content,
            imageUrl: p.imageUrl ?? media[0] ?? null,
            mediaUrls: media,
            createdAt: p.createdAt,
            author: {
              id: p.user.id,
              firstName: p.user.profile?.firstName ?? null,
              lastName: p.user.profile?.lastName ?? null,
              avatarUrl: p.user.profile?.avatarUrl ?? null,
            },
          };
          break;
        }
        case SavedItemType.EVENT: {
          const e = eventMap.get(r.targetId);
          if (!e) continue;
          target = {
            id: e.id,
            title: e.title,
            imageUrl: e.imageUrl ?? e.coverUrl ?? null,
            startDate: e.startDate,
            status: e.status,
            venue: { name: e.venue?.name ?? null },
          };
          break;
        }
        case SavedItemType.OFFER: {
          const o = offerMap.get(r.targetId);
          if (!o) continue;
          target = { id: o.id, title: o.title, imageUrl: o.imageUrl ?? null, status: o.status, venue: { name: o.venue?.name ?? null } };
          break;
        }
        case SavedItemType.VENUE: {
          const v = venueMap.get(r.targetId);
          if (!v) continue;
          target = { id: v.id, name: v.name, coverUrl: v.coverUrl ?? v.imageUrl ?? null, city: v.city };
          break;
        }
        default:
          continue;
      }
      out.push({ ...r, target });
    }
    return out;
  }

  async toggleSave(userId: string, type: string, targetId: string) {
    const typeEnum = type.toUpperCase() as SavedItemType;
    if (!Object.values(SavedItemType).includes(typeEnum)) {
      throw new BadRequestException('Invalid saved item type');
    }
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
