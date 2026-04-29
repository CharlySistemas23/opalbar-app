import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmailAudienceType, EmailCampaignTemplate } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AudienceFilterDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  interestIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  loyaltyLevelIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minPoints?: number;
}

export class CampaignContentDto {
  @ApiProperty({ enum: EmailCampaignTemplate })
  @IsEnum(EmailCampaignTemplate)
  template: EmailCampaignTemplate;

  @ApiProperty({ example: 'Esta noche: jazz en vivo + 2x1 en mezcales' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @ApiPropertyOptional({ example: 'Solo por hoy, hasta que se agoten las mesas.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  preheader?: string;

  @ApiProperty({ example: '¿Qué tal un plan distinto esta noche?' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  headline: string;

  @ApiProperty({ example: 'Tenemos jazz en vivo desde las 9pm...' })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({ example: 'Reservar mesa' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaLabel?: string;

  @ApiPropertyOptional({ example: 'https://opalbar.com/reservar' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  ctaUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.opalbar.com/hero.jpg' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  heroImageUrl?: string;

  // ── Multi-image gallery (rendered below hero) ─────────
  @ApiPropertyOptional({ type: [String], description: 'URLs adicionales de imágenes para galería' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUrl({ require_tld: false }, { each: true })
  images?: string[];

  // ── File attachments (PDF, etc.) ──────────────────────
  @ApiPropertyOptional({ type: [Object], description: 'Archivos adjuntos: { name, url, sizeBytes, mimeType }' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CampaignAttachmentDto)
  attachments?: CampaignAttachmentDto[];
}

export class CampaignAttachmentDto {
  @ApiProperty({ example: 'menu-promocional.pdf' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'https://api.opalbar.com/api/v1/email/asset/abc123' })
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;
}

export class CampaignAudienceDto {
  @ApiProperty({ enum: EmailAudienceType })
  @IsEnum(EmailAudienceType)
  audienceType: EmailAudienceType;

  @ApiPropertyOptional({ type: AudienceFilterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFilterDto)
  audienceFilter?: AudienceFilterDto;
}

export class CreateCampaignDto extends CampaignContentDto {
  @ApiProperty({ enum: EmailAudienceType })
  @IsEnum(EmailAudienceType)
  audienceType: EmailAudienceType;

  @ApiPropertyOptional({ type: AudienceFilterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFilterDto)
  audienceFilter?: AudienceFilterDto;

  @ApiPropertyOptional({ description: 'ISO date-time. Omit to send immediately.' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class RenderPreviewDto extends CampaignContentDto {}

export class UploadAssetDto {
  @ApiProperty({ description: 'Data URI (data:image/jpeg;base64,...)' })
  @IsString()
  @MaxLength(15_000_000) // ~11MB of base64 = ~8MB binary
  dataUrl: string;
}

export class AudienceCountDto {
  @ApiProperty({ enum: EmailAudienceType })
  @IsEnum(EmailAudienceType)
  audienceType: EmailAudienceType;

  @ApiPropertyOptional({ type: AudienceFilterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFilterDto)
  audienceFilter?: AudienceFilterDto;
}
