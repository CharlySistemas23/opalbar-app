import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SupportService } from './support.service';
import { CreateTicketDto, SendMessageDto, TicketFilterDto } from './dto/support.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create a support ticket' })
  create(@Body() dto: CreateTicketDto, @CurrentUser('id') userId: string) {
    return this.service.createTicket(dto, userId);
  }

  @Get('tickets/my')
  @ApiOperation({ summary: 'Get my support tickets' })
  getMine(@CurrentUser('id') userId: string, @Query() filter: TicketFilterDto) {
    return this.service.getMyTickets(userId, filter);
  }

  @Get('tickets/:id/messages')
  @ApiOperation({ summary: 'Get ticket messages' })
  getMessages(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.getTicketMessages(id, userId, role);
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Send a message in a ticket' })
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.sendMessage(id, dto, userId, role);
  }

  @Get('quick-replies')
  @ApiOperation({ summary: 'Get quick reply templates (agents)' })
  getQuickReplies() {
    return this.service.getQuickReplies();
  }
}
