import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MentionPolicy, MentionTargetType, User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MentionsService } from './mentions.service';

@ApiTags('Mentions')
@ApiBearerAuth()
@Controller('mentions')
export class MentionsController {
  constructor(private readonly mentions: MentionsService) {}

  @Get('pending')
  @ApiOperation({ summary: 'List pending tag requests waiting for my approval' })
  pending(@CurrentUser() me: User, @Query('limit') limit?: string) {
    return this.mentions.listPendingApprovals(me.id, parseInt(limit || '50', 10));
  }

  @Get('pending/count')
  @ApiOperation({ summary: 'Number of pending tag requests' })
  pendingCount(@CurrentUser() me: User) {
    return this.mentions.pendingCount(me.id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending tag (target user only)' })
  approve(@CurrentUser() me: User, @Param('id') id: string) {
    return this.mentions.approveMention(me.id, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending tag (target user only)' })
  reject(@CurrentUser() me: User, @Param('id') id: string) {
    return this.mentions.rejectMention(me.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an existing tag (author or target only)' })
  remove(@CurrentUser() me: User, @Param('id') id: string) {
    return this.mentions.removeMention(me.id, id);
  }

  @Get('tagged/:userId')
  @Public()
  @ApiOperation({ summary: 'Etiquetado en — feed of items where userId is tagged' })
  tagged(
    @Param('userId') userId: string,
    @CurrentUser() viewer: User | undefined,
    @Query('limit') limit?: string,
  ) {
    return this.mentions.listTaggedFeed(userId, viewer?.id, parseInt(limit || '30', 10));
  }

  @Get('target/:targetType/:targetId')
  @Public()
  @ApiOperation({ summary: 'List approved mentions on a specific post/story (for face-tag overlay)' })
  forTarget(@Param('targetType') targetType: string, @Param('targetId') targetId: string) {
    const t = targetType.toUpperCase();
    if (t !== 'POST' && t !== 'STORY') {
      throw new BadRequestException('targetType must be POST or STORY');
    }
    return this.mentions.listForTarget(t as MentionTargetType, targetId);
  }

  @Patch('me/policy')
  @ApiOperation({ summary: 'Update my mention policy (EVERYONE | FRIENDS_OF_FRIENDS | FRIENDS_ONLY | NONE)' })
  updatePolicy(@CurrentUser() me: User, @Body('policy') policy: MentionPolicy) {
    const allowed = Object.values(MentionPolicy);
    if (!policy || !allowed.includes(policy)) {
      throw new BadRequestException('policy must be EVERYONE | FRIENDS_OF_FRIENDS | FRIENDS_ONLY | NONE');
    }
    return this.mentions.updateMentionPolicy(me.id, policy);
  }
}
