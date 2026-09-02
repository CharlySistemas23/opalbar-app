import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ReservationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TIME_SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateReservationDto {
  @ApiProperty() @IsString() venueId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eventId?: string;
  @ApiProperty({ example: '2026-04-19' }) @IsDateString() date: string;
  @ApiProperty({ example: '20:00' })
  @IsString()
  @Matches(TIME_SLOT_RE, { message: 'timeSlot must be HH:mm' })
  timeSlot: string;
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
  /** upcoming = today or later and not closed; past = everything else. */
  @ApiPropertyOptional({ enum: ['upcoming', 'past'] })
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  scope?: 'upcoming' | 'past';
}

/** Fields a guest may change on their own reservation. */
export class UpdateReservationDto extends PartialType(
  PickType(CreateReservationDto, ['date', 'timeSlot', 'partySize', 'specialRequests'] as const),
) {}

export class AvailabilityQueryDto {
  @ApiProperty() @IsString() venueId: string;
  @ApiProperty({ example: '2026-04-19' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date: string;
  /** Reservation being edited — its own seats are not counted as taken. */
  @ApiPropertyOptional() @IsOptional() @IsString() excludeReservationId?: string;
}
