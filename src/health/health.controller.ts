import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  LivenessResponseDto,
  ReadinessErrorResponseDto,
  ReadinessResponseDto,
} from './dto/health-responses.dto';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Liveness: the process is up and serving. */
  @Get('healthz')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Process is up.', type: LivenessResponseDto })
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness: dependencies (Redis) are reachable. Returns 503 if not. */
  @Get('readyz')
  @ApiOperation({ summary: 'Readiness probe (pings Redis)' })
  @ApiResponse({
    status: 200,
    description: 'Dependencies reachable.',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'A dependency is unreachable.',
    type: ReadinessErrorResponseDto,
  })
  async readiness(): Promise<{ status: string; redis: string }> {
    try {
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('redis ping timed out')), 1000),
        ),
      ]);
      if (pong !== 'PONG') throw new Error(`unexpected ping reply: ${pong}`);
      return { status: 'ok', redis: 'up' };
    } catch (err) {
      throw new HttpException(
        {
          status: 'error',
          redis: 'down',
          message: err instanceof Error ? err.message : 'unknown',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
