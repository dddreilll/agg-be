# Roadmap

> **Instructions for AI code agents**
>
> This file is the authoritative task list for the `agg-be` NestJS backend. When
> fed this file, read it fully before writing any code. Follow the rules below.
>
> **What this project is**
> A delivery-operations middleware that ingests order webhooks from food-delivery
> platforms (GrabFood, Foodpanda, …), translates them to a canonical schema,
> persists them in Postgres, and pushes real-time updates to kitchen displays via
> Socket.io. Stack: NestJS 11 · TypeORM · BullMQ · Redis · PostgreSQL · prom-client.
>
> **How to read this file**
> - `[x]` — fully implemented. Do not re-implement or refactor unless explicitly asked.
> - `[ ]` — not yet implemented. Pick the first unchecked item in the
>   **Suggested sequence** at the bottom unless the user specifies otherwise.
> - Each section has a number (`#1`, `#6`, …). The sequence references these numbers.
>
> **Patterns to follow — read existing code before writing new code**
> - **DTOs** — always use `nestjs-zod`: define a `z.object()` schema, then
>   `export class FooDto extends createZodDto(fooSchema) {}`. Never use
>   `class-validator` decorators.
> - **Modules** — one feature per module folder (`src/<feature>/`). Every new
>   entity goes into `TypeOrmModule.forFeature([...])` inside its own module.
>   New modules must be added to `src/app.module.ts` imports.
> - **Entities & migrations** — add the entity class to `ENTITIES` in
>   `src/database/data-source-options.ts` and generate/write a migration under
>   `src/database/migrations/`. Never set `synchronize: true`.
> - **Global services** — only use `@Global()` for cross-cutting concerns
>   (e.g. `MetricsModule`). Prefer explicit module imports otherwise.
> - **Optional injection** — use `@Optional() @Inject(Token)` when a service is
>   global but the consuming module does not explicitly import it.
> - **Batch DB operations** — use `dataSource.query()` raw SQL for bulk
>   UPDATE/DELETE. Do not use QueryBuilder for operations that map cleanly to a
>   single SQL statement.
> - **Environment variables** — every new env var must be added to the Zod schema
>   in `src/config/env.validation.ts` with a type, validation, and a safe default.
> - **Error handling** — throw NestJS built-in exceptions (`NotFoundException`,
>   `BadRequestException`, etc.). Do not add try/catch for cases that cannot happen.
> - **Comments** — write no comments unless the WHY is non-obvious. No docstrings.
>
> **Definition of done**
> 1. `npx tsc --noEmit` exits with zero output (no type errors).
> 2. The new feature follows the patterns above — no new patterns introduced
>    without a stated reason.
> 3. The relevant `[ ]` item in this file is flipped to `[x]` with a one-line
>    description of what was implemented.
> 4. Any new env vars are documented in `.env.example`.

---

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

- [x] **Read API for the dashboard** — `GET /orders` (paginated, filterable by
  store / platform / status / date range), `GET /orders/:id`, `GET /orders/:id/events`.
  Archived orders excluded by default.
- [x] **Order status lifecycle** — `PATCH /orders/:id/status`. Persists the
  transition, appends an `order.status_changed` audit event, broadcasts
  `order.status_updated` over WebSocket, and fires the outbound adapter.
- [ ] **Outbound status updates back to platforms** — `OutboundDispatchService`
  and per-platform adapters are wired and called on every status change, but the
  actual HTTP calls are stubs. Needs real implementation:
  - [ ] **GrabFood** — `POST .../order/v1/orders/{orderID}/{action}` with Bearer
    token from the partner OAuth2 flow (`GRABFOOD_CLIENT_ID` / `GRABFOOD_CLIENT_SECRET`).
    Status → action map already defined (`accept`, `reject`, `prepare`, `ready`).
  - [ ] **Foodpanda** — equivalent outbound call with static Bearer token
    (`FOODPANDA_WEBHOOK_SECRET`). Action map to be confirmed against Foodpanda docs.
- [x] **Merchant Menu / Product Management** — canonical product store with
  per-platform mappings. Full implementation:
  - [x] Product CRUD — `GET/POST /catalog/products`, `GET/PATCH/DELETE /catalog/products/:id`,
    category management at `GET/POST /catalog/categories`.
  - [x] Platform-specific field mapping — `POST /catalog/products/:id/platforms`
    links a product to a platform-native external ID via `platform_mappings`.
  - [x] **86'ing** — `PATCH /catalog/products/:id/availability` sets `isAvailable`
    globally or per-platform and flags all affected mappings `isSynced=false`.
  - [ ] **Menu sync** — `isSynced=false` is flagged correctly but nothing pushes
    the change out. Needs a `POST /catalog/sync` endpoint (or background job) that
    reads all unsynced mappings and calls the platform's menu update API.
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

## 6. Authentication & authorisation

The dashboard API and WebSocket are currently wide open — any request is accepted.
Before any public deployment with real merchant data, this needs to close.

- [ ] **API authentication** — JWT-based auth for the REST API. `POST /auth/login`
  issues a short-lived access token + refresh token. All dashboard endpoints
  (`/orders`, `/catalog`, `/stores`) require `Authorization: Bearer <token>`.
- [ ] **Role-based access control** — three roles cover the real-world use case:
  - `SUPER_ADMIN` — cross-merchant access, store onboarding, platform key management.
  - `MERCHANT_ADMIN` — scoped to their own stores; can manage catalog, view all orders.
  - `KITCHEN_DISPLAY` — read-only, scoped to a single store; receives WS events only.
- [ ] **WebSocket auth** — Socket.io `auth` handshake payload carries the JWT; guard
  verifies it and sets the store scope on the socket before joining any room.
- [ ] **Store-scoped data isolation** — add a `merchantId` foreign key to `stores`
  and enforce it at the query layer so a `MERCHANT_ADMIN` token can never read
  another merchant's orders or catalog.

## 7. Testing

No automated tests exist yet. The CI pipeline type-checks and builds the image but
does not run any test suite.

- [ ] **Unit tests for translators** — each platform translator (`grabfood.translator.ts`,
  `foodpanda.translator.ts`) is pure function logic; snapshot tests with fixture payloads
  catch regressions without a database.
- [ ] **Unit tests for outbound adapters** — mock `fetch`/`axios` and assert the correct
  HTTP call shape and status-to-action mapping.
- [ ] **Integration tests for the ingestion pipeline** — spin up real Postgres + Redis
  (Testcontainers or `docker-compose -f docker-compose.test.yml`), post a raw webhook
  payload to `POST /webhooks/grabfood`, and assert the order appears in `GET /orders`.
- [ ] **Integration tests for the retention cron** — seed orders older than
  `ORDER_RETENTION_DAYS`, trigger `runRetention()` directly, assert `archived_at` is set.
- [ ] **CI coverage gate** — add `jest --coverage` to `.github/workflows/ci.yml` with a
  minimum threshold (e.g. 70% lines) so coverage can't silently regress.

## 8. Additional platform adapters

The inbound translator + outbound adapter pattern is proven with GrabFood. Each new
platform is a translator file + an outbound adapter — no core changes needed.

- [ ] **ShopeeFood** — growing SEA market share; webhook shape and outbound API to be
  confirmed against Shopee partner docs.
- [ ] **Lalamove / Mrspeedy** — delivery-only platforms (no order management UI); mainly
  inbound webhook for delivery status updates.
- [ ] **Self-serve adapter registration** — currently adapters are hard-coded in
  `OutboundDispatchService`. A dynamic registry (`Map` populated at module init from
  a config token) lets new adapters be added without touching dispatch logic.
- [ ] **Webhook replay / backfill** — store the raw inbound payload on the `orders` row
  so a failed translation can be re-run against an updated translator without losing data.

## 9. Alerting & SLOs

Metrics are scraped but no alerts are defined. Without rules, the dashboards are
decorative — nobody is paged when the system breaks.

- [ ] **Prometheus alerting rules** — critical rules to start with:
  - `ingestion_queue_depth{state="failed"} > 10` → page immediately.
  - `rate(webhook_ack_duration_seconds_bucket[5m])` p99 > 200 ms sustained → warn.
  - `up == 0` for the app target → page immediately.
- [ ] **SLO definitions** — formalise the two implicit guarantees:
  - Ack SLO: 99.9% of inbound webhooks acknowledged within 200 ms.
  - Delivery SLO: 99.5% of accepted jobs successfully persisted within 10 s.
- [ ] **Alertmanager + notification channel** — route firing alerts to Slack
  (`#ops-alerts`) for warn and PagerDuty for critical. Silence rules for
  maintenance windows.
- [ ] **Grafana dashboard** — one board with four rows: queue health, ack latency
  histogram, job duration histogram, WebSocket broadcast rate. Export as JSON
  and commit to `infra/grafana/`.

## 10. Developer experience

- [ ] **Seed script** — `npm run seed` populates a local database with one store,
  one GrabFood platform mapping, and a handful of orders in various statuses.
  Unblocks frontend and QA work without needing a live platform webhook.
- [ ] **Bruno / Postman collection** — export the OpenAPI spec to a committed
  `api.json` collection so the team can run requests without opening the Scalar UI.
  Generate with `GET /openapi.json` + Postman's OpenAPI import.
- [ ] **Local HTTPS + ngrok recipe** — document how to expose the local server to
  receive real GrabFood sandbox webhooks during development (`ngrok http 3000`,
  register the tunnel URL in the GrabFood Partner Console).
- [ ] **`.env.example`** — a committed template with every env var, its type, and
  a safe default or placeholder. Reduces onboarding friction for new contributors.

## Suggested sequence

1. ~~Read API (#1)~~ — done.
2. ~~Order status lifecycle (#1)~~ — done.
3. ~~Webhook signature verification (#2)~~ — done.
4. **API auth + RBAC (#6)** — must land before any public deployment; everything
   else builds on a secured API.
5. **GrabFood outbound HTTP call (#1)** — replace the stub in
   `src/outbound/grabfood-outbound.adapter.ts`. Highest-value remaining product task.
6. **Foodpanda outbound (#1)** — same pattern, confirm action map against docs.
7. **Unit + integration tests (#7)** — translators and the ingestion pipeline first;
   add the CI coverage gate in the same PR.
8. **Menu sync (#1)** — reads `isSynced=false` mappings and pushes to platform
   menu APIs. Depends on outbound adapters being real.
9. **Seed script + `.env.example` (#10)** — unblocks frontend and new-contributor
   onboarding in parallel.
10. **Frontend (#1)** — merchant dashboard + kitchen display. Read API and WS are
    stable; auth (#6) must be done first.
11. **Alerting rules + Grafana dashboard (#9)** — wire up once the app is deployed
    and scraping to a real Prometheus instance.
12. **ShopeeFood adapter (#8)** — next platform after the GrabFood/Foodpanda loop
    is closed and tested.

Sections 2–5 are complete. Active work is in #1 and #6.
