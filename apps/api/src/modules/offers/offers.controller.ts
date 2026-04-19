import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OffersService } from './offers.service';
import { CreateOfferDto, OfferFilterDto } from './dto/offer.dto';

@ApiTags('Offers')
@ApiBearerAuth()
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get() @Public() @ApiOperation({ summary: 'List active offers' })
  findAll(@Query() filter: OfferFilterDto) { return this.offersService.findAll(filter); }

  @Get('my') @ApiOperation({ summary: 'Get my offer redemptions' })
  getMyRedemptions(@CurrentUser() user: User) { return this.offersService.getMyRedemptions(user.id); }

  @Get(':id') @Public() @ApiOperation({ summary: 'Get offer detail' })
  findOne(@Param('id') id: string) { return this.offersService.findOne(id); }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new offer (Admin only)' })
  create(@Body() dto: CreateOfferDto, @CurrentUser() user: User) {
    return this.offersService.create(dto, user.id);
  }

  @Post(':id/redeem')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Redeem an offer' })
  redeem(@Param('id') id: string, @CurrentUser() user: User) {
    return this.offersService.redeem(id, user.id);
  }
}
