import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get() @ApiOperation({ summary: 'Get my notifications with unread count' })
  getNotifications(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    return this.notificationsService.getNotifications(user.id, pagination);
  }

  @Patch(':id/read') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Patch('read-all') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Delete a notification' })
  deleteNotification(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notificationsService.deleteNotification(user.id, id);
  }
}
