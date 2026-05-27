# Delivery Operations Platform — Ingestion + Translation Service

NestJS backend for the delivery-aggregation platform.

- **Task 1 — Ingestion:** accepts order webhooks from delivery platforms (GrabFood today;
  Foodpanda / FB-chatbot later), **guards duplicates** via Redis, **acks in <200ms**, and
  **enqueues** the raw payload onto a BullMQ queue.
- **Task 2 — Translation:** a worker translates each raw payload into the **unified canonical
  schema**, resolving external→internal ids via Postgres (`platform_mappings` + `products`/
  `modifiers`), enum-mapping payment methods, and computing financials.
- **Task 3 — Persistence:** the canonical order is written to Postgres (`orders` + `order_items` +
  `order_item_modifiers`), **idempotent** on `idempotency_key` (the final guard after Redis + the
  BullMQ jobId).
- **Task 4 — Real-time distribution:** each newly-accepted order is pushed to its store's kitchen
  displays over **Socket.io** (namespace `/kitchen`, per-store rooms) — `order.incoming`.

## Architecture (request + worker paths)

```
POST /webhooks/:platform
   → IdempotencyInterceptor   (PlatformRegistry validates + derives "<platform>:<orderId>";
                               Redis SET NX; rolls the marker back if enqueue fails)
   → IngestionController      (duplicate → 200; else enqueue → 202)
   → IngestionProducer.add()  (BullMQ, jobId = sanitized dedupe key)
   → 202 { status: "accepted", idempotencyKey, jobId }

[worker] IngestionProcessor
   → TranslationService.translate(platform, raw)   (full zod validation)
   → GrabFood translator + PlatformMappingService  (Postgres: external_id → internal UUIDs + names)
   → OrderPersistenceService.persist(canonical)    (orders + items + modifiers; idempotent)
   → KitchenGateway.broadcastOrder(canonical)      (Socket.io → store room; only on a new order)

[kitchen display]  socket.io → ws://host/kitchen?storeId=<uuid>
   → joins room store:<uuid>  → receives `order.incoming` events
```

### Idempotency (three layers)

1. **Redis `SET NX`** at ingestion — drops duplicate webhooks before any work (rolled back if enqueue fails).
2. **BullMQ `jobId`** = dedupe key — refuses a second job for the same order.
3. **`UNIQUE(idempotency_key)`** on `orders` — the final guard; a duplicate insert is caught and skipped.

## Prerequisites

- Node.js >= 20 (developed on 22)
- Redis + PostgreSQL (use the bundled `docker-compose.yml`, or local installs)

## Quickstart

```bash
docker compose up -d            # Redis + Postgres
npm install
cp .env.example .env
npm run start:dev               # http://localhost:3000 (runs DB migrations on boot)
npm run seed                    # sample store/product/modifier + GrabFood mappings (matches the canonical sample)
```

## API documentation

The OpenAPI spec is generated from the controllers (`@nestjs/swagger`) and rendered with
[Scalar](https://scalar.com) (instead of Swagger UI):

- **Scalar API reference:** http://localhost:3000/reference
- **OpenAPI JSON** (for Postman / codegen): http://localhost:3000/openapi.json

**Schemas have one source of truth: the zod definitions.** Request/response models are
[`nestjs-zod`](https://github.com/BenLorantfy/nestjs-zod) DTOs (`createZodDto`) — the webhook body
is generated from the very same `grabFoodOrderSchema` the worker validates against, so the docs
can't drift from what we parse. `main.ts` post-processes the doc with `cleanupOpenApiDoc`. This is
docs-only: runtime validation is unchanged (the HTTP front door still reads just the order id; full
validation stays in the worker).

The real-time `/kitchen` Socket.io channel isn't part of the REST spec — it's described in the
document's summary (OpenAPI doesn't model WebSockets).

> The docs routes are mounted before `helmet`, so the Scalar page's CDN/inline assets aren't
> CSP-blocked; the API routes keep their full security headers.

## Verify

```bash
# liveness / readiness
curl -s localhost:3000/healthz          # {"status":"ok"}
curl -s localhost:3000/readyz           # {"status":"ok","redis":"up"}

# ingest a GrabFood order (fixture is the official Submit Order sample)
curl -s -w '\n%{time_total}s\n' -XPOST localhost:3000/webhooks/grabfood \
  -H 'content-type: application/json' -d @fixtures/grabfood-order-created.json
# → 202 { "status":"accepted", "idempotencyKey":"grabfood:123-CYNKLPCVRN5", "jobId":"grabfood_123-CYNKLPCVRN5" }

# replay the same webhook → deduped, not re-enqueued
curl -s -XPOST localhost:3000/webhooks/grabfood \
  -H 'content-type: application/json' -d @fixtures/grabfood-order-created.json
# → 200 { "status":"duplicate", "idempotencyKey":"grabfood:123-CYNKLPCVRN5" }

# the worker translated + persisted it — inspect the row:
docker exec dops-postgres psql -U dops -d dops -c \
  "SELECT external_order_id, payment_method, grand_total_cents FROM orders;"
```

The worker logs the translation + persistence; run with `LOG_LEVEL=debug` to see the full canonical
object (`internal_store_id`, `internal_product_id`, `product_name`, computed `financials`, …).

**Resilience:** stop Redis (`docker stop dops-redis`) while the app runs — it logs
`redis error` / `redis reconnecting` and keeps serving; `docker start dops-redis` resumes
processing. The process never crashes on a Redis blip.

## Kitchen displays (real-time)

A display connects over Socket.io to the `/kitchen` namespace and subscribes to its store; new
orders for that store arrive as `order.incoming` (the canonical order). Other stores' orders are
not delivered to it.

```js
import { io } from 'socket.io-client';
// pass the store on the handshake, or emit 'subscribe' after connecting
const socket = io('http://localhost:3000/kitchen', { query: { storeId: '<store-uuid>' } });
socket.on('order.incoming', (order) => renderTicket(order));
// socket.emit('subscribe', { storeId: '<another-store>' });
```

> MVP scope: the store is trusted from the handshake (add auth → store resolution later), and
> broadcast is in-process. For multiple app instances, add the Socket.io Redis adapter so emits
> fan out across nodes (Redis is already a dependency).

## Tests

```bash
npm test            # unit: GrabFood translator reproduces the canonical sample (DB-free)
npm run test:e2e    # e2e: ingestion (202/200/400) + persistence/idempotency + kitchen broadcast (needs Redis + Postgres)
```

## Configuration

See [.env.example](.env.example). Notable: `DATABASE_URL`, `REDIS_URL`, and
`IDEMPOTENCY_FAIL_OPEN` (default `true`) — whether a Redis outage during the dedupe check accepts
the order anyway or rejects with `503`.

## Database

Schema is managed by TypeORM migrations ([src/database/migrations](src/database/migrations)) with
`synchronize: false`, applied on boot (`migrationsRun`):
- `InitSchema` — the spec's menu DDL (stores, products, modifiers, `platform_mappings`, …).
- `CreateOrders` — `orders` + `order_items` + `order_item_modifiers` (Task 3).

`npm run seed` is idempotent (sample store/product/modifier + GrabFood mappings).

## Project layout

```
src/
  main.ts                  bootstrap (helmet, global exception filter, shutdown hooks)
  app.module.ts            root wiring
  config/                  zod-validated env
  common/filters/          central exception filter (request-id via pino genReqId)
  redis/                   ioredis provider with reconnect/backoff policy + graceful quit()
  ingestion/               controller, idempotency interceptor, platform registry, loose schema
  queue/                   BullMQ producer + processor (calls translation)
  translation/             canonical types, GrabFood schema + translator, DB-backed resolver
  orders/                  idempotent canonical-order persistence (orders + items + modifiers)
  realtime/                Socket.io kitchen gateway (per-store rooms, order.incoming)
  database/                TypeORM entities, migrations, data source, seed
  health/                  liveness/readiness
```
