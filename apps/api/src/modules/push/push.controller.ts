import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
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

@ApiTags('Push')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register this device for push notifications' })
  register(@CurrentUser() user: User, @Body() dto: RegisterTokenDto) {
    return this.pushService.register(user.id, dto.token, dto.platform);
  }

  @Delete('unregister')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister a device token (e.g. on logout)' })
  unregister(@Body() dto: UnregisterTokenDto) {
    return this.pushService.unregister(dto.token);
  }
}
