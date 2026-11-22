# Running the live demo

https://bounty-box.com/demo opens the scripted replay. The Live option appears in the top bar only while https://bounty-box.com/api/health reports `liveReady: true`; otherwise the builder stays in Demo mode.

**Live builds need a hosted worker.** Vercel serves the UI and API and stores runs in Neon. A local worker runs the signed-in Codex CLI to generate source, and CreateOS executes and hosts it. Live mode needs all of these:

- Vercel env: `WAITLIST_DATABASE_URL`, `CREATEOS_PROJECT_API_KEY` and `BOUNTYBOX_LOCAL_WORKER=true`
- A running worker with the same database and CreateOS key in its `.env.backend.local`

From a checkout of this repo on Node 22:

```sh
npm install
npm run worker:hosted
```

Wait for `Connected local Codex worker started`, then confirm `/api/health` reports `liveReady: true`. Keep the terminal open and the machine awake. The worker stops after 24 hours or on Ctrl-C, and pages loaded after its heartbeat goes stale (30 seconds) no longer offer Live. Deployed CreateOS apps keep running until their recorded expiry (at most 24 hours); they are not permanent hosting.

Do not commit keys or database URLs. Optional settings: `CREATEOS_FALLBACK_API_KEY` (backup key) and `BOUNTYBOX_REUSE_SANDBOX_ID` (reuse one sandbox). Local and Vercel configuration must point at the same account and sandbox.

## Sandbox reuse and credential fallback

For this single-user demo, builds reuse the configured sandbox with separate workspace directories, ports, managed processes and database roles. Failed/temporary work cleans only its own resources. Passed applications stay running for approval/judging. The shared sandbox and existing final apps are not destroyed between trials. This is a single-user demo arrangement, not a multi-tenant security boundary.

The backup credential is attempted for supported access/provider failures while opening the reusable sandbox. It must have access to that sandbox; keys from different accounts do not share ownership. If the backup account has its own designated reusable sandbox, configure `BOUNTYBOX_FALLBACK_SANDBOX_ID`. There is no automatic sandbox creation fallback while reuse is configured, nor any purchase/top-up. Do not re-run generation just to retry an execution failure; retain the saved artifact.

Reuse does not spend a new sandbox creation. Runtime still consumes credits.

## Before a demo

- Start the worker and check health.
- Open the live builder in the same browser profile that owns the run cookie.
- Source files appear after generation completes; Terminal first shows actual build status, then execution output. Pending comparisons are cost estimates, not measured performance.
- Approve a tested proposal before its 15-minute expiry. No paid purchase is performed by the current path.
- If a retained application has expired or the reusable sandbox is unavailable, renew the runtime deliberately before judging. Do not claim the old URL still works.
