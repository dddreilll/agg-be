import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateProductSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  productCode: z.string().max(16).nullable().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  basePriceCents: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
  isAvailable: z.boolean().optional(),
});

export class UpdateProductDto extends createZodDto(updateProductSchema) {}
