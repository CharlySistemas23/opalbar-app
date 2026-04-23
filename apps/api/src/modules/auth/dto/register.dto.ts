import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DiscoverySource, Gender } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'Carlos', description: 'First name' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Alonso', description: 'Last name' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'user@opalbar.com', description: 'Email — required for verification' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+525512345678', description: 'Phone number in E.164 format — optional' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiProperty({ example: 'Secure@1234', description: 'Min 8 chars, uppercase, number, special char' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain at least one uppercase letter, one number, and one special character',
  })
  password: string;

  @ApiPropertyOptional({ example: 'es', enum: ['es', 'en'] })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: '1995-08-14', description: 'ISO date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Ciudad de México' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: 'Diseñadora' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @ApiPropertyOptional({ enum: DiscoverySource })
  @IsOptional()
  @IsEnum(DiscoverySource)
  discoverySource?: DiscoverySource;

  @ApiPropertyOptional({
    type: [String],
    description: 'Event category IDs the user is interested in',
    example: ['cat_123', 'cat_456'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  interestCategoryIds?: string[];
}
