import 'reflect-metadata';
import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { Env } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route all framework logs through pino.
  app.useLogger(app.get(Logger));

  // --- OpenAPI (Swagger) document, rendered via Scalar ---
  const openApiConfig = new DocumentBuilder()
    .setTitle('Delivery Operations Platform API')
    .setDescription(
      'Unified middleware that ingests delivery-platform order webhooks (GrabFood today), ' +
        'translates them into a canonical schema, persists them, and broadcasts new orders to ' +
        'kitchen displays.\n\n' +
        'Real-time channel (outside this REST spec): Socket.io namespace `/kitchen` — connect ' +
        'with `?storeId=<uuid>` and listen for `order.incoming`.',
    )
    .setVersion('0.1.0')
    .addTag('Ingestion', 'Inbound delivery-platform order webhooks')
    .addTag('Health', 'Liveness & readiness probes')
    .build();
  // Schemas come from our zod definitions via nestjs-zod DTOs; cleanupOpenApiDoc
  // resolves them and strips the x-nestjs_zod-* markers (3.0 → nullable handling).
  const openApiDocument = cleanupOpenApiDoc(SwaggerModule.createDocument(app, openApiConfig), {
    version: '3.0',
  });

  // Raw spec for tooling (Postman, codegen, …).
  app.use('/openapi.json', (_req: Request, res: Response) => {
    res.json(openApiDocument);
  });
  // Scalar API reference UI. Mounted before helmet so its CDN/inline assets aren't CSP-blocked.
  app.use('/reference', apiReference({ content: openApiDocument }));

  app.use(helmet());
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalFilters(new AllExceptionsFilter());
  // Fire lifecycle hooks (RedisModule.onApplicationShutdown, BullMQ close) on SIGTERM/SIGINT.
  app.enableShutdownHooks();
  // Enable CORS using `CORS_ORIGIN` (env) or allow all origins by default.
  const config = app.get(ConfigService<Env, true>);
  app.enableCors({
    origin: "*",
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  const log = new NestLogger('Bootstrap');
  log.log(`Ingestion service listening on :${port}`);
  log.log('API reference (Scalar) → /reference · OpenAPI JSON → /openapi.json');
}

// Log async faults instead of letting them silently take down the process.
process.on('unhandledRejection', (reason) => {
  new NestLogger('Process').error(`Unhandled promise rejection: ${String(reason)}`);
});

void bootstrap();
