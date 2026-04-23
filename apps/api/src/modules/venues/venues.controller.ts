import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { VenuesService } from './venues.service';
import { UpdateVenueDto } from './dto/update-venue.dto';

@ApiTags('Venues')
@ApiBearerAuth()
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active venues' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('city') city?: string,
  ) {
    return this.venuesService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      city,
    });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get venue detail' })
  findOne(@Param('id') id: string) {
    return this.venuesService.findOne(id);
  }

  @Patch(':id/config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update venue reservation config (Admin only)' })
  updateConfig(
    @Param('id') id: string,
    @Body() body: {
      openTime?: string;
      closeTime?: string;
      reservationCapacity?: number;
      reservationsEnabled?: boolean;
      slotMinutes?: number;
    },
  ) {
    return this.venuesService.updateConfig(id, body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update venue fields (Admin only)' })
  update(@Param('id') id: string, @Body() body: UpdateVenueDto) {
    return this.venuesService.update(id, body);
  }
}
