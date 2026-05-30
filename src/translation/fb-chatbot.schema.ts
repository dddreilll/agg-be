import { z } from 'zod';

export const fbChatbotItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

export const fbChatbotOrderSchema = z.object({
  orderId: z.string().min(1),
  shortOrderId: z.string().min(1),
  storeId: z.string().uuid(),
  customerName: z.string().optional(),
  contactNumber: z.string().optional(),
  deliveryAddress: z.string().optional(),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'ONLINE_PAYMENT']),
  items: z.array(fbChatbotItemSchema).min(1),
  subtotalCents: z.number().int().nonnegative(),
  grandTotalCents: z.number().int().nonnegative(),
});

export type FbChatbotOrder = z.infer<typeof fbChatbotOrderSchema>;
