# Agent 2: orchestration handoff

Frontend was deferred before any frontend edits. Only orchestrator files and this handoff were changed.

## Entry point

`orchestrateRun` exported from `src/lib/orchestrator/index.ts` accepts:

- `run: RunSnapshot`: a fresh `queued` run with no attempts.
- Injected `catalog: Catalog`, `generator: Generator`, `sandbox: SandboxRunner`.
- `signal?: AbortSignal`, `maxAttempts?: number` (default 3; allowed 1–10).
- `onUpdate(snapshot): void | Promise<void>`: awaited, deep-cloned snapshots.

Returns `{ run, app? }`. `app` is the exact generated artifact associated with the selected proposal's evidence, only returned on `awaiting_approval`. Persist this association before making approval available. No provisioning occurs here. Agent 1 owns global serialization, persistence, API, generation and approved provisioning.

## Decisions

Eligible candidates match run mode and have finite nonnegative estimates within budget. Non-partner candidates are ordered by price; one repair is allowed per candidate, then the next candidate is tested, bounded by the total cap. Generated revisions must be positive integers and increase on repair. Failed threshold results are passed as repair feedback even if the runner incorrectly reports `passed: true`.

Evidence requires passing status, matching mode, positive integer request count, positive finite throughput, finite nonnegative p95 below the brief limit, error rate within the brief limit and [0,1], and test duration at least the requested duration. Raw results and explicit decisions remain on attempts. Partner candidates only run after a non-partner passes and only when cheaper; they face identical evidence checks. With a bounded attempt budget some candidates may remain untested; this does not claim exhaustive market optimization.

Failure yields no proposal; cancellation is checked before/after asynchronous work and passed to generation and sandbox execution. A catalog call cannot be interrupted mid-call under the existing Catalog contract, but cancellation is checked immediately afterward. Persistence callback failures are rethrown and stop work. The coordinator must catch them and handle recovery. Provider failures stop the run instead of fabricating evidence; provider diagnostics should remain in server logs.

The current TestResult contract does not carry measured concurrency, so the runner remains responsible for honoring the supplied brief's concurrency. No inferred throughput requirement is derived from targetUsers.

## Verification

Ran the local fixture smoke with installed global TypeScript, without dependency installation:

`NODE_PATH=/Users/stefanilas/.nvm/versions/node/v20.19.5/lib/node_modules node src/lib/orchestrator/smoke.cjs`

Passed repair and artifact revision linkage, swap, bounded failure, partner baseline and discount, over-budget exclusion, live/fixture evidence rejection, cancellation, persistence callback failure and independent performance threshold evaluation. This smoke transpiles TypeScript; project-wide typecheck belongs to integration once dependencies/configuration are installed. No live sandboxes, provider actions, purchases, or git operations performed.

## Benchmark task (2026-10-17)

`src/lib/benchmark/index.ts` exports `benchmark({ baseUrl, token, brief, artifactDigest, signal, fetchImpl? }): Promise<TestResult>` and `BENCHMARK_VERSION`. The function is type-compatible with agent-3's `SoftwareBenchmark` callback; `createSandboxRunner({ benchmark })` calls it while temporary ingress exists, before sandbox cleanup. Agent-1 wires that adapter into the durable worker. No shared contract change is needed.

The preflight makes authenticated `GET /health` return JSON `{ok:true,artifactDigest}` matching the exact supplied 64-character digest. It records `GET /stats` count, posts one new mixed-case/spaced synthetic email (requires 201), checks count +1, posts its normalized duplicate (requires 200), and checks count remains +1. The timed phase sends distinct synthetic emails at bounded concurrency and requires 201 for each successful request. A final `/stats` count must account for every 201 response; with no errors it must match exactly. This checks read-after-write persistence semantics but does not claim proof across a service restart.

Requests use Bearer auth only in headers and reject redirects. HTTPS is required except loopback HTTP for local smoke checks. Concurrency is capped at 50, duration at 120 seconds, attempts at 100,000. Each request has a five-second limit covering headers and the entire response body, with a 16 KiB body cap. Abort propagates into in-flight requests and also stops uncooperative injected fetches. The `mode:'live'` result computes elapsed duration, p95, throughput and error rate from trusted worker observations only. Functional preflight or persistence mismatch throws before it can qualify a proposal. Generated diagnostic output is never accepted as metric evidence. Hardware validation has a separate target-aware path.

Verified `npm run check` and `node --import tsx src/lib/benchmark/smoke.ts`. The fixture HTTP smoke covers provider callback type, digest mismatch, normalized duplicate, persisted count, measured load and HTTP failures, response-body size, stalled-body timeout and cancellation. It made no real network/provider call. Agent-3 confirmed the managed runner callback and cleanup interface; agent-1 and agent-3 were sent the final signature and results through the localhost board.
