# Running the live demo

The public builder is https://bounty-box.com/demo?mode=live.

**Live builds require a local worker.** Vercel serves the UI/API and stores runs in Neon. The signed-in local Codex CLI generates source; CreateOS executes and hosts it. Keep the worker terminal open and the Mac awake while demonstrating new builds or approving deployment.

On this Mac, the prepared runtime checkout is `/Users/stefanilas/Bounty-Box-demo-runtime`:

```sh
cd /Users/stefanilas/Bounty-Box-demo-runtime
export PATH=/Users/stefanilas/.nvm/versions/node/v22.23.2/bin:$PATH
npm run worker:hosted
```

Wait for `Connected local Codex worker started`. Confirm https://bounty-box.com/api/health reports `liveReady: true`. The worker runs for at most 24 hours; Ctrl-C stops it. Closing it prevents new generation and approval processing. Already deployed CreateOS apps continue until their recorded runtime expiry (currently at most 24 hours); they are not permanent hosting.

The ignored `.env.backend.local` contains the scoped runtime configuration. Do not commit keys or database URLs. Vercel stores `CREATEOS_PROJECT_API_KEY` (primary), `CREATEOS_FALLBACK_API_KEY` (backup), `BOUNTYBOX_REUSE_SANDBOX_ID`, `WAITLIST_DATABASE_URL`, and `BOUNTYBOX_LOCAL_WORKER=true` privately. Local configuration must match the intended account and sandbox.

## Sandbox reuse and credential fallback

For this single-user demo, builds reuse the configured sandbox with separate workspace directories, ports, managed processes and database roles. Failed/temporary work cleans only its own resources. Passed applications stay running for approval/judging. The shared sandbox and existing final apps are not destroyed between trials. This is a single-user demo arrangement, not a multi-tenant security boundary.

The backup credential is attempted for supported access/provider failures while opening the reusable sandbox. It must have access to that sandbox; keys from different accounts do not share ownership. If the backup account has its own designated reusable sandbox, configure `BOUNTYBOX_FALLBACK_SANDBOX_ID`. There is no automatic sandbox creation fallback while reuse is configured, nor any purchase/top-up. Do not re-run generation just to retry an execution failure; retain the saved artifact.

The last confirmed inventory was seven creations out of a ten-per-day quota on the primary account, leaving three. Reuse does not spend a new creation. Credit consumption for runtime remains real.

## Before a demo

- Start the worker and check health.
- Open the live builder in the same browser profile that owns the run cookie.
- Source files appear after generation completes; Terminal first shows actual build status, then execution output. Pending comparisons are cost estimates, not measured performance.
- Approve a tested proposal before its 15-minute expiry. No paid purchase is performed by the current path.
- If a retained application has expired or the reusable sandbox is unavailable, renew the runtime deliberately before judging. Do not claim the old URL still works.
