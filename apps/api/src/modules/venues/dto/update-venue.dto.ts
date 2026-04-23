import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVenueDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'MX' }) @IsOptional() @IsString() @MaxLength(3)
  country?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  zipCode?: string;

  @ApiPropertyOptional({ example: 20.6296 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: -105.2333 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: false })
  website?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  instagram?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  imageUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  coverUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}
