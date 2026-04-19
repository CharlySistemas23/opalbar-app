import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: ['es', 'en'] }) @IsOptional() @IsString()
  language?: string;
}

export class UpdateInterestsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  categoryIds: string[];
}
