import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FriendPolicy, User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FriendshipsService } from './friendships.service';

@ApiTags('Friendships')
@ApiBearerAuth()
@Controller('friendships')
export class FriendshipsController {
  constructor(private readonly friendships: FriendshipsService) {}

  @Get()
  @ApiOperation({ summary: 'List my accepted friends' })
  list(@CurrentUser() me: User, @Query('limit') limit?: string) {
    return this.friendships.listFriends(me.id, parseInt(limit || '100', 10));
  }

  @Get('requests')
  @ApiOperation({ summary: 'List incoming friend requests (tab=main|filtered)' })
  incoming(
    @CurrentUser() me: User,
    @Query('tab') tab?: string,
    @Query('limit') limit?: string,
  ) {
    const t: 'main' | 'filtered' = tab === 'filtered' ? 'filtered' : 'main';
    return this.friendships.listIncoming(me.id, t, parseInt(limit || '50', 10));
  }

  @Get('requests/counts')
  @ApiOperation({ summary: 'Counts for the requests inbox tabs' })
  counts(@CurrentUser() me: User) {
    return this.friendships.incomingCounts(me.id);
  }

  @Get('outgoing')
  @ApiOperation({ summary: 'List my pending outgoing requests' })
  outgoing(@CurrentUser() me: User, @Query('limit') limit?: string) {
    return this.friendships.listOutgoing(me.id, parseInt(limit || '50', 10));
  }

  @Post('request/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a friend request to a user' })
  request(@CurrentUser() me: User, @Param('userId') userId: string) {
    return this.friendships.sendRequest(me.id, userId);
  }

  @Post(':friendshipId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an incoming friend request' })
  accept(@CurrentUser() me: User, @Param('friendshipId') id: string) {
    return this.friendships.accept(me.id, id);
  }

  @Post(':friendshipId/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline an incoming friend request' })
  decline(@CurrentUser() me: User, @Param('friendshipId') id: string) {
    return this.friendships.decline(me.id, id);
  }

  @Delete('request/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel my outgoing request to user' })
  cancel(@CurrentUser() me: User, @Param('userId') userId: string) {
    return this.friendships.cancel(me.id, userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove (unfriend) a user' })
  remove(@CurrentUser() me: User, @Param('userId') userId: string) {
    return this.friendships.remove(me.id, userId);
  }

  @Patch('me/policy')
  @ApiOperation({ summary: 'Update friend-request policy (EVERYONE | FRIENDS_OF_FRIENDS | NONE)' })
  updatePolicy(@CurrentUser() me: User, @Body('policy') policy: FriendPolicy) {
    const allowed = Object.values(FriendPolicy);
    if (!policy || !allowed.includes(policy)) {
      throw new BadRequestException('policy must be EVERYONE | FRIENDS_OF_FRIENDS | NONE');
    }
    return this.friendships.updateFriendPolicy(me.id, policy);
  }
}
