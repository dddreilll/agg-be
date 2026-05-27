import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Response models for the ingestion endpoint, defined as zod schemas so the
 * documented shapes derive from a single source. `status` is a literal, so the
 * generated OpenAPI shows the exact constant the endpoint returns.
 */
export const acceptedResponseSchema = z.object({
  status: z.literal('accepted'),
  idempotencyKey: z.string().describe('`<platform>:<orderId>` — matches the canonical idempotency_key.'),
  jobId: z.string().describe('BullMQ job id (the dedupe key, `:` sanitized to `_`).'),
});

export const duplicateResponseSchema = z.object({
  status: z.literal('duplicate'),
  idempotencyKey: z.string().describe('`<platform>:<orderId>` of the already-seen order.'),
});

export class AcceptedResponseDto extends createZodDto(acceptedResponseSchema) {}
export class DuplicateResponseDto extends createZodDto(duplicateResponseSchema) {}
