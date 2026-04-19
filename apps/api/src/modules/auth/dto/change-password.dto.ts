import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'Min 8 chars, uppercase, number, special char' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain at least one uppercase letter, one number, and one special character',
  })
  newPassword: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@opalbar.com' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: '123456', description: 'OTP code received via email/SMS' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otpCode: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain at least one uppercase letter, one number, and one special character',
  })
  newPassword: string;
}
