import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CheckinService } from './checkin.service';
import { CheckinCodeDto } from './dto/checkin.dto';

@ApiTags('Check-in')
@ApiBearerAuth()
@Controller('checkin')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
export class CheckinController {
  constructor(private readonly service: CheckinService) {}

  @Get('lookup/reservation/:code')
  @ApiOperation({ summary: 'Preview a reservation by QR code or short suffix (no state change)' })
  lookupReservation(@Param('code') code: string) {
    return this.service.lookupReservation(code);
  }

  @Get('lookup/redemption/:code')
  @ApiOperation({ summary: 'Preview a redemption by QR code or short suffix (no state change)' })
  lookupRedemption(@Param('code') code: string) {
    return this.service.lookupRedemption(code);
  }

  @Post('reservation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark reservation as seated (awards points)' })
  checkinReservation(@Body() dto: CheckinCodeDto, @CurrentUser() user: User) {
    return this.service.checkinReservation(dto.code, user.id);
  }

  @Post('redemption')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark offer redemption as used' })
  checkinRedemption(@Body() dto: CheckinCodeDto, @CurrentUser() user: User) {
    return this.service.checkinRedemption(dto.code, user.id);
  }
}
