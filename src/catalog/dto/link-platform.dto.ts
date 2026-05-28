import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PLATFORMS } from '../../translation/canonical.types';

export const linkPlatformSchema = z.object({
  storeId: z.string().uuid(),
  platform: z.enum(PLATFORMS as [string, ...string[]]),
  /** Platform-specific metadata: must include `external_id` (the platform's own product ID). */
  platformMetadata: z.record(z.unknown()).refine((m) => typeof m['external_id'] === 'string', {
    message: 'platformMetadata must include a string external_id',
  }),
});

export class LinkPlatformDto extends createZodDto(linkPlatformSchema) {}
