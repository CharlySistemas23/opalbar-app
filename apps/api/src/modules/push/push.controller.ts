import { Body, Controller, Delete, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PushService } from './push.service';

class RegisterTokenDto {
  @IsString() token: string;
  @IsString() @IsIn(['ios', 'android', 'web']) platform: 'ios' | 'android' | 'web';
}

class UnregisterTokenDto {
  @IsString() token: string;
}

class RegisterFailedDto {
  @IsString() reason: string;
}

@ApiTags('Push')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  private readonly logger = new Logger(PushController.name);
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register this device for push notifications' })
  register(@CurrentUser() user: User, @Body() dto: RegisterTokenDto) {
    return this.pushService.register(user.id, dto.token, dto.platform);
  }

  @Post('register-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mobile-side diagnostic: why push registration was skipped' })
  registerFailed(@CurrentUser() user: User, @Body() dto: RegisterFailedDto) {
    this.logger.warn(`📵 Push registration skipped for user=${user.id}: ${dto.reason}`);
    return { ok: true };
  }

  @Delete('unregister')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister a device token (e.g. on logout)' })
  unregister(@Body() dto: UnregisterTokenDto) {
    return this.pushService.unregister(dto.token);
  }
}
