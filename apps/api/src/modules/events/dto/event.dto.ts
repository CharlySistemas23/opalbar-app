import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber,
  IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

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
  @ApiPropertyOptional({ default: false }) @IsOptional() @Type(() => Boolean) @IsBoolean() isFree?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @Type(() => Boolean) @IsBoolean() highlighted?: boolean;
  @ApiPropertyOptional({ enum: EventStatus }) @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
}
