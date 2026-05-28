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

- [ ] **Inbound webhook signature verification (HMAC per platform)** —
  security-critical. Anyone can currently POST a fake order to `/webhooks/{platform}`.
- [ ] **Dead-letter handling for failed jobs** — translation failures (unknown
  store/product, malformed payload) need a DLQ + inspection/retry, not silent loss.
- [ ] **`readyz` should reflect Postgres too** — it only pings Redis today; a DB
  outage reads as "ready."
- [ ] **Idempotency fail-open review** — `IDEMPOTENCY_FAIL_OPEN=true` lets dupes
  through on a Redis blip; confirm that trade-off and that the DB UNIQUE catches it.

## 3. Scale / deployment architecture

- [ ] **Socket.io Redis adapter** — WS rooms are in-memory, so with >1 instance a
  broadcast only reaches clients on the same node. Needed before horizontal scaling.
- [ ] **Containerize the app + prod compose / CI-CD.**
- [ ] **Multi-worker / concurrency tuning + backpressure** under burst.

## 4. Observability

- [ ] **Metrics** — queue depth, processing latency, ack time, broadcast lag — plus
  request tracing. Structured logging (pino) exists; dashboards/alerts don't.
- [ ] **Load-test the <200ms ack guarantee** under realistic burst.

## 5. Data & multi-tenancy

- [ ] **Order event/audit log** — append-only state-transition history.
- [ ] **Merchant/store onboarding & `platform_mappings` management** — hand-seeded today.
- [ ] **Retention / archival** of old orders.

## Suggested sequence

1. Read API (#1) — unblocks the frontend, small.
2. Order status lifecycle (#1) — the core feature.
3. Webhook signature verification (#2) — cheap, closes a real security hole.
4. Outbound status updates (#1) — closes the platform loop.
5. Second platform adapter (#1) — proves the abstraction.
6. Merchant Menu / Product Management (#1) — canonical product store + per-platform sync.

The frontend can start in parallel once the Read API exists.
