# Local backend development

Use Node 22 (`nvm use`). Run `npm install` once. Stripe manages provider credentials
in `.env`; the backend loads them without printing values. Put a random API bearer
token of at least 32 characters in ignored `.env.backend.local` as
`BOUNTYBOX_API_TOKEN=...`. The coordinator has created this file locally.

Run in two terminals:

```sh
npm run dev
npm run worker
```

API listens on 127.0.0.1:3000. Worker processes jobs sequentially. Data is persisted
under ignored `.bounty-box/runs.sqlite3`. All API endpoints require bearer auth.
Use POST /api/runs with explicit `fixture` or `live` mode. Live mode requires the
configuration below; missing configuration returns 503 before queueing.
POST accepts an optional Idempotency-Key (1–128 visible ASCII characters).

```json
{"mode":"fixture","brief":{"description":"Email waitlist","monthlyBudgetUsd":30,"targetUsers":1000,"load":{"concurrency":10,"durationSeconds":30,"maxP95Ms":500,"maxErrorRate":0.01}}}
```

Poll GET /api/runs/:id. A fixture deliberately fails its first simulated measurement,
repairs and produces a passing simulated proposal. POST /api/runs/:id/cancel cancels
queued or active work. POST /api/runs/:id/approve requires proposalId and rejects
fixture evidence; no shipping adapter is enabled yet. GET /api/health reports readiness.

Stop the worker using Ctrl-C so it finishes cleanup and releases its lease. A killed
worker leaves its lease intact: a successor refuses to run even after expiry because
provider resources may still exist. Reconcile external resources before removing a
stale lease; automatic recovery tooling is not implemented yet.

Run `npm run check` and `npm run test:backend` for the foundation checks.
Each generated attempt is now stored as canonical JSON under
`.bounty-box/artifacts/<sha256>.json` before execution, with a run/attempt receipt
in SQLite. Authenticated GET /api/runs/:id/artifacts lists these receipts;
GET /api/runs/:id/artifacts/:attempt retrieves an integrity-checked source bundle.
Earlier running API/worker processes must be restarted to load code changes.

## Live software demo

The local workaround uses a signed-in Codex CLI for generation and repair, and
CreateOS credits for sandbox execution. `codex login status` must report a ChatGPT
login. No separate model API key is required. Codex usage counts against the signed-in
account's allowance; this does not turn CreateOS credits into model API credits.

Provision the free CreateOS project and dedicated free Neon database through Stripe
Projects, then run `stripe projects env --pull --no-interactive`. The backend maps
`NEON_POSTGRES_CONNECTION_STRING` to `NEON_DATABASE_URL` at runtime without rewriting
Stripe's environment file. Use only an isolated trial database for generated code.

Add these nonsecret settings to ignored `.env.backend.local` and restart both processes:

```dotenv
BOUNTYBOX_LIVE_ENABLED=true
BOUNTYBOX_GENERATOR=codex
BOUNTYBOX_NEON_TRIAL_READY=true
BOUNTYBOX_PRICING_FILE=config/demo-pricing.json
```

`config/demo-pricing.json` records the verified account's free base fees and expires
after 24 hours. Credits, free-tier quotas and production capacity are explicit
limitations; update from provider evidence before using another account or date.
The live demo caps load at five concurrent requests for 30 seconds and 100 target
users. Those are scope limits, not production capacity guarantees.

```sh
npm run check:neon
npm run demo:live
```

The demo script submits a real run to the API and prints its events and measurements.
Generated code remains untrusted: Codex returns a validated manifest, then execution
happens inside CreateOS. The CLI child gets no provider/database credentials, has
tools disabled and a read-only temporary workspace, and is cancelled after four
minutes. App credentials enter only the sandbox runtime, with database-only egress
for the zero-dependency Neon app. An independent worker-side harness verifies
artifact identity, normalized duplicate handling, database counts and load results.

Sandbox creation intent and cleanup receipts are durable in SQLite. An unresolved
sandbox blocks another live run until reconciled. Trial database tables remain for
inspection after each sandbox is destroyed. A benchmark proves persistence through
separate database requests; a restart/redeployment durability check is not yet included.

Shipping remains disabled. A passing live run produces an artifact-bound proposal,
not a permanent deployment URL. Sandbox previews expire when cleanup destroys them.

## Optional direct API generation

The OpenAI Responses adapter (`src/lib/generation/index.ts`) implements strict JSON
output, a 180-second deadline, one model call per attempt, a 12,000-output-token cap,
bounded source/response sizes, safe relative paths, pinned dependency metadata,
scoped environment names, refusal/incomplete handling and sanitized errors.
Transport tests for this adapter use synthetic responses. Select it explicitly with
`BOUNTYBOX_GENERATOR=openai`, `OPENAI_API_KEY` and `OPENAI_MODEL`. The local demo uses
the verified Codex CLI adapter instead.

CreateOS documentation confirms credit-funded generation in its Create UI:
https://createos.sh/docs/Build-Deploy/Create/
The public API/MCP references inspected list platform management operations;
a backend-callable generation endpoint funded by these credits has not yet been
verified. `createos ask` launches OpenCode; it is not a documented generation API.
Fixture scripted repairs are still labelled as simulated and never qualify as live evidence.

OpenAI adapter reference:
https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
Frontend integration uses server-side proxy token injection; never bundle the bearer
token into browser assets. See the frontend's docs/api-contract.md on GitHub main.
