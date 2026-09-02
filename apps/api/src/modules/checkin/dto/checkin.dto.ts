import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** QR payload or the short suffix typed manually by staff. */
export class CheckinCodeDto {
  @ApiProperty({ description: 'Full confirm code, or its last 4–8 characters' })
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'code contains invalid characters' })
  code: string;
}
