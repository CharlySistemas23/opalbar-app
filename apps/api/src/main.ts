// ─────────────────────────────────────────────
//  OPALBAR API — Bootstrap
// ─────────────────────────────────────────────
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as bodyParser from 'body-parser';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: false,
  });

  const port = process.env['PORT'] || 3000;
  const apiPrefix = process.env['API_PREFIX'] || 'api/v1';
  const clientUrl = process.env['CLIENT_URL'] || 'http://localhost:8081';
  const nodeEnv = process.env['NODE_ENV'] || 'development';

  // ── Body parser (allow large base64 images) ──
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

  // ── Security ──────────────────────────────
  app.use((helmet as any).default());

  // ── Compression ───────────────────────────
  app.use((compression as any).default ? (compression as any).default() : (compression as any)());

  // ── CORS ──────────────────────────────────
  const allowedOrigins = clientUrl.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: nodeEnv === 'production'
      ? (origin, cb) => {
          if (!origin) return cb(null, true); // mobile apps / curl
          if (allowedOrigins.includes(origin)) return cb(null, true);
          if (/^https:\/\/opalbar-app-admin[-a-z0-9]*\.vercel\.app$/.test(origin)) return cb(null, true);
          return cb(new Error(`CORS blocked: ${origin}`), false);
        }
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  // ── Global prefix ─────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ── Global validation pipe ────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,          // auto-transform DTOs
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Swagger / OpenAPI ─────────────────────
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('OPALBAR API')
      .setDescription(
        `
## OPALBAR API — Documentación completa

### Autenticación
Todos los endpoints protegidos requieren un **Bearer Token** JWT obtenido en \`POST /auth/login\`.

### Rate Limiting
| Tipo | Límite |
|------|--------|
| General | 100 req/min |
| Auth (login, register) | 10 req/min |
| OTP | 3 req/5min |

### Códigos de respuesta
| Código | Significado |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
      `.trim(),
      )
      .setVersion('1.0')
      .setContact('OPALBAR Dev Team', 'https://opalbar.com', 'dev@opalbar.com')
      .setLicense('Proprietary', '')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT',
      )
      .addServer(`http://localhost:${port}`, 'Local Development')
      .addServer('https://api.opalbar.com', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'OPALBAR API Docs',
    });

    Logger.log(`📚 Swagger docs: http://localhost:${port}/docs`, 'Bootstrap');
  }

  // ── Shutdown hooks ─────────────────────────
  app.enableShutdownHooks();

  // ── Start ─────────────────────────────────
  await app.listen(port, '0.0.0.0');

  Logger.log(
    `[API] OPALBAR API running on: http://localhost:${port}/${apiPrefix}`,
    'Bootstrap',
  );
  Logger.log(`[ENV] Environment: ${nodeEnv}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  Logger.error('Failed to start application', err, 'Bootstrap');
  process.exit(1);
});
