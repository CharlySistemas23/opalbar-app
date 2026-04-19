import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfferStatus, OfferType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt,
  IsNumber, IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateOfferDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(120) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() titleEn?: string;
  @ApiProperty() @IsString() @MinLength(10) description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() terms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiProperty() @IsString() venueId: string;
  @ApiProperty({ enum: OfferType }) @IsEnum(OfferType) type: OfferType;
  @ApiPropertyOptional() @IsOptional() @IsNumber() discountValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minimumPurchase?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) maxPerUser?: number;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiPropertyOptional({ type: [Number] }) @IsOptional() @IsArray() daysOfWeek?: number[];
  @ApiPropertyOptional() @IsOptional() @IsString() startTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endTime?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isHighlighted?: boolean;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) pointsRequired?: number;
}

export class OfferFilterDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() venueId?: string;
  @ApiPropertyOptional({ enum: OfferType }) @IsOptional() @IsEnum(OfferType) type?: OfferType;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() highlighted?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() date?: string; // filter by active on this date
}
