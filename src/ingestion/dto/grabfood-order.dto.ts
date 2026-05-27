import { createZodDto } from 'nestjs-zod';
import { grabFoodOrderSchema } from '../../translation/grabfood.schema';

/**
 * OpenAPI request-body model for the GrabFood webhook, generated from the same
 * `grabFoodOrderSchema` the worker validates against — so the documented shape
 * can't drift from what we actually parse. (The HTTP front door itself only
 * reads `orderID`; full validation happens during translation.)
 */
export class GrabFoodOrderDto extends createZodDto(grabFoodOrderSchema) {}
