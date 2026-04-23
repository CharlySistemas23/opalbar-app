import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscoverySource, Gender } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'MX' }) @IsOptional() @IsString() @MaxLength(3)
  country?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ enum: ['es', 'en'] }) @IsOptional() @IsString()
  language?: string;

  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  occupation?: string;

  @ApiPropertyOptional({ enum: DiscoverySource }) @IsOptional() @IsEnum(DiscoverySource)
  discoverySource?: DiscoverySource;
}

export class UpdateInterestsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  categoryIds: string[];
}
