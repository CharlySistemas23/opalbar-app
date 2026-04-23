import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, ReservationFilterDto, UpdateReservationStatusDto } from './dto/reservation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a reservation' })
  create(@Body() dto: CreateReservationDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my reservations' })
  findMine(@CurrentUser('id') userId: string, @Query() filter: ReservationFilterDto) {
    return this.service.findMine(userId, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reservation detail' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.service.findOne(id, userId, role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modify my reservation (date / party size / notes)' })
  modify(
    @Param('id') id: string,
    @Body() dto: { date?: string; partySize?: number; notes?: string },
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.modify(id, dto, userId, role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel my reservation' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.service.cancel(id, userId, role);
  }
}
