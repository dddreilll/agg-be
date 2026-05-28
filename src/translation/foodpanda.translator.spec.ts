import type { CanonicalOrder } from './canonical.types';
import type { EntityResolver, ResolvedEntity } from './entity-resolver';
import { foodpandaOrderSchema } from './foodpanda.schema';
import { translateFoodpandaOrder } from './foodpanda.translator';

const STORE_ID = 'd3b07384-d113-4c4e-9c8e-a20468307d14';
const FP_PRODUCT_ID = 'f1e2d3c4-b5a6-4789-9c8b-1a2b3c4d5e6f';

// Fake resolver returning the seeded internal entities — keeps this test DB-free.
const fakeResolver: EntityResolver = {
  resolveStoreId: async () => STORE_ID,
  resolveProduct: async (): Promise<ResolvedEntity> => ({
    id: FP_PRODUCT_ID,
    name: 'Double Cheese Burger',
  }),
};

describe('translateFoodpandaOrder', () => {
  it('translates the official Foodpanda Dispatch Order payload into the canonical shape', async () => {
    // Trimmed to the fields we consume, values from the official genericOrderExample.
    // Note: product.quantity is the doc's "string" placeholder → defaults to 1;
    // money fields are decimal strings → integer cents; payment.status drives method.
    const order = foodpandaOrderSchema.parse({
      token: '5f373562-591a-4db9-8609-7eec7880f28d',
      code: 'n0s1-w0k1',
      expeditionType: 'pickup',
      payment: { status: 'paid', type: 'paid' },
      platformRestaurant: { id: 'sq-abcd' },
      products: [
        {
          id: 'ID_FOR_DOUBLE_CHEESE_BURGER_ON_PLATFORM',
          name: 'Double Cheese Burger',
          remoteCode: 'ID_FOR_DOUBLE_CHEESE_BURGER_ON_POS',
          sku: 'SKU_FOR_DOUBLE_CHEESE_BURGER_ON_POS',
          quantity: 'string',
          unitPrice: '6.42',
          paidPrice: '8.00',
          comment: 'No cheese please',
        },
      ],
      price: { subTotal: '19.45', totalNet: '19.45', vatTotal: '2.50', grandTotal: '25.50' },
    });

    const canonical = await translateFoodpandaOrder(
      order,
      { idempotencyKey: 'foodpanda:5f373562-591a-4db9-8609-7eec7880f28d', receivedAt: '2026-05-27T03:00:00Z' },
      fakeResolver,
    );

    const expected: CanonicalOrder = {
      event: 'order.incoming',
      meta: {
        platform: 'FOODPANDA',
        order_id: '5f373562-591a-4db9-8609-7eec7880f28d',
        short_order_id: 'n0s1-w0k1',
        idempotency_key: 'foodpanda:5f373562-591a-4db9-8609-7eec7880f28d',
        received_at: '2026-05-27T03:00:00Z',
      },
      order_details: {
        internal_store_id: STORE_ID,
        status: 'PENDING_ACCEPTANCE',
        payment_method: 'ONLINE_PAYMENT', // payment.status === 'paid'
        // decimal strings → cents; subtotal summed from line items (unitPrice × qty).
        financials: { subtotal_cents: 642, grand_total_cents: 2550 },
        items: [
          {
            internal_product_id: FP_PRODUCT_ID,
            product_name: 'Double Cheese Burger',
            quantity: 1, // "string" placeholder → 1
            unit_price_cents: 642,
            notes: 'No cheese please',
          },
        ],
      },
    };

    expect(canonical).toEqual(expected);
  });

  it('maps payment.status "pending" → CASH_ON_DELIVERY and handles a numeric-string qty', async () => {
    const order = foodpandaOrderSchema.parse({
      token: 'fp-2',
      code: 'aaaa-bbbb',
      payment: { status: 'pending', type: 'cash' },
      platformRestaurant: { id: 'sq-abcd' },
      products: [
        {
          id: 'ID_FOR_DOUBLE_CHEESE_BURGER_ON_PLATFORM',
          remoteCode: 'ID_FOR_DOUBLE_CHEESE_BURGER_ON_POS',
          quantity: '2',
          unitPrice: '10.00',
        },
      ],
      price: { grandTotal: '20.00' },
    });

    const canonical = await translateFoodpandaOrder(
      order,
      { idempotencyKey: 'foodpanda:fp-2', receivedAt: '2026-05-27T04:00:00Z' },
      fakeResolver,
    );

    expect(canonical.order_details.payment_method).toBe('CASH_ON_DELIVERY');
    expect(canonical.order_details.financials).toEqual({
      subtotal_cents: 2000, // 1000 × 2
      grand_total_cents: 2000,
    });
    expect(canonical.order_details.items[0].quantity).toBe(2);
    expect(canonical.order_details.items[0].notes).toBeUndefined();
  });
});
