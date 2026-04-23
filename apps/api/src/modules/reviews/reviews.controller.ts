import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReviewFilterDto, UpdateReviewDto } from './dto/review.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a venue review' })
  create(@Body() dto: CreateReviewDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Public()
  @Get('venue/:venueId')
  @ApiOperation({ summary: 'Get reviews for a venue' })
  findByVenue(@Param('venueId') venueId: string, @Query() filter: ReviewFilterDto) {
    return this.service.findByVenue(venueId, filter);
  }

  @Public()
  @Get('venue/:venueId/summary')
  @ApiOperation({ summary: 'Get rating summary for a venue' })
  getSummary(@Param('venueId') venueId: string) {
    return this.service.getVenueRatingSummary(venueId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my reviews' })
  findMine(@CurrentUser('id') userId: string) {
    return this.service.findMine(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update my review' })
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete my review' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.service.remove(id, userId, role);
  }
}
