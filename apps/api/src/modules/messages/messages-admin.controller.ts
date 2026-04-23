import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MessagesService } from './messages.service';

@ApiTags('Admin · Messages')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
@Controller('admin/messages')
export class MessagesAdminController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('threads')
  @ApiOperation({ summary: 'List all conversations in the platform (moderation)' })
  listThreads(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.messagesService.adminListThreads(search, limit ? parseInt(limit, 10) : 100);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get any thread detail (moderation)' })
  getThread(@Param('id') id: string) {
    return this.messagesService.adminGetThread(id);
  }

  @Get('threads/:id/messages')
  @ApiOperation({ summary: 'Read full message history including deleted (moderation)' })
  listMessages(@Param('id') id: string) {
    return this.messagesService.adminListMessages(id);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete any message (moderation action)' })
  deleteMessage(@Param('messageId') messageId: string, @CurrentUser() admin: User) {
    return this.messagesService.adminDeleteMessage(messageId, admin.id);
  }
}
