import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createCategorySchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
});

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}
