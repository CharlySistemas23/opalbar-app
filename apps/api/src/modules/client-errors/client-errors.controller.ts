// ─────────────────────────────────────────────
//  Client Errors Controller
//
//  Bridge endpoint: mobile (which intentionally has no @sentry/react-native
//  to keep OTA-safe) POSTs unhandled errors here so they land in the same
//  Sentry project as backend crashes via @sentry/nestjs.
//
//  · POST /client-errors
//    Body: { message: string; stack?: string; context?: Record<string, unknown> }
//    Validation: manual (no DTO) — keep payload schema flexible for future
//      Sentry RN migration. Reject if message > 5000 chars.
//    Auth: @Public() — clients aren't always authenticated when they crash
//      (e.g. login screen errors). Throttler 'default' bucket caps abuse.
// ─────────────────────────────────────────────
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';

interface ClientErrorPayload {
  message?: unknown;
  stack?: unknown;
  context?: unknown;
}

const MAX_MESSAGE_LEN = 5000;
const MAX_STACK_LEN = 20_000;

@ApiTags('Client Errors')
@Controller('client-errors')
export class ClientErrorsController {
  private readonly logger = new Logger(ClientErrorsController.name);

  @Post()
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Report a client-side error (mobile/web) to Sentry' })
  report(@Body() body: ClientErrorPayload, @Req() req: Request): void {
    // Manual validation — keep contract flexible for future Sentry RN migration.
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      throw new BadRequestException('message is required');
    }
    if (message.length > MAX_MESSAGE_LEN) {
      throw new BadRequestException(
        `message exceeds ${MAX_MESSAGE_LEN} chars`,
      );
    }

    const stack =
      typeof body?.stack === 'string' && body.stack.length <= MAX_STACK_LEN
        ? body.stack
        : undefined;

    const context =
      body?.context && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : {};

    // Rebuild an Error so Sentry gets a proper exception (with stack) instead
    // of a synthetic capture-message event. Set `.stack` directly to preserve
    // the original JS engine's stack from the client.
    const err = new Error(message);
    if (stack) {
      err.stack = stack;
    }

    Sentry.captureException(err, {
      tags: {
        source: 'client',
        platform:
          typeof context['platform'] === 'string'
            ? (context['platform'] as string)
            : 'unknown',
      },
      extra: {
        ...context,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    });

    // Mirror to logs for local dev (Sentry is a no-op when DSN unset).
    this.logger.warn(`[client-error] ${message}`);
  }
}
