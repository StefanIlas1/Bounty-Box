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
Use POST /api/runs with an explicit fixture mode for now; live mode returns 503.
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

## Generation integration status

The OpenAI Responses adapter (`src/lib/generation/index.ts`) implements strict JSON
output, a 180-second deadline, one model call per attempt, a 12,000-output-token cap,
bounded source/response sizes, safe relative paths, pinned dependency metadata,
scoped environment names, refusal/incomplete handling and sanitized errors.
Transport tests use synthetic responses; no live model call has been made.
OPENAI_API_KEY and OPENAI_MODEL are not configured. User requested demo use of
CreateOS hackathon credits, so do not select or charge an OpenAI model implicitly.

CreateOS documentation confirms credit-funded generation in its Create UI:
https://createos.sh/docs/Build-Deploy/Create/
The public API/MCP references inspected list platform management operations;
a backend-callable generation endpoint funded by these credits has not yet been
verified. `createos ask` launches OpenCode; it is not a documented generation API.
Therefore do not describe the fixture's scripted repair as live AI generation.

OpenAI adapter reference:
https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
Frontend integration uses server-side proxy token injection; never bundle the bearer
token into browser assets. See the frontend's docs/api-contract.md on GitHub main.
