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
