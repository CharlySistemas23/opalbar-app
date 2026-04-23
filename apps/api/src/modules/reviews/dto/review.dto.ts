import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ReviewStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateReviewDto {
  @ApiProperty() @IsString() venueId: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) body?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) pros?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) cons?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() visitDate?: string;
}

export class UpdateReviewDto extends PartialType(CreateReviewDto) {}

export class ReviewFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReviewStatus }) @IsOptional() @IsEnum(ReviewStatus) status?: ReviewStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() venueId?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @IsOptional() @IsInt() @Min(1) @Max(5) minRating?: number;
}

export class ModerationReviewDto {
  @ApiProperty({ enum: ReviewStatus }) @IsEnum(ReviewStatus) status: ReviewStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() rejectionReason?: string;
}
