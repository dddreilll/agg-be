# Roadmap

Status of the delivery operations platform and what's worth building next.

## Where the system stands

The pipeline today is **one-directional inbound**:

```
platform webhook → ack (<200ms) → translate → persist → WebSocket push to kitchen
```

Done so far:

- **Task 1** — Ingestion middleware (accept webhooks, fast ack, Redis idempotency, enqueue)
- **Task 2** — Translation (raw platform payload → canonical schema, DB-backed id resolution)
- **Task 3** — Persistence (Postgres, idempotent on `idempotency_key`)
- **Task 4** — Real-time WebSocket broadcast (Socket.io) to per-store kitchen rooms
- **API docs** — OpenAPI via `@nestjs/swagger`, rendered with Scalar at `/reference`

Orders go *in* and get *displayed*. Most of what follows is about closing loops
that don't exist yet, or hardening what does.

## 1. Core product gaps (the actual middleware value)

Roughly in dependency order.

- [ ] **Read API for the dashboard** — list/fetch/filter/paginate orders. The
  WebSocket only *pushes new* orders; a client that connects or reconnects has no
  way to load current open orders. Most immediate gap.
- [ ] **Order status lifecycle** — accept / reject / preparing / ready /
  completed / cancelled, merchant-initiated. The heart of "solving tablet hell."
- [ ] **Outbound status updates back to platforms** — confirm/reject/ready calls
  to GrabFood (and others). Closes the loop. Requires outbound auth/token handling.
- [ ] **Merchant Menu / Product Management** — merchants can create, edit, and
  delete products scoped to each connected platform. Each platform has its own
  product schema (GrabFood, Foodpanda, etc.), so products are stored
  canonically and translated per-platform on sync.
  - [ ] Product CRUD API with per-platform availability flags.
  - [ ] Platform-specific field mapping (name, description, price, modifiers,
    images) per adapter.
  - [ ] **86'ing** — mark items temporarily unavailable and push the change out
    to all connected platforms in real time.
  - [ ] Menu sync — push full catalog or incremental changes to platforms on
    demand or on a schedule.
- [ ] **Frontend** — merchant dashboard / kitchen display consuming WS + read API.

## 2. Robustness / correctness

- [x] **Inbound webhook authentication per platform** —
  GrabFood: Partner OAuth — Grab calls `POST /auth/grab-token` with client credentials, receives
  an HMAC-SHA256-signed Bearer token, and includes it on every webhook call; guard verifies
  signature + expiry. Foodpanda: static Bearer token (configured via Vendor Portal) compared
  with `timingSafeEqual`. FB_CHATBOT bypassed (internal). Secrets are fail-open when unset
  (dev), enforced in prod by setting the env vars.
- [x] **Dead-letter handling for failed jobs** — BullMQ keeps failed jobs for 24 h
  (configured via `removeOnFail`). `GET /dlq`, `GET /dlq/:id`, `POST /dlq/:id/retry`,
  and `DELETE /dlq/:id` allow inspection and manual re-queue.
- [x] **`readyz` reflects Postgres too** — now pings both Redis and Postgres with a
  1 s timeout each; returns `{ redis, postgres }` fields and 503 if either is down.
- [x] **Idempotency fail-open confirmed safe** — `IDEMPOTENCY_FAIL_OPEN=true` lets
  orders through on a Redis blip; the `idempotency_key UNIQUE` constraint on the
  `orders` table and the `PG_UNIQUE_VIOLATION` handler in `OrderPersistenceService`
  prevent any duplicate from ever being persisted.

## 3. Scale / deployment architecture

- [x] **Socket.io Redis adapter** — `RedisIoAdapter` replaces the in-memory `IoAdapter`.
  Two dedicated ioredis pub/sub connections (sharing the resilience policy from
  `redis.factory.ts`) are created at boot and wired into the Socket.io server so
  room broadcasts reach clients on every app instance.
- [x] **Containerize the app + prod compose / CI-CD** — multi-stage `Dockerfile`
  (builder → lean production image, non-root user). `docker-compose.yml` gained an
  `app` service with `depends_on` health-gate on Redis and Postgres.
  `.github/workflows/ci.yml`: type-check → unit tests → Docker build on every push.
- [x] **Backpressure under burst** — `INGESTION_QUEUE_MAX_DEPTH` (optional env var):
  producer checks waiting-job count before enqueuing and returns 503 when over limit
  so platforms retry later instead of piling up unbounded work. `GET /dlq` now also
  returns `queue.{ waiting, active, delayed, failed }` counts for at-a-glance health.

## 4. Observability

- [x] **Metrics** — `prom-client` exposes `GET /metrics` (Prometheus). Gauges: queue depth
  by state (refreshed every 15 s by `QueueDepthCollector`). Histograms: `webhook_ack_duration_seconds`
  (per platform + result), `ingestion_job_duration_seconds`. Counters: `kitchen_broadcast_order_total`,
  `kitchen_broadcast_status_total`. Default Node.js process metrics included.
  Request correlation IDs already wired via pino-http `genReqId` + `x-request-id` header.
- [x] **Load-test the <200ms ack guarantee** — k6 script at `test/load/ack-latency.js`.
  Ramps to 50 VUs; asserts p99 < 200 ms and p95 < 100 ms.

## 5. Data & multi-tenancy

- [x] **Order event/audit log** — `order_events` table (migration `1779910000000`). Events
  emitted on `order.created` (from `OrderPersistenceService`) and `order.status_changed`
  (from `OrdersQueryService.updateStatus`). Read via `GET /orders/:id/events`.
- [x] **Merchant/store onboarding & `platform_mappings` management** — `StoresModule`
  provides full CRUD: `GET/POST /stores`, `GET/PATCH/DELETE /stores/:id`, and
  `GET/POST/PATCH/DELETE /stores/:id/mappings` for platform mapping management.
- [x] **Retention / archival** — `MaintenanceModule` + `OrderRetentionService` (nightly cron).
  `ORDER_RETENTION_DAYS` (default 90): soft-archives completed/cancelled orders.
  `ORDER_ARCHIVE_DAYS` (default 365): hard-deletes archived orders. `GET /orders` excludes
  archived orders. Migration `1779920000000` adds `archived_at` column.

## Suggested sequence

1. Read API (#1) — unblocks the frontend, small.
2. Order status lifecycle (#1) — the core feature.
3. Webhook signature verification (#2) — cheap, closes a real security hole.
4. Outbound status updates (#1) — closes the platform loop.
5. Second platform adapter (#1) — proves the abstraction.
6. Merchant Menu / Product Management (#1) — canonical product store + per-platform sync.

The frontend can start in parallel once the Read API exists.
