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
    orderID: z.string().min(1),
    merchantID: z.string().min(1),
    paymentType: z.string().optional(), // "CASH" | "CASHLESS"
    items: z
      .array(
        z.object({
          id: z.string().min(1), // partner/merchant item id (our mapping key)
          grabItemID: z.string().optional(), // Grab's catalog id (unused for mapping)
          quantity: z.number().int().positive(),
          price: z.number().int().nonnegative(), // unit price, minor units
          tax: z.number().int().nonnegative().optional(),
          specifications: z.string().optional(), // free-text instructions → notes
          modifiers: z
            .array(
              z.object({
                id: z.string().min(1),
                price: z.number().int().nonnegative(), // unit price, minor units
                quantity: z.number().int().nonnegative().default(1),
                tax: z.number().int().nonnegative().optional(),
              }),
            )
            .default([]),
        }),
      )
      .min(1),
    // Authoritative order totals (minor units). We take subtotal + total from here.
    price: z
      .object({
        subtotal: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

export type GrabFoodOrder = z.infer<typeof grabFoodOrderSchema>;
