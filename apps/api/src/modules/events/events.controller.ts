import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, EventFilterDto } from './dto/event.dto';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List events with filters and pagination' })
  findAll(@Query() filter: EventFilterDto) {
    return this.eventsService.findAll(filter);
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Get all event categories' })
  getCategories() {
    return this.eventsService.getCategories();
  }

  @Get('my')
  @ApiOperation({ summary: 'Get events I have registered for' })
  getMyEvents(@CurrentUser() user: User) {
    return this.eventsService.getMyEvents(user.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get event detail' })
  findOne(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.eventsService.findOne(id, user?.id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Create a new event (Admin only)' })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: User) {
    return this.eventsService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Update an event' })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: User) {
    return this.eventsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel / delete an event' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.eventsService.remove(id, user.id, user.role);
  }

  @Post(':id/attend')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register attendance for an event' })
  register(@Param('id') id: string, @CurrentUser() user: User) {
    return this.eventsService.register(id, user.id);
  }

  @Delete(':id/attend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel attendance for an event' })
  cancelAttendance(@Param('id') id: string, @CurrentUser() user: User) {
    return this.eventsService.cancelAttendance(id, user.id);
  }
}
