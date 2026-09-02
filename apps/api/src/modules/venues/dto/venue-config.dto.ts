import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** PATCH /venues/:id/config — reservation settings. */
export class UpdateVenueConfigDto {
  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional() @IsString() @Matches(HHMM, { message: 'openTime must be HH:mm' })
  openTime?: string;

  @ApiPropertyOptional({ example: '02:00' })
  @IsOptional() @IsString() @Matches(HHMM, { message: 'closeTime must be HH:mm' })
  closeTime?: string;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000)
  reservationCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  reservationsEnabled?: boolean;

  @ApiPropertyOptional({ example: 30, enum: [15, 30, 45, 60, 90, 120] })
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([15, 30, 45, 60, 90, 120])
  slotMinutes?: number;
}

/** POST /venues — SuperAdmin creates a new venue. */
export class CreateVenueDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2048)
  coverUrl?: string;
}
