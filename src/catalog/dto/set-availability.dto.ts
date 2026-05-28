import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PLATFORMS } from '../../translation/canonical.types';

export const setAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
  /** If provided, only marks unavailable on this specific platform (via platform_mappings metadata). */
  platform: z.enum(PLATFORMS as [string, ...string[]]).optional(),
});

export class SetAvailabilityDto extends createZodDto(setAvailabilitySchema) {}
