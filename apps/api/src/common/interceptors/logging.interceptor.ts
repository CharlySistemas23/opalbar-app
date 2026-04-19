// ─────────────────────────────────────────────
//  Logging Interceptor — log every request/response
// ─────────────────────────────────────────────
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Attach request ID
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);

    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const elapsed = Date.now() - start;
          this.logger.log(
            `[${requestId}] ${method} ${url} ${statusCode} ${elapsed}ms — ${ip} "${userAgent}"`,
          );
        },
        error: (err) => {
          const elapsed = Date.now() - start;
          this.logger.error(
            `[${requestId}] ${method} ${url} ERROR ${elapsed}ms — ${err.message}`,
          );
        },
      }),
    );
  }
}
