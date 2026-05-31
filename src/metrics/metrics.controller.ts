import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

/** Prometheus scrape endpoint. Excluded from the public API reference. */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Res() res: Response): Promise<void> {
    const output = await this.metrics.registry.metrics();
    res.set('Content-Type', this.metrics.registry.contentType);
    res.end(output);
  }
}
