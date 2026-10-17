# Local agent coordination

Service: `http://127.0.0.1:4317`. All agents must run on this Mac in
`/Users/stefanilas/Bounty-Box`. It is not reachable from another computer.
SQLite state and the automatically generated bearer token stay in ignored
`.coordination/`. The CLI authenticates automatically; never paste the token
into messages. This is a trusted-local-agent board, not an identity boundary
between agents that already share filesystem access.

## Architecture reference

[Bounty-Box — Backend Architecture & Execution Design (Miro)](https://miro.com/app/board/uXjVEYwmnCA=/)

Canonical detailed text: `docs/backend-system-design.md`. Selected decisions and
implementation deltas are in section 10. Board visibility follows Miro team
permissions; a local link does not grant access. Agents without Miro access use
the local text and request clarification through the coordination service.

Start if stopped: `python3 scripts/coordination.py serve`.
Inspect: `python3 scripts/coordination.py status`.

## Join

Read `AGENTS.md`, `README.md`, `design.md`, and this document first.
Register a unique ID; agent-1 is the coordinator. The first two additional
agents use agent-2 and agent-3. Future agents use new IDs and request work.

```sh
python3 scripts/coordination.py register agent-2 'Orchestration'
python3 scripts/coordination.py status
python3 scripts/coordination.py claim agent-2 orchestration
python3 scripts/coordination.py inbox agent-2
python3 scripts/coordination.py send agent-2 agent-1 'Started orchestration; no blockers.'
```

Agent 3 substitutes `agent-3`, role `Provider integrations`, task `providers`.
Claiming is atomic. Do not work on a task claimed by another agent.

## Ownership

- **agent-1 / core:** shared contracts, project configuration, dependencies,
  API routes, server state, generation, integration, live runs.
- **agent-2 / orchestration and benchmark:** `src/lib/orchestrator/`, `src/lib/benchmark/`.
- Frontend work is deferred by user direction; preserve any existing edits.
- **agent-3 / providers:** `src/lib/createos/`, `src/lib/stripe-projects/`,
  `src/lib/catalog/`.
- Each agent owns `docs/handoffs/<agent-id>.md`.

The task board provides fuller instructions. Use `src/lib/contracts.ts`.
Ask agent-1 through the service for contract or dependency changes.
Do not edit other owners' files, install dependencies, switch branches,
stash/reset, commit, or start extra agents. Work in the shared checkout.
Only agent-1 runs live sandboxes, initializes provider projects or deploys;
any purchase still requires explicit approval of its concrete cost.

## Progress and handoff

Check messages at task boundaries and before changing integration assumptions.
Use `inbox agent-2 --after N` with the last received message ID to avoid
rereading history. No tight polling or idle model loops. Send blockers promptly.
Do not include secrets, credentials, or entire files in messages.

```sh
python3 scripts/coordination.py send agent-2 agent-1 'Need a shared response field: ...'
python3 scripts/coordination.py block agent-2 orchestration 'Concrete blocker and next step'
python3 scripts/coordination.py complete agent-2 orchestration 'Implemented X; checked Y; handoff at docs/handoffs/agent-2.md'
```

Completion/block notifications go to agent-1 automatically. Finished agents
stop until assigned more work. A blocked owner may complete once resolved.
Tasks are never automatically reassigned after a timeout; shared-checkout
ownership must be coordinated explicitly to prevent concurrent edits.

## API

`GET /health` is public. All other endpoints require the local bearer token.
`GET /board`, `GET /messages?agent=agent-2&after=0`, `POST /register`,
`POST /messages`, `POST /tasks`, `POST /tasks/{id}/claim|complete|block`.
Use the CLI for request schemas. There is no remote command execution endpoint.

## Current implementation checkpoint

See `docs/implementation-phases.md` for the five phases and software-first priority.
Phase 1 foundation is implemented and verified; API runs at 127.0.0.1:3000 with
a separate serialized worker. See `docs/backend-development.md`. Both integration
tests and a separate-process fixture run passed. Live Codex generation, Neon trial
database access and CreateOS benchmarking are integrated. Shipping remains disabled.
Use Node 22 and follow the explicit live settings in backend-development.md.
