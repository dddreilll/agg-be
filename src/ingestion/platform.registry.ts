import { BadRequestException, Injectable, NotImplementedException } from '@nestjs/common';
import { foodpandaWebhookSchema, grabFoodWebhookSchema } from './dto/webhook.schema';

export const SUPPORTED_PLATFORMS = ['GRABFOOD', 'FOODPANDA', 'FB_CHATBOT'] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export interface ParsedWebhook {
  platform: SupportedPlatform;
  orderId: string;
  /**
   * `${platform-lowercased}:${orderId}` — matches the canonical idempotency_key,
   * e.g. `grabfood:PH-GRAB-992831`.
   */
  dedupeKey: string;
  raw: unknown;
}

type OrderIdExtractor = (raw: unknown) => string;

/** Per-platform knowledge of where the native order id lives in the raw webhook. */
const EXTRACTORS: Record<SupportedPlatform, OrderIdExtractor | null> = {
  GRABFOOD: (raw) => grabFoodWebhookSchema.parse(raw).orderID,
  FOODPANDA: (raw) => foodpandaWebhookSchema.parse(raw).token,
  FB_CHATBOT: null, // TODO: implement when the FB-chatbot integration lands
};

@Injectable()
export class PlatformRegistry {
  /** Normalize and validate the `:platform` route param against known platforms. */
  resolve(platformParam: string): SupportedPlatform {
    const key = platformParam?.trim().toUpperCase();
    if (!key || !SUPPORTED_PLATFORMS.includes(key as SupportedPlatform)) {
      throw new BadRequestException(`Unsupported platform: '${platformParam}'`);
    }
    return key as SupportedPlatform;
  }

  /** Validate the body, extract the order id, and derive the dedupe key. */
  parse(platformParam: string, body: unknown): ParsedWebhook {
    const platform = this.resolve(platformParam);
    const extract = EXTRACTORS[platform];
    if (!extract) {
      throw new NotImplementedException(`Ingestion for ${platform} is not implemented yet`);
    }

    let orderId: string;
    try {
      orderId = extract(body);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unparseable payload';
      throw new BadRequestException(`Invalid ${platform} webhook payload: ${reason}`);
    }

    return {
      platform,
      orderId,
      dedupeKey: `${platform.toLowerCase()}:${orderId}`,
      raw: body,
    };
  }
}
