import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createStoreSchema = z.object({
  name: z.string().min(1).max(255),
  location: z.string().max(255).optional(),
});

export const updateStoreSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  location: z.string().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createMappingSchema = z.object({
  entityType: z.string().min(1).max(64),
  internalEntityId: z.string().uuid(),
  platformName: z.string().min(1).max(64),
  platformMetadata: z.record(z.unknown()).default({}),
});

export const updateMappingSchema = z.object({
  platformMetadata: z.record(z.unknown()).optional(),
  isSynced: z.boolean().optional(),
});

export class CreateStoreDto extends createZodDto(createStoreSchema) {}
export class UpdateStoreDto extends createZodDto(updateStoreSchema) {}
export class CreateMappingDto extends createZodDto(createMappingSchema) {}
export class UpdateMappingDto extends createZodDto(updateMappingSchema) {}
