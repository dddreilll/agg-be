import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { type Socket, io } from 'socket.io-client';
import { RealtimeModule } from '../src/realtime/realtime.module';
import { KitchenGateway } from '../src/realtime/kitchen.gateway';
import type { Order } from '../src/database/entities/order.entity';

const STORE_A = 'd3b07384-d113-4c4e-9c8e-a20468307d14';
const STORE_B = '11111111-1111-1111-1111-111111111111';

function sampleOrder(storeId: string, orderId: string): Order {
  return {
    id: orderId,
    idempotencyKey: `grabfood:${orderId}`,
    platform: 'GRABFOOD',
    externalOrderId: orderId,
    shortOrderId: orderId.slice(-4),
    storeId,
    status: 'PENDING_ACCEPTANCE',
    paymentMethod: 'CASH_ON_DELIVERY',
    subtotalCents: 2550,
    grandTotalCents: 2550,
    receivedAt: new Date('2026-05-27T01:05:02Z'),
    rawPayload: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  } as unknown as Order;
}

function connect(url: string, storeId: string): Promise<Socket> {
  const socket = io(url, { transports: ['websocket'], query: { storeId }, forceNew: true });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('KitchenGateway (e2e)', () => {
  let app: INestApplication;
  let gateway: KitchenGateway;
  let url: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [RealtimeModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    const port = (app.getHttpServer().address() as { port: number }).port;
    url = `http://localhost:${port}/kitchen`;
    gateway = app.get(KitchenGateway);
  });

  afterAll(async () => {
    await app.close();
  });

  it('delivers a new order only to displays subscribed to its store', async () => {
    const displayA = await connect(url, STORE_A);
    const displayB = await connect(url, STORE_B);
    await delay(150); // let server-side room joins settle

    const orderId = `WS-${Date.now()}`;
    const receivedByA = new Promise<Record<string, unknown>>((resolve) =>
      displayA.on('order.incoming', resolve),
    );
    let bReceived = false;
    displayB.on('order.incoming', () => {
      bReceived = true;
    });

    gateway.broadcastOrder(sampleOrder(STORE_A, orderId));

    const order = await Promise.race([
      receivedByA,
      delay(3000).then(() => {
        throw new Error('store A display did not receive the order');
      }),
    ]);
    expect(order['externalOrderId']).toBe(orderId);
    expect(order['storeId']).toBe(STORE_A);

    await delay(200);
    expect(bReceived).toBe(false); // store B must not get store A's order

    displayA.disconnect();
    displayB.disconnect();
  });
});
