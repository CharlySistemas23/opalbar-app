import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// ─────────────────────────────────────────────
//  Privacy — cuenta privada (isPrivate)
// ─────────────────────────────────────────────
export class UpdatePrivacyDto {
  @ApiProperty({ description: 'Cuenta privada: solo amigos/seguidores aceptados ven bio, listas, etc.' })
  @IsBoolean()
  isPrivate: boolean;
}

// ─────────────────────────────────────────────
//  Notification settings
//
//  El ValidationPipe global usa `forbidNonWhitelisted`, así que cualquier
//  clave fuera de esta lista responde 400 automáticamente. Se aceptan:
//   · Alias del móvil: events / offers / community / reservations / marketing
//   · Columnas reales de NotificationSettings (pushEnabled, weeklyDigest…)
//  La traducción alias → columna vive en UsersService.updateNotificationSettings.
// ─────────────────────────────────────────────
export class UpdateNotificationSettingsDto {
  // Alias del móvil
  @ApiPropertyOptional() @IsOptional() @IsBoolean() events?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() offers?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() community?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() reservations?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marketing?: boolean;

  // Columnas reales
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() eventReminders?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() newEvents?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() newOffers?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() communityReplies?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() communityReactions?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pointsUpdates?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marketingEmails?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() weeklyDigest?: boolean;
}

// ─────────────────────────────────────────────
//  Account deletion (GDPR)
// ─────────────────────────────────────────────
export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Motivo opcional (feedback interno)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Contraseña actual. Obligatoria si la cuenta tiene contraseña.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  password?: string;
}
