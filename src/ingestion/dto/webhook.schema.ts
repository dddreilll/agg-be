import { z } from 'zod';

/**
 * Loose inbound schemas — we validate only enough to pull out the platform's order
 * id (so we can dedupe and enqueue). Full structural validation is deferred to the
 * worker during canonical translation, keeping the ingestion path tiny and fast.
 *
 * GrabFood's official Submit Order webhook carries `orderID` at the top level.
 */
export const grabFoodWebhookSchema = z
  .object({ orderID: z.string().min(1) })
  .passthrough();

export type GrabFoodWebhook = z.infer<typeof grabFoodWebhookSchema>;

/**
 * Foodpanda's order webhook carries a unique `token` (UUID) at the top level; the
 * dedupe/idempotency key is derived from it (`foodpanda:<token>`).
 */
export const foodpandaWebhookSchema = z
  .object({ token: z.string().min(1) })
  .passthrough();

export type FoodpandaWebhook = z.infer<typeof foodpandaWebhookSchema>;
