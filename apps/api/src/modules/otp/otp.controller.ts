import { Body, Controller, forwardRef, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ThrottleOtp } from '../../common/decorators/throttle-custom.decorator';
import { OtpService } from './otp.service';
import { AuthService } from '../auth/auth.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';

@ApiTags('OTP')
@Controller('otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  @Post('send')
  @Public()
  @ThrottleOtp()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP code via email or SMS' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.otpService.sendOtp(dto);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an OTP code' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    const verified = await this.otpService.verifyOtp(dto);

    // For login/signup flows, emit session tokens automatically.
    if (verified && dto.type === 'LOGIN_2FA') {
      const result = await this.authService.loginWithOtp(dto.identifier, {
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      });
      return { verified: true, ...result };
    }

    return { verified, message: 'Code verified successfully' };
  }
}
