import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ContentMonitorService } from './content-monitor.service';
import { CreateFilterRuleDto, FlagFilterDto, ReviewFlagDto, RuleFilterDto, UpdateFilterRuleDto } from './dto/content-monitor.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Content Monitor')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
@Controller('content-monitor')
export class ContentMonitorController {
  constructor(private readonly service: ContentMonitorService) {}

  @Get('flags')
  @ApiOperation({ summary: 'List content flags' })
  getFlags(@Query() filter: FlagFilterDto) {
    return this.service.getFlags(filter);
  }

  @Get('flags/stats')
  @ApiOperation({ summary: 'Get flag statistics' })
  getFlagStats() {
    return this.service.getFlagStats();
  }

  @Patch('flags/:id/review')
  @ApiOperation({ summary: 'Review a content flag' })
  reviewFlag(@Param('id') id: string, @Body() dto: ReviewFlagDto, @CurrentUser('id') userId: string) {
    return this.service.reviewFlag(id, dto, userId);
  }

  @Get('rules')
  @ApiOperation({ summary: 'List filter rules' })
  getRules(@Query() filter: RuleFilterDto) {
    return this.service.getRules(filter);
  }

  @Post('rules')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a filter rule' })
  createRule(@Body() dto: CreateFilterRuleDto, @CurrentUser('id') userId: string) {
    return this.service.createRule(dto, userId);
  }

  @Patch('rules/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a filter rule' })
  updateRule(@Param('id') id: string, @Body() dto: UpdateFilterRuleDto) {
    return this.service.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a filter rule' })
  deleteRule(@Param('id') id: string) {
    return this.service.deleteRule(id);
  }
}
