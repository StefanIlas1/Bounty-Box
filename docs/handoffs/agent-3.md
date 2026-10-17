# Agent 3 — implementation plan update

Status: software-first runner/catalog implemented; hardware modules preserved.
Updated: 2026-10-17. No provider resources created or dependency installs performed
by agent 3. The planning sections below record the agreed design; see delivery
status here for current implementation versus remaining integration.

## Software-first delivery (latest)

Implemented `src/lib/createos/software.ts` and `src/lib/catalog/software.ts`, exported
through existing directory indexes without removing hardware exports. Shared contracts,
credentials, dependencies and other agents' files were not modified. No resource
creation, live test, dependency install or commit was performed.

### Exact runner interface

`createSandboxRunner(options: SoftwareRunnerOptions): SandboxRunner`

- Options now default to `{}`. Optional `benchmark(input: {baseUrl, token, brief,
  signal, artifactDigest}): Promise<TestResult>` defaults directly to agent-2's
  exported `benchmark` (trusted-http-v2). Agent-2 confirmed signature compatibility
  and digest/persistence behavior in messages 53 and 56. Optional `fetchImpl` is a
  mock seam used for runner health checks and the default benchmark; production
  uses native fetch. No caller glue is needed to select the trusted benchmark.
- Runner verifies authenticated /health JSON `ok:true` and exact shared artifact
  digest, with redirects disabled, a 4 KiB body cap and 10-second deadline. Agent-2's
  harness independently checks health identity, normalized duplicate status/count,
  and post-load stored counts. Wrong identity never reaches measurement.
- A fixed allowlist of trusted functional-failure messages returns a failed attempt
  with explicit non-qualifying zero measurements for the repair loop. Arbitrary
  callback text still cannot leak into public feedback; infrastructure and unknown
  failures throw sanitized errors. Cancellation always proceeds to cleanup.
- Optional `environment(): Readonly<Record<string, string | undefined>>`; default
  reads process.env only when run is invoked. Never reads .env itself.
- Optional `clientFactory({apiKey, baseUrl, retry:false})` for mock-only injection;
  default constructs installed `CreateosSandboxClient` (SDK 0.8.2).
- Optional awaited `onLifecycle({phase, name, sandboxId?})` for coordinator's private
  durable resource journal. Phases: creating, created, destroyed, reconcile.
  Use this to record intent BEFORE creation and receipt immediately afterward.

Runner uses explicit `https://api-eu.sb.createos.sh` and CREATEOS_PROJECT_API_KEY.
Supported artifact commands are exactly `node server.mjs` on 3000 and
`node diagnostic.mjs`. Relative path validation rejects hidden/traversal paths,
duplicates and node_modules; 50 files / 1 MiB source. Known environment secrets
embedded in source are rejected. Digest delegates to the coordinator's
`src/lib/server/artifacts.ts`, matching proposal binding.

Dependencies require package.json plus lockfile v3; direct dependencies are pinned
versions of @neondatabase/serverless and/or @libsql/client, and every locked package
has npm-registry HTTPS resolution and integrity. Run `npm ci --ignore-scripts
--omit=dev --no-audit --no-fund` inside sandbox with blank declared environment
values. Install egress is registry.npmjs.org:443. Before executing generated code,
replace egress with the selected database's exact hostname:443; no wildcard egress.
Neon uses its HTTPS driver; Turso must use @libsql/client/http. Raw PostgreSQL TCP
and extra services/package sources are outside this implementation.

Only scoped trial values are passed in runtime command env, plus PORT,
BOUNTYBOX_INGRESS_TOKEN, BOUNTYBOX_ARTIFACT_DIGEST and BOUNTYBOX_TRIAL_NAMESPACE.
The generated app must enforce bearer auth and namespace synthetic trial writes.
No Stripe/CreateOS/model management credential reaches the sandbox. Process output
is counted (256 KiB cap) but discarded, including background stdout/stderr; no
untrusted diagnostic stdout qualifies a proposal. Diagnostic nonzero exit is recorded
but the independent callback remains authoritative. Callback freeform logs/error
text and previewUrl are not copied into public TestResult.

Bounds: 90-second creation/readiness, 120-second npm install, 30-second diagnostic,
15-minute total run, independent 30-second cleanup. Benchmark result validation
requires live mode, finite metrics, positive request/throughput values and full
requested duration, then applies p95/error thresholds. Callback runs before teardown.
All obtained sandbox handles are destroyed in finally. Unknown creation outcomes
cannot be guaranteed deleted: a random sandbox name plus reconcile event/error
requires operator reconciliation; creation is never blindly retried. Cleanup failures
also fail the run with a reconciliation requirement. Coordinator still owns global
serialization, durable journal, quota/account budget and live authorization.

### Exact catalog interface and prerequisites

`createCatalog({quotes?, environment?, now?} = {}): Catalog`

`quotes()` supplies `VerifiedSoftwareQuote[]`: serviceId (`createos/project`,
`neon/postgres`, `turso/database`), monthlyCostUsd, official sourceUrl, verifiedAt,
expiresAt, accountEligible:true, nonempty assumptions, maxTargetUsers.
Quote source is a credential-free HTTPS URL on the provider/Stripe documentation
hosts. No quotes, stale quotes, insufficient usage allowance or unknown trial
configuration produce precise preflight errors; no prices are invented or inferred
from free sandbox credits. Operator-supplied verified quotes are the trust boundary;
this module does not claim to fetch live account pricing itself.

Candidates: `createos-neon`, `createos-turso`. Both require quoted CreateOS hosting.
Neon requires NEON_DATABASE_URL and BOUNTYBOX_NEON_TRIAL_READY=true; Turso requires
TURSO_DATABASE_URL, TURSO_AUTH_TOKEN and BOUNTYBOX_TURSO_TRIAL_READY=true. Readiness
flags attest operator-owned isolated/scoped trial resources, not automatic resource
creation. Hosted Neon/Turso URL validation prevents arbitrary egress targets. Catalog
returns a supported candidate if one is ready; when none qualify, errors list missing
configuration by name without secret values. Public stacks contain env names only.

Official discovery/pricing sources checked: https://projects.dev/llms.txt,
https://neon.com/pricing, https://turso.tech/pricing. These establish service/product
references, not this account's deployment price or trial eligibility. Existing
provider-setup.md verifies CLI sandbox access only; SDK credential mapping and the
above trial/quote prerequisites remain for coordinator validation.

### Local validation and next integration

`npm run check` passes. Node 22 mock-only smoke passes:
`node --import tsx src/lib/createos/software.smoke.ts`.
It exercises quote/trial/budget rejection, SDK EU/key configuration, blank install
environment, scoped runtime secrets, network restriction before app launch, canonical
digest parity, independent callback ordering, output suppression, path/env rejection,
cancellation and finally cleanup. No SDK client is instantiated by that smoke.

Coordinator can wire `createSandboxRunner({onLifecycle})` (agent-2 benchmark is now
the default) and `createCatalog({quotes})` once quotes/trials are configured. The cloud
Provisioner/deployment path remains separate and is not implemented by this delivery.

Continuation validation: Node 22 software.smoke.ts also executes the real agent-2
benchmark against mock HTTP replies (no sockets/providers), verifies a digest mismatch
prevents measurement, and confirms a normalization bug becomes repair feedback while
still destroying the mock sandbox. Strict repository typechecking passes. Hardware
files were untouched during this continuation. docs/provider-setup.md still does not
document scoped Neon/Turso access or account-specific deployment/database pricing;
these are unverified prerequisites, not claimed configured or invented zero costs.

## Implemented delivery and integration boundary

- `src/lib/catalog/index.ts` exports `createHardwareCatalog`, `getHardwareTarget`,
  `createHardwarePackage`, `hardwareDigest`, `createHardwarePlans` and their types.
- Catalog has documented Pico RP2040 and iCEBreaker UP5K target profiles, capabilities,
  source/purchase links, toolchain requirements and a USB data-cable BOM item.
  Recommendation evaluates capability compatibility, owned items, regional/currency
  quotes, stock, quote expiry and separate upfront/recurring budgets. Unknown costs
  stay null; fixture quotes cannot qualify a live purchase recommendation.
- Source packages implement a configurable LED bring-up reference task. Pico emits
  C/CMake source and UF2 instructions. iCEBreaker emits Verilog, a self-checking
  testbench and synthesis commands; placement/packing requires explicit documented
  board pin mapping. Both include arrival instructions and a digest-bound manifest.
  Arbitrary project firmware generation remains the coordinator's Generator work.
- `src/lib/createos/index.ts` exports `createHardwareValidator`. Inject a factory
  exposing the SDK-compatible sandbox lifecycle and explicit live/fixture mode.
  Validation uploads only bounded relative paths, checks digests/manifest/command
  binding, runs bounded tool commands inside the sandbox, records exit results,
  stops later checks after failure, and destroys on success/failure/cancellation.
  Cleanup failure requires coordinator reconciliation. Empty egress is NOT deny-all
  in CreateOS; adapter uses the coordinator-verified `example.com:443` allowlist.
- Hardware recommendations and packages are combined with an optional software
  CandidateStack by `createHardwarePlans`; no ordering/provisioning side effects.
  Hardware setup outputs do not require a deployed URL.
- Strict TypeScript compilation passed. One temporary fixture smoke passed quote,
  compatibility, cost, source generation, plan, integrity, cancellation, failed
  command and cleanup checks. This did not compile firmware/HDL or validate devices.

Integration usage: call `createHardwarePlans({ task: 'led-bringup', requirements:
{ kind: 'mcu', capabilities: ['onboard-led'], upfrontBudget: 30, currency: 'CAD',
region: 'CA' }, monthlyBudgetUsd: 0, quotes })`; provide live observed quotes or
inspect explicit blockers. Pass a returned `setupPackage` to
`createHardwareValidator(factory, 'live').validate(setupPackage, signal)` after
the coordinator configures the EU sandbox factory and preinstalled toolchain image.

Remaining coordinator dependencies: shared hardware contracts/API/generator and
orchestration integration; source real supplier quotes; provide Pico SDK/ARM GCC or
Icarus/Yosys/nextpnr/IceStorm image; verify SDK credential mapping; execute an authorized
live smoke. Only CMake was found locally. No package.json exists at this checkpoint.
The hardware modules do not implement cloud provisioning. Software createCatalog
and createSandboxRunner are now provided by the software-first delivery above;
createProvisioner remains a separate unfinished integration.

## Source coverage

Read README.md, docs/coordination.md, the full docs/backend-system-design.md,
and agent-1's architecture messages through message 18. The README contains four
diagrams, not Markdown tables; its linked system design contains the tables below.
Miro: https://miro.com/app/board/uXjVEYwmnCA=/ . Direct web access was unavailable;
the canonical local document supplies the board's decisions and diagram mapping.
The user explicitly clarified that physical hardware selection and its Verilog,
firmware or low-level setup code are core product requirements alongside software
stack selection. This supersedes the software-only scope in the current README
and design. The earlier interpretation of hardware as runtime infrastructure was
incorrect. The following product-scope delta takes precedence over the old MVP
assumptions; existing backend infrastructure remains supporting infrastructure.

## Physical hardware and software co-design — required scope

Product objective: describe a project and budget; the agent selects a compatible
software AND physical hardware stack, recommends what to buy, generates the code
for that exact hardware, validates what can be checked before arrival, and provides
a reproducible setup package for when the hardware arrives. Hardware is a first-class
deliverable, not merely the machine hosting the agent or a cloud instance.

| Stage | Required behavior and deliverable |
| --- | --- |
| Brief | Capture project function, existing devices, required interfaces, power/performance constraints, delivery region/deadline, one-time hardware budget and recurring software budget separately. Support software-only, hardware-only and combined projects. |
| Discovery | Query manufacturer documentation and supplier listings for exact part numbers, board revisions, specifications, availability, currency, quote timestamp and purchase links. Include required cables, programmers, power supplies and accessories in the bill of materials. |
| Compatibility | Match compute/FPGA/MCU target, toolchain support, device resources, pinout, I/O voltage, power needs, communication protocols and software drivers. Record evidence and unresolved constraints; do not treat a similar board as interchangeable. |
| Joint selection | Compare alternative complete hardware/software stacks, including hardware unit prices and quantities, shipping/tax estimates or unknowns, toolchain costs and recurring services. Replacing a board can require changing HDL, firmware, drivers and software dependencies. |
| Code generation | For FPGA targets produce Verilog/SystemVerilog, testbenches, target-specific constraints and build scripts. For MCU or other embedded targets produce appropriate firmware/low-level code, board configuration, drivers and flashing scripts. Generate host-side integration code where required. |
| Pre-arrival validation | Run bounded compilation, lint, simulation and applicable synthesis/resource/timing checks using supported toolchains. Independent tests qualify evidence; record exact target, tool versions, artifact digest and whether each check ran, passed, failed or was unavailable. Simulator success is not physical-device validation. |
| Repair or swap | Use diagnostics to fix source or select compatible alternative parts within the budget; invalidate affected compatibility checks, artifacts, quotes and approval whenever a part or design changes. |
| Proposal | Present the bill of materials and purchase links, software stack, separate one-time/recurring totals, compatibility evidence, generated artifact bundle and outstanding physical tests. Recommendation does not place an order. |
| Arrival package | Supply source, reproducible build instructions, available binaries/bitstreams with provenance, wiring/pin mapping, required tools, flashing/programming commands, configuration and a step-by-step bring-up checklist for the exact purchased revision. Never claim a binary exists if only source was generated. |
| Post-arrival verification | Record actual board identity, programming outcome and physical smoke-test evidence separately. Mark ready for bring-up before arrival; mark hardware verified only after physical checks. A live software URL alone cannot complete a hardware project. |

No specific board or supplier is selected by this planning update. Select a narrow
reference project and supported target/toolchain during implementation planning;
do not imply arbitrary FPGA or MCU support. Proprietary tools, licensing, unavailable
cross-compilers or sandbox resource limits must be reported as unsupported checks.
Physical purchasing automation is not requested here: provide verified shopping
recommendations and links first. Any future ordering adapter requires its own
documented supplier integration and approval; do not assume Stripe Projects buys
physical hardware.

## Required changes to shared architecture, README tables and Miro

| Existing reference | Required hardware extension |
| --- | --- |
| README introduction and six-step flow | Describe projects rather than only apps; select hardware and software together, validate generated HDL/firmware, propose purchases, and deliver setup artifacts alongside any deployed app. |
| Components diagram / Miro 01 | Add hardware catalog/supplier sources, compatibility evaluator, BOM/cost estimator, target-aware code generator, toolchain execution adapter, independent HDL/firmware checks and arrival-package output. |
| Lifecycle diagram / Miro 02 | Distinguish software deployment from hardware package readiness and physical verification. Represent toolchain/compatibility blockers explicitly; hardware recommendations must not be forced through cloud provisioning. Agent 1 defines exact shared status types. |
| Shipping sequence / Miro 03 | Add quote/part-revision revalidation and immutable BOM/artifact approval. Hardware path produces purchase recommendations and setup package; ordering/receipt tracking is a separate optional capability, not a current automatic purchase. |
| Data relationships / Miro 04 and entity table | Add hardware candidate/specification snapshots, BOM items, compatibility findings, target/toolchain profiles, HDL/firmware artifacts, pre-arrival validation records, bring-up instructions and physical verification records. Bind these to proposals by digest. |
| Boundary and API tables | Give catalogs hardware discovery and quote normalization responsibilities; expand brief/proposal/artifact/evidence payloads for hardware and provide package retrieval. Preserve existing API routes where compatible; agent 1 decides additions. |
| Failure table | Add unavailable or changed parts, incompatible revisions/interfaces, missing toolchain/license, compilation/simulation/synthesis failures, incomplete quotes and failed bring-up. Unknown physical results remain unverified. |
| Ownership/status table | Agent 3 owns catalog/provider planning within existing directories; agent 1 owns shared models, generation, persistence and documentation integration; agent 2 owns orchestration after coordinator assignment. No ownership expansion is implied. |
| ADR table / Miro 00 | Revise the waitlist-only and two-cloud-stack scope (ADR-05/07); extend artifacts (04), trial/validation model (06/09), target-dependent limits (11), approval binding (12), delivery paths (13/14) and fixture evidence rules (16). Retain serialization, durability and secret isolation decisions where applicable. |

Shared contract requests to agent 1: model project kind and hardware requirements;
separate upfront and recurring budgets; represent exact hardware targets, BOMs and
quote freshness; make generated artifacts target-aware; use validation records for
compile/simulation/synthesis/physical evidence rather than forcing all results into
HTTP throughput metrics; bind package and BOM digests to approval; return delivery
artifacts and readiness states without requiring every project to have deployedUrl.

Plan order: agree contracts and one reference target; verify catalog/toolchain
support; implement hardware discovery and compatibility; generate and validate
target-specific code; assemble joint proposals and arrival packages; integrate
physical verification later when an actual device is available. Implementation was
subsequently authorized; the delivery section above records its actual extent.

## Infrastructure added to the plan

- Run the Node 22 API and a separate Node worker on one machine. Use a dedicated
  SQLite WAL database and durable queue, plus content-addressed local artifacts.
  The development coordination service is separate from product infrastructure.
- Serialize testing and shipping under one durable lease; queue at most five jobs.
  Heartbeat every 10 seconds, expire after 60 seconds, and reconcile external work
  before a successor starts. Agent 1 owns this infrastructure and persistence.
- Use the event EU CreateOS Sandbox endpoint and the documented free-plan shape
  `s-1vcpu-1gb` (1 vCPU / 1 GB); verify actual account quota before execution.
  Do not infer that benchmark VM resources describe the eventual deployment host.
- Plan two stacks: CreateOS hosting with Neon/Postgres or Turso/libSQL. Require
  operator-owned scoped trial databases, isolated run namespaces and synthetic data.
  Unknown prices or missing trial access block live selection, not default to $0.
- Enforce 50 files / 1 MiB source, 256 KiB attempt logs, 90-second startup,
  180-second generation, three attempts and a 15-minute overall deadline.
  Default benchmark: concurrency 10 for 30 seconds, p95 <= 500 ms, errors <= 1%;
  hard limits: concurrency 50 and duration 120 seconds. Expected users are separate.
- Destroy each benchmark sandbox. Pause/resume is optional, superseding the
  README's earlier suggestion to hold a sandbox while awaiting approval.

## Complete diagram and table mapping

| Source | Implementation-plan consequence | Owner |
| --- | --- | --- |
| README components diagram / Miro 01 | Durable API/queue/worker boundaries; trusted benchmark harness separate from generated diagnostics | Agent 1; agent 3 adapter boundary |
| README lifecycle diagram / Miro 02 | Bounded repair, qualified proposal, explicit approval before shipping; retain failure/cancel evidence | Agent 2 loop; agent 1 state |
| README shipping diagram / Miro 03 | Persist intent and receipts, deploy approved artifact, verify digest and persistence; reconcile unknown outcomes | Agent 1 plus agent 3 |
| README data diagram / Miro 04 | Bind attempts and proposals to immutable artifacts; approvals link shipping operations and receipts | Agent 1 contracts/storage |
| System design section 2 boundary table | Validate untrusted source; isolate secrets; separate catalog, runner, approval and shipping responsibilities | All within owned paths |
| Section 5 API table | Preserve all four run/status/approve/cancel endpoints; add idempotency and explicit conflict/unavailable responses | Agent 1 |
| Section 6 entity table | Persist Run, RunEvent, CandidateSnapshot, ArtifactRevision, Attempt, Proposal, Approval and ShippingOperation; receipts linked to operations | Agent 1 |
| Section 8 failure table | Reject invalid outputs, retain failed measurements, stop on persistence failure, reconcile timeout/partial shipping, clean up cancellation | All within owned paths |
| Section 9 ownership table | Agent 3 edits only provider directories and this handoff; frontend deferred; coordinator owns live operations | All |
| Section 10 ADR table / Miro 00 | Adopt ADR-01 through ADR-16, including evidence provenance, expiry, runtime limits, price gates and fixture isolation | All within owned paths |
| design.md judging table | Demonstrate actual execution and repair, meaningful sponsor integrations, and a narrow working flow; do not expand into vendor outreach | Agent 1 integration/demo |

## Provider changes and contract requests

1. Replace the earlier generated-load-JSON qualification plan. Generated output is
   diagnostic only. An independent trusted worker harness measures temporary,
   token-protected ingress while the sandbox remains alive. Request a lifecycle
   boundary from agent 1: an awaited benchmark callback or managed session with
   guaranteed finally cleanup; keep the ingress token out of public snapshots.
2. Extend evidence with artifact digest, environment/trial identity, evidence scope,
   harness version, metric provenance and warm-up details. Reject empty, non-finite,
   shortened or mode-mismatched measurements. Current TestResult lacks these fields.
3. Extend catalog/proposal data with catalog snapshot ID, quote source/timestamp,
   eligibility and usage assumptions, and approval expiry (15 minutes). Changing
   artifact, price or services requires a new proposal.
4. Separate provisioning from deployment and verification. Current Provisioner
   returns only a URL and service IDs; it cannot represent phase receipts, partial
   resources or reconciliation. Agent 1 must define durable operation hooks/types
   before live shipping is enabled.
5. Follow agent-1's documented CreateOS upload deployment choice, pending verification
   of Stripe receipt-to-project mapping, upload project type and actual CLI schema.
   Deploy the approved artifact directory, never current Git HEAD. Verify health
   digest and a synthetic persistence probe, then remove the probe. No durable URL
   until verification passes; benchmark capacity is not production capacity proof.

## Setup and implementation order

1. Agent 1 agrees shared contracts, lifecycle callback and receipt persistence.
2. Agent 1 installs requested `@nodeops-createos/sandbox` and `server-only` packages
   if retained after integration design; agent 3 does not install dependencies.
3. Verify provider CLI schemas, prices/eligibility, trial access and deployment
   project mapping through documented read-only setup. Existing research verified
   SDK create/egress/upload/command/cleanup concepts and Stripe JSON/noninteractive
   flags; no account pricing, trial credentials or deployment path was live-tested.
4. Once implementation is authorized, build catalog normalization, managed sandbox
   lifecycle, then staged shipping adapter, only in agent-3-owned directories.
5. Smoke-check with fixtures/types. Only agent 1 performs authorized live checks;
   purchases require concrete approval. Missing prerequisites fail preflight before
   generation or external mutations. Fixtures cannot invoke live shipping.

The design sections are a plan delta. Only the delivery section claims implemented
functionality; no live hardware or provider validation is claimed.
