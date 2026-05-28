import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ORDER_STATUSES } from '../../translation/canonical.types';

export const listOrdersSchema = z.object({
  storeId: z.string().uuid().optional(),
  platform: z.string().optional(),
  status: z.enum(ORDER_STATUSES as [string, ...string[]]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListOrdersDto extends createZodDto(listOrdersSchema) {}
