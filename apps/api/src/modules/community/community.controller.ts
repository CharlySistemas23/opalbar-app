import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CommunityService } from './community.service';
import {
  CreatePostDto, UpdatePostDto, CreateCommentDto,
  ReactDto, CreateReportDto, PostFilterDto,
} from './dto/community.dto';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts') @Public() @ApiOperation({ summary: 'List published community posts' })
  getPosts(@Query() filter: PostFilterDto) { return this.communityService.getPosts(filter); }

  @Get('posts/:id') @Public() @ApiOperation({ summary: 'Get post detail' })
  getPost(@Param('id') id: string) { return this.communityService.getPost(id); }

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

  @Get('posts/:id/comments') @Public() @ApiOperation({ summary: 'Get comments for a post' })
  getComments(@Param('id') id: string) { return this.communityService.getComments(id); }

  @Post('posts/:id/comments') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Comment on a post' })
  createComment(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: CreateCommentDto) {
    return this.communityService.createComment(id, user.id, dto);
  }

  @Delete('comments/:id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Delete a comment' })
  deleteComment(@Param('id') id: string, @CurrentUser() user: User) {
    return this.communityService.deleteComment(id, user.id);
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
}
