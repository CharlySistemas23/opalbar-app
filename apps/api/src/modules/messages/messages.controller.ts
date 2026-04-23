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
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(
    @CurrentUser() me: User,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.messagesService.sendMessage(me.id, id, content);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a message I sent' })
  deleteMessage(@CurrentUser() me: User, @Param('messageId') messageId: string) {
    return this.messagesService.deleteMessage(me.id, messageId);
  }
}
