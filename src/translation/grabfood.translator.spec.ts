import type { CanonicalOrder } from './canonical.types';
import type { EntityResolver, ResolvedEntity } from './entity-resolver';
import { grabFoodOrderSchema } from './grabfood.schema';
import { translateGrabFoodOrder } from './grabfood.translator';

const STORE_ID = 'd3b07384-d113-4c4e-9c8e-a20468307d14';
const PRODUCT_ID = 'a1af8342-9901-44bb-b1d3-3b2046801c11';
const MODIFIER_ID = '7cc83411-fa02-4bb3-bc12-1a2046899e02';

// Fake resolver returning the seeded internal entities — keeps this test DB-free.
const fakeResolver: EntityResolver = {
  resolveStoreId: async () => STORE_ID,
  resolveProduct: async (): Promise<ResolvedEntity> => ({
    id: PRODUCT_ID,
    name: '1-pc Spicy Chicken Meal',
  }),
  resolveModifier: async (): Promise<ResolvedEntity> => ({
    id: MODIFIER_ID,
    name: 'Garlic Rice Upgrade',
  }),
};

describe('translateGrabFoodOrder', () => {
  it('translates the official GrabFood Submit Order payload into the canonical shape', async () => {
    const order = grabFoodOrderSchema.parse({
      orderID: '123-CYNKLPCVRN5',
      shortOrderNumber: 'GF-123',
      merchantID: '1-CYNGRUNGSBCCC',
      paymentType: 'CASH',
      currency: { code: 'PHP', symbol: 'P', exponent: 2 },
      items: [
        {
          id: 'item-1',
          grabItemID: 'IDGFSTI000004qy1490868132306763533#0',
          quantity: 1,
          price: 2550,
          tax: 144,
          specifications: 'less sugar and chili',
          modifiers: [{ id: 'modifier-1', price: 175, tax: 10, quantity: 1 }],
        },
      ],
      price: { subtotal: 2550, tax: 117, total: 2075 },
    });

    const canonical = await translateGrabFoodOrder(
      order,
      { idempotencyKey: 'grabfood:123-CYNKLPCVRN5', receivedAt: '2026-05-27T01:05:02Z' },
      fakeResolver,
    );

    const expected: CanonicalOrder = {
      event: 'order.incoming',
      meta: {
        platform: 'GRABFOOD',
        order_id: '123-CYNKLPCVRN5',
        short_order_id: 'GF-123',
        idempotency_key: 'grabfood:123-CYNKLPCVRN5',
        received_at: '2026-05-27T01:05:02Z',
      },
      order_details: {
        internal_store_id: STORE_ID,
        status: 'PENDING_ACCEPTANCE',
        payment_method: 'CASH_ON_DELIVERY',
        // subtotal + grand_total from Grab's price object; modifier_total summed from line modifiers.
        financials: { subtotal_cents: 2550, modifier_total_cents: 175, grand_total_cents: 2075 },
        items: [
          {
            internal_product_id: PRODUCT_ID,
            product_name: '1-pc Spicy Chicken Meal',
            quantity: 1,
            unit_price_cents: 2550,
            notes: 'less sugar and chili',
            customizations: [
              {
                internal_modifier_id: MODIFIER_ID,
                modifier_name: 'Garlic Rice Upgrade',
                added_price_cents: 175,
              },
            ],
          },
        ],
      },
    };

    expect(canonical).toEqual(expected);
  });

  it('maps CASHLESS → ONLINE_PAYMENT and an order with no modifiers', async () => {
    const order = grabFoodOrderSchema.parse({
      orderID: 'PH-GRAB-1',
      merchantID: '1-CYNGRUNGSBCCC',
      paymentType: 'CASHLESS',
      items: [{ id: 'item-1', quantity: 3, price: 10000 }],
      price: { subtotal: 30000, total: 27000 },
    });

    const canonical = await translateGrabFoodOrder(
      order,
      { idempotencyKey: 'grabfood:PH-GRAB-1', receivedAt: '2026-05-27T02:00:00Z' },
      fakeResolver,
    );

    expect(canonical.order_details.payment_method).toBe('ONLINE_PAYMENT');
    expect(canonical.order_details.financials).toEqual({
      subtotal_cents: 30000,
      modifier_total_cents: 0,
      grand_total_cents: 27000,
    });
    expect(canonical.order_details.items[0].notes).toBeUndefined();
    expect(canonical.order_details.items[0].customizations).toEqual([]);
  });
});
