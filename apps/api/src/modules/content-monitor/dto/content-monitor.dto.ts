import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FilterRuleAction, FlagSeverity, FlagStatus, FlagTargetType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateFilterRuleDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiProperty() @IsString() @MaxLength(500) pattern: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isRegex?: boolean;
  @ApiPropertyOptional({ enum: FlagSeverity, default: FlagSeverity.MEDIUM }) @IsOptional() @IsEnum(FlagSeverity) severity?: FlagSeverity;
  @ApiPropertyOptional({ enum: FilterRuleAction, default: FilterRuleAction.FLAG }) @IsOptional() @IsEnum(FilterRuleAction) action?: FilterRuleAction;
}

export class UpdateFilterRuleDto extends PartialType(CreateFilterRuleDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ReviewFlagDto {
  @ApiProperty({ enum: FlagStatus }) @IsEnum(FlagStatus) status: FlagStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) actionTaken?: string;
}

export class FlagFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FlagStatus }) @IsOptional() @IsEnum(FlagStatus) status?: FlagStatus;
  @ApiPropertyOptional({ enum: FlagSeverity }) @IsOptional() @IsEnum(FlagSeverity) severity?: FlagSeverity;
  @ApiPropertyOptional({ enum: FlagTargetType }) @IsOptional() @IsEnum(FlagTargetType) targetType?: FlagTargetType;
}

export class RuleFilterDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ enum: FlagSeverity }) @IsOptional() @IsEnum(FlagSeverity) severity?: FlagSeverity;
}
