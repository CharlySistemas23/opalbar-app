import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReactionType, ReportReason } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// One mention attached at create-time. Coords are normalized [0,1]; omit both
// for caption-only mentions ("foto con @user").
export class MentionInputDto {
  @ApiProperty() @IsString() userId: string;
  @ApiPropertyOptional({ description: 'Normalized x coord (0..1) for photo tags' })
  @IsOptional() @IsNumber() @Min(0) @Max(1) x?: number;
  @ApiPropertyOptional({ description: 'Normalized y coord (0..1) for photo tags' })
  @IsOptional() @IsNumber() @Min(0) @Max(1) y?: number;
}

export enum CommunityFeedScope {
  FOR_YOU = 'forYou',
  FOLLOWING = 'following',
}

export enum PostSurface {
  COMMUNITY = 'community',
  WALL = 'wall',
  ALL = 'all',
}

export class CreatePostDto {
  @ApiProperty({ maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) content: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional({ enum: [PostSurface.COMMUNITY, PostSurface.WALL], description: 'Publish destination' })
  @IsOptional()
  @IsEnum(PostSurface)
  surface?: PostSurface;

  @ApiPropertyOptional({ type: [MentionInputDto], description: 'Users mentioned in the post' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionInputDto)
  mentions?: MentionInputDto[];
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

export class CreateStoryDto {
  @ApiProperty({ description: 'Image URL or data URI' })
  @IsString()
  @MaxLength(2_000_000) // allows base64 data URIs; capped for safety
  mediaUrl: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @ApiPropertyOptional({ type: [MentionInputDto], description: 'Users tagged in the story' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionInputDto)
  mentions?: MentionInputDto[];
}

export enum StoryFeedScope {
  FOR_YOU = 'forYou',
  FOLLOWING = 'following',
}

export class StoryFeedFilterDto {
  @ApiPropertyOptional({ enum: StoryFeedScope, description: 'Personal feed scope' })
  @IsOptional()
  @IsEnum(StoryFeedScope)
  scope?: StoryFeedScope;
}

export class PostFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter posts by author userId' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: CommunityFeedScope, description: 'Feed scope' })
  @IsOptional()
  @IsEnum(CommunityFeedScope)
  scope?: CommunityFeedScope;

  @ApiPropertyOptional({ enum: PostSurface, description: 'Filter by destination surface' })
  @IsOptional()
  @IsEnum(PostSurface)
  surface?: PostSurface;
}
