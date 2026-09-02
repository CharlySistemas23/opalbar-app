// ─────────────────────────────────────────────
//  Admin action DTOs
//
//  The global ValidationPipe runs with `whitelist + forbidNonWhitelisted`, so
//  inline `@Body() body: {…}` object types skip validation entirely (no
//  class metadata). Every admin body that mutates data goes through one of
//  these classes instead, so bad enums / missing fields fail at the boundary
//  with a 400 instead of a Prisma 500.
// ─────────────────────────────────────────────
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PostStatus,
  ReportStatus,
  TicketCategory,
  TicketPriority,
  UserRole,
} from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// ── Posts moderation ─────────────────────────

export class AdminPostsFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({ description: 'Only posts with ≥1 PENDING report (1/true)' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 1)
  @IsBoolean()
  reported?: boolean;
}

export class UpdatePostStatusDto {
  @ApiProperty({ enum: [PostStatus.PUBLISHED, PostStatus.HIDDEN, PostStatus.REJECTED] })
  @IsIn([PostStatus.PUBLISHED, PostStatus.HIDDEN, PostStatus.REJECTED])
  status: PostStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PinPostDto {
  @ApiProperty()
  @IsBoolean()
  pinned: boolean;
}

export class RejectPostDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BulkPostIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ── Reports ──────────────────────────────────

export class AdminReportsFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: [...Object.values(ReportStatus), 'ALL'], default: ReportStatus.PENDING })
  @IsOptional()
  @IsIn([...Object.values(ReportStatus), 'ALL'])
  status?: ReportStatus | 'ALL';
}

export class ResolveReportDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;
}

// ── Users ────────────────────────────────────

export class CreateUserManuallyDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string;
}

export class AdjustPointsDto {
  @ApiProperty({ description: 'Non-zero integer delta' })
  @Type(() => Number)
  @IsInt()
  @Min(-100000)
  @Max(100000)
  delta: number;

  @ApiProperty({ minLength: 3, maxLength: 300 })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}

export class BanUserDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ── GDPR ─────────────────────────────────────

export class GdprProcessDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';
}

// ── Broadcast ────────────────────────────────

export class BroadcastPushDto {
  @ApiProperty({ minLength: 3, maxLength: 200 }) @IsString() @MinLength(3) @MaxLength(200) title: string;
  @ApiProperty({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) body: string;
  @ApiPropertyOptional({ enum: ['ALL', 'ADMINS'] }) @IsOptional() @IsIn(['ALL', 'ADMINS']) audience?: 'ALL' | 'ADMINS';
}

// ── Loyalty ──────────────────────────────────

export class CreateLoyaltyLevelDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(50) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) nameEn?: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' }) slug: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) minPoints: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPoints?: number | null;
  @ApiProperty() @IsHexColor() color: string;
  @ApiProperty() @IsString() @MaxLength(50) icon: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) benefits?: string[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateLoyaltyLevelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(50) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) nameEn?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' }) slug?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPoints?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPoints?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) benefits?: string[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Feature flags ────────────────────────────

export class CreateFeatureFlagDto {
  @ApiProperty() @IsString() @Matches(/^[a-z][a-z0-9_]{2,49}$/) key: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string | null;
}

// ── Support ──────────────────────────────────

export class CreateTicketForUserDto {
  @ApiProperty() @IsString() @IsNotEmpty() userId: string;
  @ApiProperty({ minLength: 3, maxLength: 200 }) @IsString() @MinLength(3) @MaxLength(200) subject: string;
  @ApiProperty({ minLength: 3, maxLength: 2000 }) @IsString() @MinLength(3) @MaxLength(2000) description: string;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional({ enum: TicketCategory }) @IsOptional() @IsEnum(TicketCategory) category?: TicketCategory;
}

// ── Messages ─────────────────────────────────

export class SendMessageAsAdminDto {
  @ApiProperty() @IsString() @IsNotEmpty() userId: string;
  @ApiProperty({ minLength: 1, maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) content: string;
}

// ── Reviews ──────────────────────────────────

export class BulkReviewIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];
}

// ── Venue blocks ─────────────────────────────

export class VenueBlockDto {
  @ApiProperty({ example: '2026-09-10T19:00:00.000Z' }) @IsDateString() startsAt: string;
  @ApiProperty({ example: '2026-09-10T23:00:00.000Z' }) @IsDateString() endsAt: string;
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

// ── Reservations ─────────────────────────────

export class CreateManualReservationDto {
  @ApiProperty() @IsString() @IsNotEmpty() userId: string;
  @ApiProperty() @IsString() @IsNotEmpty() venueId: string;
  @ApiProperty({ example: '2026-09-10' }) @IsDateString() date: string;
  @ApiProperty({ example: '20:00' }) @IsString() @Matches(/^\d{2}:\d{2}$/) timeSlot: string;
  @ApiProperty({ minimum: 1, maximum: 50 }) @Type(() => Number) @IsInt() @Min(1) @Max(50) partySize: number;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) internalNotes?: string;
}
