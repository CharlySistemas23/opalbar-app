import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MessageSender, TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateTicketDto {
  @ApiProperty({ enum: TicketCategory }) @IsEnum(TicketCategory) category: TicketCategory;
  @ApiProperty() @IsString() @MaxLength(200) subject: string;
  @ApiProperty() @IsString() @MaxLength(2000) initialMessage: string;
}

export class SendMessageDto {
  @ApiProperty() @IsString() @MaxLength(2000) content: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsString({ each: true }) attachments?: string[];
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus }) @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedToId?: string;
}

export class TicketFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TicketStatus }) @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional({ enum: TicketCategory }) @IsOptional() @IsEnum(TicketCategory) category?: TicketCategory;
}

export class CreateQuickReplyDto {
  @ApiProperty() @IsString() @MaxLength(100) title: string;
  @ApiProperty() @IsString() @MaxLength(1000) body: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
}

export class UpdateQuickReplyDto extends PartialType(CreateQuickReplyDto) {}
