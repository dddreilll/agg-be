import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Response models for the liveness/readiness probes, derived from zod. */
export const livenessResponseSchema = z.object({
  status: z.literal('ok'),
});

export const readinessResponseSchema = z.object({
  status: z.literal('ok'),
  redis: z.literal('up'),
  postgres: z.literal('up'),
});

export const readinessErrorResponseSchema = z.object({
  status: z.literal('error'),
  redis: z.enum(['up', 'down']),
  postgres: z.enum(['up', 'down']),
  message: z.string().describe('Why a dependency is considered down.'),
});

export class LivenessResponseDto extends createZodDto(livenessResponseSchema) {}
export class ReadinessResponseDto extends createZodDto(readinessResponseSchema) {}
export class ReadinessErrorResponseDto extends createZodDto(readinessErrorResponseSchema) {}
