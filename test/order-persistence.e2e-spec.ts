import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { validateEnv } from '../src/config/env.validation';
import { DatabaseModule } from '../src/database/database.module';
import { Order } from '../src/database/entities/order.entity';
import { OrderPersistenceService } from '../src/orders/order-persistence.service';
import { OrdersModule } from '../src/orders/orders.module';
import type { CanonicalOrder } from '../src/translation/canonical.types';

// Seeded internal entities (see src/database/seed.ts) — satisfy the FK constraints.
const STORE_ID = 'd3b07384-d113-4c4e-9c8e-a20468307d14';
const PRODUCT_ID = 'a1af8342-9901-44bb-b1d3-3b2046801c11';

function makeCanonical(idempotencyKey: string): CanonicalOrder {
  return {
    event: 'order.incoming',
    meta: {
      platform: 'GRABFOOD',
      order_id: idempotencyKey.split(':')[1] ?? idempotencyKey,
      short_order_id: idempotencyKey.split(':')[1] ?? idempotencyKey,
      idempotency_key: idempotencyKey,
      received_at: '2026-05-27T01:05:02Z',
    },
    order_details: {
      internal_store_id: STORE_ID,
      status: 'PENDING_ACCEPTANCE',
      payment_method: 'CASH_ON_DELIVERY',
      financials: { subtotal_cents: 2550, grand_total_cents: 2550 },
      items: [
        {
          internal_product_id: PRODUCT_ID,
          product_name: '1-pc Spicy Chicken Meal',
          quantity: 1,
          unit_price_cents: 2550,
          notes: 'less sugar and chili',
        },
      ],
    },
  };
}

describe('OrderPersistence (e2e)', () => {
  let app: INestApplication;
  let service: OrderPersistenceService;
  let dataSource: DataSource;
  const idempotencyKey = `grabfood:IT-${Date.now()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
        DatabaseModule,
        OrdersModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    service = app.get(OrderPersistenceService);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.getRepository(Order).delete({ idempotencyKey }); // cascades to items
    await app.close();
  });

  it('persists a canonical order with its items', async () => {
    const result = await service.persist(makeCanonical(idempotencyKey), {
      source: 'integration-test',
    });
    expect(result.created).toBe(true);
    expect(result.order).toBeDefined();

    const order = await dataSource.getRepository(Order).findOne({
      where: { idempotencyKey },
      relations: { items: true },
    });
    expect(order).not.toBeNull();
    expect(order?.grandTotalCents).toBe(2550);
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0].productName).toBe('1-pc Spicy Chicken Meal');
  });

  it('is idempotent on idempotency_key (second persist is a no-op)', async () => {
    const result = await service.persist(makeCanonical(idempotencyKey), {
      source: 'integration-test',
    });
    expect(result.created).toBe(false);

    const count = await dataSource.getRepository(Order).count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });
});
