import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('threads')
  @ApiOperation({ summary: 'List my conversations' })
  listThreads(@CurrentUser() me: User) {
    return this.messagesService.listThreads(me.id);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List pending message requests sent to me' })
  listRequests(@CurrentUser() me: User) {
    return this.messagesService.listRequests(me.id);
  }

  @Get('requests/count')
  @ApiOperation({ summary: 'Count of pending requests (for inbox badge)' })
  requestsCount(@CurrentUser() me: User) {
    return this.messagesService.requestsCount(me.id);
  }

  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending request' })
  acceptRequest(@CurrentUser() me: User, @Param('id') id: string) {
    return this.messagesService.acceptRequest(me.id, id);
  }

  @Post('requests/:id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a request (removes the thread)' })
  declineRequest(@CurrentUser() me: User, @Param('id') id: string) {
    return this.messagesService.declineRequest(me.id, id);
  }

  @Post('requests/:id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block sender (thread stays as BLOCKED)' })
  blockRequest(@CurrentUser() me: User, @Param('id') id: string) {
    return this.messagesService.blockRequest(me.id, id);
  }

  @Post('threads')
  @ApiOperation({ summary: 'Create or fetch thread with another user' })
  createThread(@CurrentUser() me: User, @Body('userId') userId: string) {
    return this.messagesService.getOrCreateThread(me.id, userId);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get thread summary' })
  getThread(@CurrentUser() me: User, @Param('id') id: string) {
    return this.messagesService.getThread(me.id, id);
  }

  @Get('threads/:id/messages')
  @ApiOperation({ summary: 'List messages in thread (paginated)' })
  listMessages(
    @CurrentUser() me: User,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.listMessages(me.id, id, cursor, parseInt(limit || '50', 10));
  }

  @Post('threads/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message (text, image, or sticker)' })
  sendMessage(
    @CurrentUser() me: User,
    @Param('id') id: string,
    @Body() body: { content?: string; imageUrl?: string; stickerKey?: string },
  ) {
    return this.messagesService.sendMessage(me.id, id, {
      content: body.content,
      imageUrl: body.imageUrl,
      stickerKey: body.stickerKey,
    });
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a message I sent' })
  deleteMessage(@CurrentUser() me: User, @Param('messageId') messageId: string) {
    return this.messagesService.deleteMessage(me.id, messageId);
  }
}
