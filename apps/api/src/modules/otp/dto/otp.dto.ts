import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';
import { OtpType } from '@prisma/client';

export class SendOtpDto {
  @ApiPropertyOptional({ example: 'user@opalbar.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+525512345678' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiProperty({ enum: OtpType, example: OtpType.EMAIL_VERIFICATION })
  @IsEnum(OtpType)
  type: OtpType;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@opalbar.com or +525512345678' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({ enum: OtpType })
  @IsEnum(OtpType)
  type: OtpType;
}
