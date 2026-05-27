import { z } from 'zod';

/**
 * Structural validation of Foodpanda's order webhook payload (the "Order" object
 * delivered to the integration's order-placed callback). As with GrabFood we only
 * validate the fields we consume and pass the rest through (customer, delivery,
 * discounts, promos, callbackUrls, …).
 *
 * Unlike GrabFood, Foodpanda sends **money as decimal strings** (e.g. "25.50") and
 * **quantity as a string**; both are normalized in the translator. There is no
 * explicit items subtotal, so the translator computes it from the line items.
 */

// A decimal monetary amount serialized as a string, e.g. "25.50" / "6.42".
const moneyString = z.string().describe('Decimal amount as a string, e.g. "25.50".');
// Quantity may arrive as a numeric string ("2") or a number; tolerated in the translator.
const quantity = z.union([z.string(), z.number()]);

export const foodpandaOrderSchema = z
  .object({
    token: z
      .string()
      .min(1)
      .describe("Foodpanda order token (UUID); the dedupe/idempotency key is derived from it."),
    code: z.string().optional().describe('Human-readable order code, e.g. "n0s1-w0k1".'),
    expeditionType: z.string().optional().describe('"delivery" or "pickup".'),
    payment: z
      .object({
        status: z
          .string()
          .optional()
          .describe('"paid" (prepaid online) or "pending" (pay at delivery/pickup) — drives our payment method.'),
        type: z
          .string()
          .optional()
          .describe('Free-text payment type; per the docs, not used to decide paid-online vs pay-on-delivery.'),
      })
      .passthrough()
      .optional(),
    platformRestaurant: z
      .object({
        id: z.string().min(1).describe('Foodpanda restaurant id; resolved to our internal store.'),
      })
      .passthrough(),
    products: z
      .array(
        z
          .object({
            id: z.string().optional().describe("Foodpanda's platform product id."),
            remoteCode: z
              .string()
              .min(1)
              .nullish()
              .describe('Merchant/POS product id — our menu mapping key (may be null; falls back to platform id).'),
            sku: z.string().optional(),
            name: z
              .string()
              .optional()
              .describe('Platform product name (informational; canonical name comes from our catalog).'),
            quantity: quantity.describe('Ordered quantity (Foodpanda sends a string).'),
            unitPrice: moneyString.describe('Per-unit price as a decimal string.'),
            paidPrice: moneyString.optional().describe('Line price actually paid (decimal string).'),
            comment: z.string().optional().describe('Per-item note → canonical item notes.'),
            selectedToppings: z
              .array(
                z
                  .object({
                    id: z.string().optional(),
                    remoteCode: z
                      .string()
                      .min(1)
                      .nullish()
                      .describe('Merchant/POS modifier id — our modifier mapping key (may be null; falls back to platform id).'),
                    sku: z.string().optional(),
                    name: z.string().optional(),
                    price: moneyString.describe('Per-unit topping price, decimal string.'),
                    quantity: quantity.default(1),
                  })
                  .passthrough(),
              )
              .default([])
              .describe('Selected modifiers/toppings for this product.'),
          })
          .passthrough(),
      )
      .min(1)
      .describe('Ordered products.'),
    price: z
      .object({
        grandTotal: moneyString.describe('Authoritative grand total, decimal string.'),
      })
      .passthrough()
      .describe('Order totals; the grand total is taken from here.'),
  })
  .passthrough()
  .describe('Foodpanda order webhook payload.');

export type FoodpandaOrder = z.infer<typeof foodpandaOrderSchema>;
