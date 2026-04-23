import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { StoryScope, User, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommunityService } from './community.service';
import {
  CreatePostDto, UpdatePostDto, CreateCommentDto,
  ReactDto, CreateReportDto, PostFilterDto,
  CreateStoryDto, StoryFeedFilterDto,
} from './dto/community.dto';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts') @Public() @SkipThrottle() @ApiOperation({ summary: 'List published community posts' })
  getPosts(@Query() filter: PostFilterDto, @CurrentUser() user?: User) {
    return this.communityService.getPosts(filter, user?.id);
  }

  @Get('posts/:id') @Public() @SkipThrottle() @ApiOperation({ summary: 'Get post detail' })
  getPost(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.communityService.getPost(id, user?.id);
  }

  @Post('posts') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Create a new post' })
  createPost(@CurrentUser() user: User, @Body() dto: CreatePostDto) {
    return this.communityService.createPost(user.id, dto);
  }

  @Patch('posts/:id') @ApiOperation({ summary: 'Update my post' })
  updatePost(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: UpdatePostDto) {
    return this.communityService.updatePost(id, user.id, dto);
  }

  @Delete('posts/:id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Delete my post' })
  deletePost(@Param('id') id: string, @CurrentUser() user: User) {
    return this.communityService.deletePost(id, user.id);
  }

  @Get('posts/:id/comments') @Public() @SkipThrottle() @ApiOperation({ summary: 'Get comments for a post' })
  getComments(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.communityService.getComments(id, user?.id);
  }

  @Post('posts/:id/comments') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Comment on a post' })
  createComment(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: CreateCommentDto) {
    return this.communityService.createComment(id, user.id, dto);
  }

  @Delete('comments/:id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Delete a comment' })
  deleteComment(@Param('id') id: string, @CurrentUser() user: User) {
    return this.communityService.deleteComment(id, user.id);
  }

  @Post('comments/:id/like') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Toggle like on a comment' })
  toggleCommentLike(@Param('id') id: string, @CurrentUser() user: User) {
    return this.communityService.toggleCommentLike(id, user.id);
  }

  @Post('posts/:id/react') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'React to a post' })
  reactToPost(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: ReactDto) {
    return this.communityService.reactToPost(id, user.id, dto);
  }

  @Post('posts/:id/report') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Report a post' })
  reportPost(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.communityService.reportContent('POST', id, user.id, dto);
  }

  @Post('comments/:id/report') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Report a comment' })
  reportComment(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.communityService.reportContent('COMMENT', id, user.id, dto);
  }

  @Post('users/:id/report') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Report a user' })
  reportUser(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.communityService.reportContent('USER', id, user.id, dto);
  }

  @Get('ranking') @Public() @ApiOperation({ summary: 'Community leaderboard by points' })
  getRanking() { return this.communityService.getCommunityRanking(); }

  // ── Stories ─────────────────────────────────
  @Get('stories') @Public() @SkipThrottle()
  @ApiOperation({ summary: 'Active stories: { venue, personal } — personal filterable by scope' })
  getStories(@Query() filter: StoryFeedFilterDto, @CurrentUser() user?: User) {
    return this.communityService.getStories(user?.id, filter.scope);
  }

  @Get('users/:id/stories') @Public() @SkipThrottle()
  @ApiOperation({ summary: 'Active personal stories for a specific user' })
  getUserStories(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.communityService.getUserStories(id, user?.id);
  }

  @Post('stories') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Create a personal story' })
  createStory(@CurrentUser() user: User, @Body() dto: CreateStoryDto) {
    return this.communityService.createStory(user.id, dto);
  }

  @Delete('stories/:id') @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a story (owner or admin)' })
  deleteStory(@Param('id') id: string, @CurrentUser() user: User) {
    return this.communityService.deleteStory(id, { id: user.id, role: user.role });
  }

  @Post('stories/:id/view') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Mark a story as viewed' })
  viewStory(@Param('id') id: string, @CurrentUser() user: User) {
    return this.communityService.markStoryViewed(id, user.id);
  }
}

@ApiTags('Admin Community')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
@Controller('admin/community')
export class AdminCommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('stories')
  @ApiOperation({ summary: 'List active venue stories (OPAL BAR PV)' })
  listVenueStories() {
    return this.communityService.listVenueStories();
  }

  @Post('stories') @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a venue story (shown as OPAL BAR PV)' })
  createVenueStory(@CurrentUser() user: User, @Body() dto: CreateStoryDto) {
    return this.communityService.createStory(user.id, dto, StoryScope.VENUE);
  }
}
