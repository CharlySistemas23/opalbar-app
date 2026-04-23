import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CheckinService } from './checkin.service';

@ApiTags('Check-in')
@ApiBearerAuth()
@Controller('checkin')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
export class CheckinController {
  constructor(private readonly service: CheckinService) {}

  @Get('lookup/reservation/:code')
  @ApiOperation({ summary: 'Preview a reservation by QR code (no state change)' })
  lookupReservation(@Param('code') code: string) {
    return this.service.lookupReservation(code);
  }

  @Get('lookup/redemption/:code')
  @ApiOperation({ summary: 'Preview a redemption by QR code (no state change)' })
  lookupRedemption(@Param('code') code: string) {
    return this.service.lookupRedemption(code);
  }

  @Post('reservation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark reservation as seated' })
  checkinReservation(@Body('code') code: string, @CurrentUser() user: User) {
    return this.service.checkinReservation(code, user.id);
  }

  @Post('redemption')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark offer redemption as used' })
  checkinRedemption(@Body('code') code: string, @CurrentUser() user: User) {
    return this.service.checkinRedemption(code, user.id);
  }
}
