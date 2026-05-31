import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  LivenessResponseDto,
  ReadinessErrorResponseDto,
  ReadinessResponseDto,
} from './dto/health-responses.dto';

const PING_TIMEOUT_MS = 1000;

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Liveness: the process is up and serving. */
  @Get('healthz')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Process is up.', type: LivenessResponseDto })
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness: Redis and Postgres are reachable. Returns 503 if either is down. */
  @Get('readyz')
  @ApiOperation({ summary: 'Readiness probe (pings Redis and Postgres)' })
  @ApiResponse({
    status: 200,
    description: 'All dependencies reachable.',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies are unreachable.',
    type: ReadinessErrorResponseDto,
  })
  async readiness(): Promise<{ status: string; redis: string; postgres: string }> {
    const [redisResult, postgresResult] = await Promise.allSettled([
      pingRedis(this.redis),
      pingPostgres(this.dataSource),
    ]);

    const redisUp = redisResult.status === 'fulfilled';
    const postgresUp = postgresResult.status === 'fulfilled';

    if (redisUp && postgresUp) {
      return { status: 'ok', redis: 'up', postgres: 'up' };
    }

    const failingMsg = [
      !redisUp && `redis: ${(redisResult as PromiseRejectedResult).reason?.message ?? 'down'}`,
      !postgresUp && `postgres: ${(postgresResult as PromiseRejectedResult).reason?.message ?? 'down'}`,
    ]
      .filter(Boolean)
      .join('; ');

    throw new HttpException(
      {
        status: 'error',
        redis: redisUp ? 'up' : 'down',
        postgres: postgresUp ? 'up' : 'down',
        message: failingMsg,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

function timeout(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} ping timed out`)), ms),
  );
}

async function pingRedis(redis: Redis): Promise<void> {
  const pong = await Promise.race([redis.ping(), timeout(PING_TIMEOUT_MS, 'redis')]);
  if (pong !== 'PONG') throw new Error(`unexpected redis ping reply: ${pong}`);
}

async function pingPostgres(dataSource: DataSource): Promise<void> {
  await Promise.race([
    dataSource.query('SELECT 1'),
    timeout(PING_TIMEOUT_MS, 'postgres'),
  ]);
}
