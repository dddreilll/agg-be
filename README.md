# Delivery Operations Platform — Ingestion + Translation Service

NestJS backend for the delivery-aggregation platform.

- **Task 1 — Ingestion:** accepts order webhooks from delivery platforms (GrabFood today;
  Foodpanda / FB-chatbot later), **guards duplicates** via Redis, **acks in <200ms**, and
  **enqueues** the raw payload onto a BullMQ queue.
- **Task 2 — Translation:** a worker translates each raw payload into the **unified canonical
  schema**, resolving external→internal ids via Postgres (`platform_mappings` + `products`/
  `modifiers`), enum-mapping payment methods, and computing financials. Persistence (Task 3) and
  real-time broadcast (Task 4) are stubbed TODOs.

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
   → canonical order  → TODO: persist (Task 3) → broadcast (Task 4)
```

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

## Verify

```bash
# liveness / readiness
curl -s localhost:3000/healthz          # {"status":"ok"}
curl -s localhost:3000/readyz           # {"status":"ok","redis":"up"}

# ingest a GrabFood order (fixture mirrors the spec sample)
curl -s -w '\n%{time_total}s\n' -XPOST localhost:3000/webhooks/grabfood \
  -H 'content-type: application/json' -d @fixtures/grabfood-order-created.json
# → 202 { "status":"accepted", "idempotencyKey":"grabfood:PH-GRAB-992831", "jobId":"grabfood_PH-GRAB-992831" }

# replay the same webhook → deduped, not re-enqueued
curl -s -XPOST localhost:3000/webhooks/grabfood \
  -H 'content-type: application/json' -d @fixtures/grabfood-order-created.json
# → 200 { "status":"duplicate", "idempotencyKey":"grabfood:PH-GRAB-992831" }
```

The worker logs the translation; run with `LOG_LEVEL=debug` to see the full canonical object
(`internal_store_id`, `internal_product_id`, `product_name`, computed `financials`, …).

**Resilience:** stop Redis (`docker stop dops-redis`) while the app runs — it logs
`redis error` / `redis reconnecting` and keeps serving; `docker start dops-redis` resumes
processing. The process never crashes on a Redis blip.

## Tests

```bash
npm test            # unit: GrabFood translator reproduces the canonical sample (DB-free)
npm run test:e2e    # e2e: ingestion 202/200/400 (needs Redis + Postgres up)
```

## Configuration

See [.env.example](.env.example). Notable: `DATABASE_URL`, `REDIS_URL`, and
`IDEMPOTENCY_FAIL_OPEN` (default `true`) — whether a Redis outage during the dedupe check accepts
the order anyway or rejects with `503`.

## Database

The spec's DDL runs as a TypeORM migration ([src/database/migrations](src/database/migrations)) with
`synchronize: false`, so the hand-written schema stays authoritative. `npm run seed` is idempotent.

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
  database/                TypeORM entities, migration (spec DDL), data source, seed
  health/                  liveness/readiness
```
