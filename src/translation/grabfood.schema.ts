import { z } from 'zod';

/**
 * Structural validation of GrabFood's official Submit Order webhook payload
 * (developer.grab.com — GrabFood API v1.1.3). Done worker-side, so the HTTP front
 * door stays fast and lenient. We validate the fields we consume and pass the rest
 * through (campaigns, promos, receiver, dineIn, currency, …).
 *
 * Money fields are minor currency units (currency.exponent = 2), i.e. already "cents".
 * `items[].price` / `modifiers[].price` are unit prices.
 */
export const grabFoodOrderSchema = z
  .object({
    orderID: z.string().min(1).describe("GrabFood's order id; the dedupe/idempotency key is derived from it."),
    shortOrderNumber: z.string().optional().describe('Human-readable short reference shown to the customer (e.g. "GF-AB12").'),
    merchantID: z.string().min(1).describe('GrabFood merchant id; resolved to our internal store.'),
    paymentType: z.string().optional().describe('"CASH" or "CASHLESS"; mapped to our payment method.'),
    items: z
      .array(
        z.object({
          id: z.string().min(1).describe('Partner/merchant item id — our menu mapping key.'),
          grabItemID: z.string().optional().describe("Grab's catalog id (not used for mapping)."),
          quantity: z.number().int().positive(),
          price: z.number().int().nonnegative().describe('Unit price in minor currency units (cents).'),
          tax: z.number().int().nonnegative().optional(),
          specifications: z
            .string()
            .optional()
            .describe('Free-text preparation instructions → canonical item notes.'),
        }),
      )
      .min(1)
      .describe('Ordered line items.'),
    price: z
      .object({
        subtotal: z.number().int().nonnegative().describe('Order subtotal, minor units.'),
        total: z.number().int().nonnegative().describe('Authoritative grand total, minor units.'),
      })
      .passthrough()
      .describe('Authoritative order totals (minor units); we take subtotal + total from here.'),
  })
  .passthrough()
  .describe('GrabFood Submit Order webhook payload (developer.grab.com, GrabFood API v1.1.3).');

export type GrabFoodOrder = z.infer<typeof grabFoodOrderSchema>;
