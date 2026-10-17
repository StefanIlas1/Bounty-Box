# Bounty-Box

Describe the app you want and set a budget. Bounty-Box picks the stack, writes the code, load-tests it in a CreateOS sandbox, swaps out parts that fail or cost too much, then buys the stack through Stripe Projects and hands you a live URL.

Built at **Build Agents That Run Code: CreateOS × Stripe Projects** (Oct 17, 2026) by Mohsen Sarrafan ([@mohsensc](https://github.com/mohsensc)) and Stefan Ilas ([@StefanIlas1](https://github.com/StefanIlas1)).

## What it does

1. **Brief:** you give it an app and a budget, e.g. "A waitlist app with email signups that handles 1,000 users, for under $30 a month."
2. **Draft a stack:** it picks candidate services from the Stripe Projects catalog (database, key-value store, host).
3. **Write and run:** it writes the app plus a load-test script and runs both in a CreateOS sandbox.
4. **Self-fix:** if the load test fails or projected cost exceeds the budget, it rewrites the code or swaps a stack component and runs again.
5. **Approve:** you review the final stack, monthly cost and test results.
6. **Buy and ship:** it runs `stripe projects add …` for each service, deploys, and returns a live URL.

### Hardware mode: for physical builders

Building something physical? Describe the product, quantity, budget and deadline. Bounty-Box writes a parametric CAD model and a bill of materials, sources each part from eBay and Chinese manufacturers, and calculates the landed cost: shipping, import duty, tariffs and delivery date. Parts that don't fit, miss the deadline or break the budget get swapped automatically. You review the 3D model, blueprints and per-part costs, then buy everything in one checkout.

See [design.md](design.md) for the full pitch, scope and risks.

Backend architecture: [system design and decisions](docs/backend-system-design.md) · [Miro architecture board](https://miro.com/app/board/uXjVEYwmnCA=/).

## Backend architecture diagrams

These diagrams describe the target architecture; implementation is in progress. See the [system design](docs/backend-system-design.md) for failure paths, limits, and architectural decisions, or open the [editable Miro board](https://miro.com/app/board/uXjVEYwmnCA=/).

### Backend components

The API persists runs and queues work; workers generate, benchmark, and ship approved artifacts.

```mermaid
flowchart LR
    Client[CLI or HTTP client] --> API[Run and approval API]
    API --> Store[(Run state and event log)]
    API --> Queue[Serialized job queue]
    Queue --> Worker[Run worker]
    Worker --> Loop[Bounded orchestrator]
    Loop --> Catalog[Catalog and cost estimator]
    Loop --> Generator[Code generator]
    Generator --> Model[Model provider]
    Generator --> Artifacts[(Versioned source artifacts)]
    Loop --> Runner[CreateOS adapter]
    Runner --> Sandbox[Isolated application and diagnostic load script]
    Sandbox --> Trial[Approved trial services]
    Worker --> Harness[Independent benchmark harness]
    Harness --> Sandbox
    Loop --> Store
    API --> Gate[Proposal-specific approval gate]
    Gate --> Shipping[Provision and deployment worker]
    Shipping --> Stripe[Stripe Projects]
    Shipping --> Host[Selected deployment provider]
    Shipping --> Verify[Deployed application health check]
    Verify --> Store
```

[Diagram source](docs/diagrams/backend-components.mmd)

### Run lifecycle

The main success and repair path, with provisioning gated by proposal-specific approval.

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> planning
    planning --> generating
    generating --> testing
    testing --> repairing: Failed criteria and attempts remain
    repairing --> generating: Revised code or different stack
    testing --> awaiting_approval: Qualified proposal persisted
    awaiting_approval --> provisioning: Matching proposal approved
    provisioning --> deployed: Deployment health check passes
    deployed --> [*]
```

[Diagram source](docs/diagrams/run-lifecycle.mmd)

### Approval and shipping

Shipping records provider receipts and verifies the deployed artifact. Unknown outcomes require reconciliation.

```mermaid
sequenceDiagram
    participant U as Operator
    participant A as API
    participant D as SQLite and artifacts
    participant W as Shipping worker
    participant S as Stripe Projects
    participant C as CreateOS deployment
    U->>A: Approve current proposal ID
    A->>D: Validate digest, expiry and price, then reserve unique job atomically
    A-->>U: Accepted snapshot
    W->>D: Claim job and persist provisioning intent
    W->>S: Provision selected services
    S-->>W: Resource IDs and receipts
    W->>D: Persist receipts
    W->>C: Configure runtime and upload approved artifact
    C-->>W: Deployment ID and URL
    W->>C: Check digest, health and signup persistence
    W->>D: Persist deployed URL and evidence
    Note over W,D: Unknown outcome stops automatic retry and requires reconciliation
```

[Diagram source](docs/diagrams/shipping-sequence.mmd)

### Data relationships

Attempts and proposals bind immutable artifacts; approvals authorize recorded shipping operations.

```mermaid
erDiagram
    RUN ||--o{ RUN_EVENT : records
    RUN ||--o{ JOB : queues
    RUN ||--o{ ATTEMPT : measures
    ARTIFACT ||--o{ ATTEMPT : executes
    ATTEMPT ||--o{ PROPOSAL : qualifies
    ARTIFACT ||--o{ PROPOSAL : binds
    PROPOSAL ||--o| APPROVAL : authorizes
    APPROVAL ||--o{ SHIPPING_OPERATION : permits
    SHIPPING_OPERATION ||--o{ PROVIDER_RECEIPT : records
```

[Diagram source](docs/diagrams/data-relationships.mmd)

## Tech

- **Stripe Projects**: provisions and buys the chosen services (`stripe projects add`).
- **CreateOS Sandbox**: runs the generated app and load tests, with egress allowlisting, a live ingress URL, and pause/resume while waiting for approval.
- **Hardware mode**: CadQuery / OpenSCAD for parametric CAD, three.js (react-three-fiber) and Online3DViewer for the 3D view, SVG drawings and KiCad for blueprints, eBay Browse API for sourcing.

## How to run

Use Node 22 and install the backend dependencies:

```sh
nvm use
npm ci
```

Set a random `BOUNTYBOX_API_TOKEN` of at least 32 characters in an ignored
`.env.backend.local` file. Run the API and worker in separate terminals:

```sh
npm run dev
npm run worker
```

The API listens on `127.0.0.1:3000`. All endpoints require bearer authentication.
See [backend development](docs/backend-development.md) for request examples,
credential setup, artifact retrieval and worker recovery limits. The frontend lives
in [`web/`](web/README.md) and has separate dependencies and demo/live modes.

### Implementation status

The live software flow is verified: authenticated API → durable queue → locally
signed-in Codex generation → CreateOS EU sandbox → Neon persistence → independent
benchmark → artifact-bound proposal. The latest run passed 33 requests at 549 ms p95
with zero errors, then destroyed its sandbox. See [live verification](docs/live-verification.md).

Run `npm run demo:live` after following the live settings in
[backend development](docs/backend-development.md). Generation uses the signed-in
Codex allowance; sandbox execution uses CreateOS credits. Stripe Projects provisions
the free CreateOS and Neon resources. Fixture mode remains explicitly simulated.

Permanent deployment and shipping remain unfinished. A live repair still needs a
demonstration; the verified generated revision passed on its first attempt. Hardware
modules cover reference firmware/HDL packages and pre-arrival checks, not automated
physical purchases or verified device operation.

See [implementation phases](docs/implementation-phases.md) and
[provider setup](docs/provider-setup.md) for the current handoff.
