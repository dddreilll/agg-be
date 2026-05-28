import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  sku: z.string().max(100).optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  basePriceCents: z.number().int().min(0),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
});

export class CreateProductDto extends createZodDto(createProductSchema) {}
