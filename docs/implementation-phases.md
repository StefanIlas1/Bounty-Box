# Implementation phases

Priority confirmed by Stefan: both software and physical hardware, software first.
Setup prerequisite complete: Stripe project + free CreateOS resources, credential sync,
EU upload/execute/cleanup smoke. See provider-setup.md.

| Phase | Deliverable | Owners | Exit condition |
| --- | --- | --- | --- |
| 1 | Durable backend foundation | Agent 1 | Authenticated API, SQLite WAL queue, separate serialized worker, fixture repair/proposal flow, restart and cancellation checks |
| 2 | Real generation and validation | Agent 1 generation; agent 2 benchmark; agent 3 catalog/sandbox | Generated software executes in CreateOS with independent measurements; missing credentials fail preflight |
| 3 | Repair and qualified proposals | Agent 2 loop; agent 1 artifact storage; agent 3 evidence | Real failed attempt repairs or swaps, retests and binds passing evidence/cost to immutable artifact and expiring proposal |
| 4 | Approval and delivery | Agents 1 and 3 | Revalidated approval, durable provisioning receipts, exact artifact deployment and verified URL; hardware path produces BOM/setup package with compile/simulation evidence |
| 5 | Integration and demo | Agent 1 + Mohsen | Frontend live mode connected; software flow demonstrated; one hardware reference path validated; fixture/physical limits clearly labelled |

## Ownership

- Agent 1: API, storage/queue, contracts, generation, artifact/approval/shipping orchestration, dependency installation and live integration.
- Agent 2: independent HTTP benchmark under src/lib/benchmark and existing src/lib/orchestrator. Task `benchmark` on localhost.
- Agent 3: catalog/provider adapters under src/lib/catalog, src/lib/createos and src/lib/stripe-projects. Preserve hardware modules; prioritize software runner/catalog, then hardware SDK factory/toolchains.
- Mohsen's frontend is already on GitHub main. These backend agents do not overwrite it.

Local messages do not wake idle Codex terminal sessions. Each session must check its
inbox to acknowledge assignments. Do not claim agents are running until they respond.

## Phase 1 implementation adjustment

Use a standalone Node 22 HTTP API plus a separate Node worker because the frontend
is now a separate Vite application. This replaces the initial Next.js route-hosting
choice while preserving the documented HTTP contract. No second frontend is added.
SQLite uses Node 22's experimental built-in node:sqlite API (pin .nvmrc).
Artifacts are persisted as canonical content-addressed JSON files, with run/attempt
receipts in SQLite and final tested source bound transactionally to each proposal.
Shipping receipts remain phase 4 work.

Live submissions are enabled only after explicit provider/generator/quote preflight.
Codex CLI provides local generation with the signed-in ChatGPT account. Fixture runs never provision.
The API publishes awaiting_approval only after the tested artifact, SHA-256 digest
and 15-minute expiry have been saved in one transaction. Shipping remains disabled.

## Verified checkpoint

Phase 1 passed strict TypeScript checking and two integration tests covering restart
persistence, idempotency conflicts, worker lease exclusion/expired-lease refusal,
fixture repair and artifact binding, HTTP authentication/input limits/queue bounds,
cancellation and fixture shipping rejection. A separate running API and worker also
completed a two-attempt fixture run to awaiting_approval and rejected shipping.
Live Codex generation and Neon SQL access have now been verified. The backend wires
those adapters to CreateOS and the independent benchmark. See provider-setup.md and
backend-development.md for current limitations. Shipping and permanent deployment
remain phase 4 work.

The complete live API/worker flow reached `awaiting_approval` with measured evidence;
see [live verification](live-verification.md). A real repair remains to be demonstrated
because the fresh generated revision passed on its first attempt.
