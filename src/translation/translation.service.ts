import { BadRequestException, Injectable, NotImplementedException } from '@nestjs/common';
import type { CanonicalOrder, TranslationMeta } from './canonical.types';
import { foodpandaOrderSchema } from './foodpanda.schema';
import { translateFoodpandaOrder } from './foodpanda.translator';
import { grabFoodOrderSchema } from './grabfood.schema';
import { translateGrabFoodOrder } from './grabfood.translator';
import { PlatformMappingService } from './platform-mapping.service';

/** Validates a raw platform payload and dispatches to the right translator. */
@Injectable()
export class TranslationService {
  constructor(private readonly resolver: PlatformMappingService) {}

  async translate(platform: string, raw: unknown, meta: TranslationMeta): Promise<CanonicalOrder> {
    switch (platform) {
      case 'GRABFOOD': {
        const parsed = grabFoodOrderSchema.safeParse(raw);
        if (!parsed.success) {
          throw new BadRequestException(
            `Invalid GRABFOOD payload for translation: ${parsed.error.message}`,
          );
        }
        return translateGrabFoodOrder(parsed.data, meta, this.resolver);
      }
      case 'FOODPANDA': {
        const parsed = foodpandaOrderSchema.safeParse(raw);
        if (!parsed.success) {
          throw new BadRequestException(
            `Invalid FOODPANDA payload for translation: ${parsed.error.message}`,
          );
        }
        return translateFoodpandaOrder(parsed.data, meta, this.resolver);
      }
      default:
        throw new NotImplementedException(`Translation for ${platform} is not implemented yet`);
    }
  }
}
