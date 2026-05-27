import 'reflect-metadata';
import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { Env } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route all framework logs through pino.
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.useGlobalFilters(new AllExceptionsFilter());
  // Fire lifecycle hooks (RedisModule.onApplicationShutdown, BullMQ close) on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  new NestLogger('Bootstrap').log(`Ingestion service listening on :${port}`);
}

// Log async faults instead of letting them silently take down the process.
process.on('unhandledRejection', (reason) => {
  new NestLogger('Process').error(`Unhandled promise rejection: ${String(reason)}`);
});

void bootstrap();
