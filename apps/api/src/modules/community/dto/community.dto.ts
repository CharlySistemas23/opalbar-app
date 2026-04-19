import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReactionType, ReportReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreatePostDto {
  @ApiProperty({ maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) content: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) content?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
}

export class CreateCommentDto {
  @ApiProperty({ maxLength: 1000 }) @IsString() @MinLength(1) @MaxLength(1000) content: string;
  @ApiPropertyOptional({ description: 'Parent comment ID for replies' }) @IsOptional() @IsString() parentId?: string;
}

export class ReactDto {
  @ApiProperty({ enum: ReactionType }) @IsEnum(ReactionType) type: ReactionType;
}

export class CreateReportDto {
  @ApiProperty({ enum: ReportReason }) @IsEnum(ReportReason) reason: ReportReason;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class PostFilterDto extends PaginationDto {}
