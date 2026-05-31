import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { INGESTION_QUEUE, type IngestionJobData } from './jobs';

interface FailedJobDto {
  jobId: string;
  name: string;
  platform: string;
  orderId: string;
  dedupeKey: string;
  receivedAt: string;
  failedReason: string;
  attemptsMade: number;
  failedAt: number | null;
  stacktrace: string[];
}

function toDto(job: Awaited<ReturnType<Queue['getJob']>>): FailedJobDto {
  const data = (job!.data ?? {}) as Partial<IngestionJobData>;
  return {
    jobId: String(job!.id),
    name: job!.name,
    platform: data.platform ?? 'unknown',
    orderId: data.orderId ?? 'unknown',
    dedupeKey: data.dedupeKey ?? 'unknown',
    receivedAt: data.receivedAt ?? 'unknown',
    failedReason: job!.failedReason ?? '',
    attemptsMade: job!.attemptsMade,
    failedAt: job!.finishedOn ?? null,
    stacktrace: job!.stacktrace ?? [],
  };
}

/**
 * Dead-letter queue inspection. Failed ingestion jobs (those that exhausted all
 * retry attempts) stay in the queue for 24 h and can be inspected or re-queued here.
 */
@ApiTags('DLQ')
@Controller('dlq')
export class DlqController {
  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue<IngestionJobData>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List failed ingestion jobs with queue-wide health counts',
    description:
      'Returns waiting/active/delayed/failed counts for at-a-glance queue health, ' +
      'plus a paginated list of failed (dead-letter) jobs.',
  })
  @ApiQuery({ name: 'start', required: false, example: 0 })
  @ApiQuery({ name: 'end', required: false, example: 19 })
  @ApiResponse({ status: 200, description: 'Queue stats + paginated list of failed jobs.' })
  async list(@Query('start') startQ?: string, @Query('end') endQ?: string) {
    const start = Math.max(0, parseInt(startQ ?? '0', 10) || 0);
    const end = Math.max(start, parseInt(endQ ?? '19', 10) || 19);
    const [jobs, waiting, active, delayed, failed] = await Promise.all([
      this.queue.getFailed(start, end),
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getDelayedCount(),
      this.queue.getFailedCount(),
    ]);
    return {
      queue: { waiting, active, delayed, failed },
      total: failed,
      start,
      end,
      jobs: jobs.map(toDto),
    };
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get a single failed job' })
  @ApiParam({ name: 'jobId', description: 'BullMQ job id' })
  @ApiResponse({ status: 200, description: 'Job details.' })
  @ApiResponse({ status: 404, description: 'Job not found or not in failed state.' })
  async getOne(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job || (await job.getState()) !== 'failed') {
      throw new NotFoundException(`No failed job with id '${jobId}'`);
    }
    return toDto(job);
  }

  @Post(':jobId/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Re-queue a failed job' })
  @ApiParam({ name: 'jobId', description: 'BullMQ job id' })
  @ApiResponse({ status: 204, description: 'Job moved back to waiting.' })
  @ApiResponse({ status: 404, description: 'Job not found or not in failed state.' })
  async retry(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job || (await job.getState()) !== 'failed') {
      throw new NotFoundException(`No failed job with id '${jobId}'`);
    }
    await job.retry('failed');
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Discard a failed job permanently' })
  @ApiParam({ name: 'jobId', description: 'BullMQ job id' })
  @ApiResponse({ status: 204, description: 'Job removed.' })
  @ApiResponse({ status: 404, description: 'Job not found or not in failed state.' })
  async discard(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job || (await job.getState()) !== 'failed') {
      throw new NotFoundException(`No failed job with id '${jobId}'`);
    }
    await job.remove();
  }
}
