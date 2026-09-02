import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscoverySource, Gender } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Nota: `@IsOptional()` en class-validator acepta `null` ademas de `undefined`.
// Los campos opcionales del perfil se tipan `| null` para que el cliente pueda
// LIMPIAR un valor (bio, cumpleaños, foto…) mandando `null` explícito — el
// service distingue `undefined` (no tocar) de `null` (borrar).
export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(500)
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString()
  birthDate?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ example: 'MX' }) @IsOptional() @IsString() @MaxLength(3)
  country?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString()
  avatarUrl?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString()
  coverUrl?: string | null;

  @ApiPropertyOptional({ enum: ['es', 'en'] }) @IsOptional() @IsIn(['es', 'en'])
  language?: string;

  @ApiPropertyOptional({ enum: Gender, nullable: true }) @IsOptional() @IsEnum(Gender)
  gender?: Gender | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(120)
  occupation?: string | null;

  @ApiPropertyOptional({ enum: DiscoverySource }) @IsOptional() @IsEnum(DiscoverySource)
  discoverySource?: DiscoverySource;
}

export class UpdateInterestsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  categoryIds: string[];
}
