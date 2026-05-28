import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PLATFORMS } from '../../translation/canonical.types';

export const categoryResponseSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  isVisible: z.boolean(),
  createdAt: z.string().datetime(),
});

export const productResponseSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  sku: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  basePriceCents: z.number().int(),
  isAvailable: z.boolean(),
  imageUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const platformLinkResponseSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid().nullable(),
  entityType: z.string(),
  internalEntityId: z.string().uuid(),
  platformName: z.enum(PLATFORMS as [string, ...string[]]),
  platformMetadata: z.record(z.unknown()),
  isSynced: z.boolean(),
  lastSyncedAt: z.string().datetime().nullable(),
});

export class CategoryResponseDto extends createZodDto(categoryResponseSchema) {}
export class ProductResponseDto extends createZodDto(productResponseSchema) {}
export class PlatformLinkResponseDto extends createZodDto(platformLinkResponseSchema) {}
