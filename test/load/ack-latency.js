/**
 * k6 load test — verifies the <200ms ack guarantee under realistic burst.
 *
 * Usage:
 *   k6 run test/load/ack-latency.js
 *   k6 run --env BASE_URL=http://prod-host:3000 test/load/ack-latency.js
 *
 * Requires k6 (https://k6.io/docs/get-started/installation/).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const ackDuration = new Trend('ack_duration_ms', true);
const duplicates = new Counter('duplicate_acks');
const accepted = new Counter('accepted_acks');

export const options = {
  // Ramp from 0 → 50 VUs over 30 s, hold for 60 s, then ramp down.
  stages: [
    { duration: '30s', target: 50 },
    { duration: '60s', target: 50 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    // p99 must stay below 200 ms.
    ack_duration_ms: ['p(99)<200'],
    // p95 below 100 ms.
    'ack_duration_ms{scenario:default}': ['p(95)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Minimal GrabFood-style payload — real translation is irrelevant for ack timing.
function grabfoodPayload(orderId) {
  return JSON.stringify({
    orderID: orderId,
    merchantID: '1-LOADTEST',
    paymentType: 'CASH',
    items: [{ id: 'item-1', quantity: 1, price: 1000, specifications: '' }],
    price: { subtotal: 1000, total: 1000 },
  });
}

export default function () {
  // Use a time-based id so each VU iteration is unique, but replays are possible
  // (same second → idempotency check returns 200 duplicate on second hit).
  const orderId = `load-${__VU}-${Math.floor(Date.now() / 1000)}`;

  const res = http.post(
    `${BASE_URL}/webhooks/grabfood`,
    grabfoodPayload(orderId),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'webhook_ingest' },
    },
  );

  const ok = check(res, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'response has status field': (r) => {
      try {
        return JSON.parse(r.body).status !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (ok) {
    ackDuration.add(res.timings.duration);
    if (res.status === 200) duplicates.add(1);
    else accepted.add(1);
  }

  sleep(0.1); // 100 ms think-time between iterations per VU
}
