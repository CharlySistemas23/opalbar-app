import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ReservationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateReservationDto {
  @ApiProperty() @IsString() venueId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eventId?: string;
  @ApiProperty({ example: '2026-04-19' }) @IsDateString() date: string;
  @ApiProperty({ example: '20:00' }) @IsString() timeSlot: string;
  @ApiProperty({ minimum: 1, maximum: 20 }) @IsInt() @Min(1) @Max(20) partySize: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) specialRequests?: string;
}

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: ReservationStatus }) @IsEnum(ReservationStatus) status: ReservationStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) internalNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cancelReason?: string;
}

export class ReservationFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReservationStatus }) @IsOptional() @IsEnum(ReservationStatus) status?: ReservationStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() venueId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
}

export class UpdateReservationDto extends PartialType(CreateReservationDto) {}
