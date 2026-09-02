import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber,
  IsOptional, IsString, Matches, MaxLength, Min, MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Query-string booleans arrive as strings. `@Type(() => Boolean)` turned
 * `"false"` into `true` (non-empty string), so `?isFree=false` filtered for
 * free events. Only the literal `true`/`"true"` counts as true now.
 */
const toBool = ({ value }: { value: unknown }) => value === true || value === 'true';

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex color' }) color?: string;
}

export class CreateEventDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(120) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() titleEn?: string;
  @ApiProperty() @IsString() @MinLength(10) description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiProperty() @IsString() venueId: string;
  @ApiProperty() @IsString() categoryId: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() doorsOpenAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxCapacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() price?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isFree?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional({ default: 50 }) @IsOptional() @IsInt() @Min(0) pointsReward?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isHighlighted?: boolean;
  @ApiPropertyOptional({ enum: EventStatus }) @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
}

export class UpdateEventDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() titleEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venueId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() doorsOpenAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxCapacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFree?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() price?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() pointsReward?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isHighlighted?: boolean;
  @ApiPropertyOptional({ enum: EventStatus }) @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
}

export class EventFilterDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venueId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @Transform(toBool) @IsBoolean() isFree?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @Transform(toBool) @IsBoolean() highlighted?: boolean;
  @ApiPropertyOptional({ enum: EventStatus }) @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() includeAll?: boolean;
}
