# Live software verification

Verified on 2026-10-17 at 22:42 UTC using the local API and separate worker.

- Submitted a live $0-base-fee demo brief with two concurrent requests, five seconds,
  a 2,000 ms p95 ceiling and 1% maximum error rate.
- The signed-in Codex CLI generated a fresh five-file Node application; no model API
  key was supplied and no generated source ran on the host.
- CreateOS executed the app in an EU sandbox with a dedicated Neon trial database.
- The independent harness checked the artifact digest, normalized duplicate signup,
  persisted counts and actual HTTP load.
- Result: **33 requests, 6.52 requests/second, 548.67 ms p95, zero errors**, measured
  over 5.058 seconds. The first generated revision passed.
- The sandbox was destroyed, then the worker atomically saved the proposal, source
  digest and 15-minute approval expiry. The run reached `awaiting_approval`.

Local run: `a313e87e-5ce9-473f-b82e-9f4610422d8f`.
Artifact SHA-256: `c8922dc7b79e92461a0807b723988cf07320ced916eaafafa89073b03c5987f5`.

This establishes real generation, remote execution, database writes and measured
proposal qualification. It does not establish sustained production capacity,
restart durability, automatic live repair (this revision passed), or permanent
deployment. Base fees are zero on the provisioned free plans; runtime uses existing
credits and remains subject to provider quotas. Shipping is still disabled.

Repeat with `npm run demo:live` after following [backend setup](backend-development.md).
Each repeat uses model allowance and sandbox quota. Do not rerun just to refresh an
expired proposal unless another trial is intended.
