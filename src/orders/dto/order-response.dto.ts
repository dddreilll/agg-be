import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ORDER_STATUSES } from '../../translation/canonical.types';

const modifierSchema = z.object({
  id: z.string().uuid(),
  modifierId: z.string().uuid().nullable(),
  modifierName: z.string(),
  addedPriceCents: z.number().int(),
});

const orderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  productName: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  notes: z.string().nullable(),
  position: z.number().int(),
  modifiers: z.array(modifierSchema),
});

export const orderResponseSchema = z.object({
  id: z.string().uuid(),
  platform: z.string(),
  externalOrderId: z.string(),
  shortOrderId: z.string(),
  storeId: z.string().uuid(),
  status: z.enum(ORDER_STATUSES as [string, ...string[]]),
  paymentMethod: z.string(),
  subtotalCents: z.number().int(),
  modifierTotalCents: z.number().int(),
  grandTotalCents: z.number().int(),
  receivedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(orderItemSchema),
});

export const paginatedOrdersSchema = z.object({
  data: z.array(orderResponseSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasNextPage: z.boolean(),
  }),
});

export class OrderResponseDto extends createZodDto(orderResponseSchema) {}
export class PaginatedOrdersDto extends createZodDto(paginatedOrdersSchema) {}

export function serializeOrder(order: import('../../database/entities/order.entity').Order) {
  return {
    id: order.id,
    platform: order.platform,
    externalOrderId: order.externalOrderId,
    shortOrderId: order.shortOrderId ?? null,
    storeId: order.storeId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotalCents: order.subtotalCents,
    modifierTotalCents: order.modifierTotalCents,
    grandTotalCents: order.grandTotalCents,
    receivedAt: order.receivedAt?.toISOString(),
    createdAt: order.createdAt?.toISOString(),
    updatedAt: order.updatedAt?.toISOString(),
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      productId: item.productId ?? null,
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      notes: item.notes ?? null,
      position: item.position,
      modifiers: (item.modifiers ?? []).map((mod) => ({
        id: mod.id,
        modifierId: mod.modifierId ?? null,
        modifierName: mod.modifierName,
        addedPriceCents: mod.addedPriceCents,
      })),
    })),
  };
}
