import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ORDER_STATUSES } from '../../translation/canonical.types';

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES as [string, ...string[]]),
});

export class UpdateOrderStatusDto extends createZodDto(updateOrderStatusSchema) {}
