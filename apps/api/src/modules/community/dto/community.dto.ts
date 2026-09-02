import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReactionType, ReportReason } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

export const MAX_POST_MEDIA = 4;

export class CreatePostDto {
  // Text is required only when the post carries no media (image-only posts
  // are allowed). When media is present the text, if any, is still capped.
  @ApiPropertyOptional({ maxLength: 2000 })
  @ValidateIf((o) => !!o.content || (!o.imageUrl && !(o.mediaUrls?.length)))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;

  @ApiPropertyOptional({ type: [String], description: 'Up to 4 image URLs (first one mirrors imageUrl)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_MEDIA)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  mediaUrls?: string[];

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

  @ApiPropertyOptional({ type: [String], description: 'Replace the media set (max 4)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_MEDIA)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  mediaUrls?: string[];

  @ApiPropertyOptional({ type: [MentionInputDto], description: 'Replace the mention set' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionInputDto)
  mentions?: MentionInputDto[];
}

// Emoji reactions (posts, comments, stories). One grapheme cluster can span a
// few UTF-16 code units (e.g. "❤️" = 2), so allow up to 16.
export class EmojiDto {
  @ApiProperty({ example: '❤️' }) @IsString() @Length(1, 16) emoji: string;
}

export class CreateCommentDto {
  @ApiProperty({ maxLength: 1000 }) @IsString() @MinLength(1) @MaxLength(1000) content: string;
  @ApiPropertyOptional({ description: 'Parent comment ID for replies' }) @IsOptional() @IsString() parentId?: string;

  @ApiPropertyOptional({ type: [MentionInputDto], description: 'Users mentioned in the comment' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionInputDto)
  mentions?: MentionInputDto[];
}

export class UpdateCommentDto {
  @ApiProperty({ maxLength: 1000 }) @IsString() @MinLength(1) @MaxLength(1000) content: string;
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
