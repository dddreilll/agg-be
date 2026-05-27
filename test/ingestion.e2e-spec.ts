import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * End-to-end ingestion checks. Requires a running Redis (see docker-compose.yml).
 * A unique order id per run keeps reruns from colliding with retained dedupe markers.
 */
describe('Ingestion (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a new GrabFood webhook (202), then dedupes the replay (200)', async () => {
    const orderId = `E2E-${Date.now()}`;
    // Official GrabFood Submit Order shape, using seeded mapping ids so the worker translates cleanly.
    const payload = {
      orderID: orderId,
      merchantID: '1-CYNGRUNGSBCCC',
      paymentType: 'CASHLESS',
      items: [{ id: 'item-1', quantity: 1, price: 2550, specifications: 'no onions' }],
      price: { subtotal: 2550, total: 2550 },
    };

    const first = await request(app.getHttpServer())
      .post('/webhooks/grabfood')
      .send(payload)
      .expect(202);
    expect(first.body).toMatchObject({
      status: 'accepted',
      idempotencyKey: `grabfood:${orderId}`,
    });

    const replay = await request(app.getHttpServer())
      .post('/webhooks/grabfood')
      .send(payload)
      .expect(200);
    expect(replay.body).toMatchObject({
      status: 'duplicate',
      idempotencyKey: `grabfood:${orderId}`,
    });
  });

  it('rejects an unsupported platform (400)', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/ubereats')
      .send({ data: { orderID: 'X' } })
      .expect(400);
  });

  it('rejects a malformed GrabFood payload (400)', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/grabfood')
      .send({ nope: true })
      .expect(400);
  });
});
