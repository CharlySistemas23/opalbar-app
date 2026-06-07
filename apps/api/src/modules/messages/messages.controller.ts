import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ThrottleWrite } from '../../common/decorators/throttle-custom.decorator';
import { MessagesService } from './messages.service';

// ── DTOs ────────────────────────────────────
// Backend audit P1 #6 (2026-05-18): controllers used inline `@Body('key')`
// pickers that bypassed the global ValidationPipe (whitelist + forbid extras
// + length caps). All inputs now go through validated DTOs so unknown fields
// are rejected and pathological lengths are caught at the boundary.

class CreateThreadDto {
  @IsString()
  @Length(1, 64)
  userId: string;
}

class SendMessageDto {
  @IsOptional() @IsString() @Length(1, 4000)
  content?: string;
  @IsOptional() @IsString() @Length(1, 2048)
  imageUrl?: string;
  @IsOptional() @IsString() @Length(1, 64)
  stickerKey?: string;
  @IsOptional() @IsString() @Length(1, 2048)
  audioUrl?: string;
  @IsOptional() @IsInt() @Min(1) @Max(600)
  audioDurationSec?: number;
  @IsOptional() @IsString() @Length(1, 64)
  replyToId?: string;
}

class ReactToMessageDto {
  // Single emoji string, capped at 16 bytes (a 4-byte emoji + ZWJ chain).
  @IsString() @Length(1, 16)
  emoji: string;
}

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('threads')
  @ApiOperation({ summary: 'List my conversations' })
  listThreads(@CurrentUser() me: User) {
    return this.messagesService.listThreads(me.id);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List pending message requests sent to me' })
  listRequests(@CurrentUser() me: User) {
    return this.messagesService.listRequests(me.id);
  }

  @Get('requests/count')
  @ApiOperation({ summary: 'Count of pending requests (for inbox badge)' })
  requestsCount(@CurrentUser() me: User) {
    return this.messagesService.requestsCount(me.id);
  }

  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending request' })
  acceptRequest(@CurrentUser() me: User, @Param('id') id: string) {
    return this.messagesService.acceptRequest(me.id, id);
  }

  @Post('requests/:id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a request (removes the thread)' })
  declineRequest(@CurrentUser() me: User, @Param('id') id: string) {
    return this.messagesService.declineRequest(me.id, id);
  }

  @Post('requests/:id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block sender (thread stays as BLOCKED)' })
  blockRequest(@CurrentUser() me: User, @Param('id') id: string) {
    return this.messagesService.blockRequest(me.id, id);
  }

  @Post('threads')
  @ApiOperation({ summary: 'Create or fetch thread with another user' })
  createThread(@CurrentUser() me: User, @Body() dto: CreateThreadDto) {
    return this.messagesService.getOrCreateThread(me.id, dto.userId);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get thread summary' })
  getThread(@CurrentUser() me: User, @Param('id') id: string) {
    return this.messagesService.getThread(me.id, id);
  }

  @Get('threads/:id/messages')
  @ApiOperation({ summary: 'List messages in thread (paginated)' })
  listMessages(
    @CurrentUser() me: User,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.listMessages(me.id, id, cursor, parseInt(limit || '50', 10));
  }

  @Post('threads/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ThrottleWrite()
  @ApiOperation({ summary: 'Send a message (text, image, sticker, voice, or reply)' })
  sendMessage(
    @CurrentUser() me: User,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(me.id, id, {
      content: dto.content,
      imageUrl: dto.imageUrl,
      stickerKey: dto.stickerKey,
      audioUrl: dto.audioUrl,
      audioDurationSec: dto.audioDurationSec,
      replyToId: dto.replyToId,
    });
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a message I sent' })
  deleteMessage(@CurrentUser() me: User, @Param('messageId') messageId: string) {
    return this.messagesService.deleteMessage(me.id, messageId);
  }

  @Post(':messageId/react')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add an emoji reaction to a message' })
  reactToMessage(
    @CurrentUser() me: User,
    @Param('messageId') messageId: string,
    @Body() dto: ReactToMessageDto,
  ) {
    return this.messagesService.reactToMessage(me.id, messageId, dto.emoji);
  }

  @Delete(':messageId/react/:emoji')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove my emoji reaction from a message' })
  unreactMessage(
    @CurrentUser() me: User,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
  ) {
    return this.messagesService.unreactMessage(me.id, messageId, decodeURIComponent(emoji));
  }
}
