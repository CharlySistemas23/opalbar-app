import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'user@opalbar.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+525512345678' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiProperty({ example: 'Secure@1234' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Device push token for notifications' })
  @IsOptional()
  @IsString()
  deviceToken?: string;

  @ApiPropertyOptional({ description: 'Device name e.g. iPhone 15' })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Device OS e.g. iOS 17' })
  @IsOptional()
  @IsString()
  deviceOs?: string;
}
