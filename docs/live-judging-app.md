# Real judging app

Open https://bounty-box.com/live-app (redirects to the verified CreateOS URL).
Direct URL: https://01m569ayf9819747neebb84cse-3000.app.sb.createos.sh

This is a real generated Node application with persistent Neon Postgres storage, running in a retained CreateOS sandbox. The client brief requested a navy-and-gold Bounty-Box early-access waitlist. The exact generated source is in `examples/judging-app`; the artifact digest and measured evidence are in `docs/evidence/judging-run.json` and `docs/evidence/judging-verification.json`.

## What happened live

1. Stripe Projects confirmed the existing CreateOS and Neon free-plan resources. No purchase, upgrade, or top-up was performed.
2. Signed-in local Codex generated the application from the client brief. Provider/database credentials were not passed to the model.
3. CreateOS ran the generated code and an independent persistence/load check.
4. Public deployment verification found an actual bug: proxy headers made same-origin browser submissions return HTTP 403.
5. The measured failure and previous source were sent back to the model. Revision 2 uses a trusted public-origin setting and passed retesting.
6. The exact tested revision was deployed with a unique restricted Neon login. The final public verification confirmed HTML form delivery, protected diagnostics, matching artifact digest, cross-origin rejection, invalid-email rejection, persistent signup, and normalized duplicate handling.

Revision 2 benchmark: **26 requests, 2 concurrent requests, 5.185 seconds, 624.11 ms p95, 0% errors**. Target users is a planning input; this does not prove 100 or 1,000 concurrent-user capacity.

## Boundaries and availability

- Final application process is bounded to 24 hours: **October 18, 2026 at 9:17 PM EDT** (October 19 at 01:17 UTC).
- This is a retained judging sandbox, not permanent production hosting. Availability also depends on provider credits/service availability. A 24-hour idle auto-pause is configured; this is not a hard sandbox lifetime or billing cap. The sandbox must be destroyed after judging.
- Egress is restricted to the selected Neon HTTPS hosts. No CreateOS API key or database owner credential is injected into the final app.
- The final database login has no privileges on pre-existing public tables. It owns only the generated app's namespaced table.
- Temporary test sandboxes and the failed first deployment were destroyed. The final successful deployment is deliberately retained.
- The public `/demo` remains a **scripted simulation**. Its catalog prices, hardware selection, comparison benchmarks, provisioning steps and purchases are examples, not live evidence. Its final link opens this separately verified real app.
- No confirmation email is sent. Full arbitrary-app generation and approval/deployment from the hosted frontend remain unfinished; the verified path is one operator-run, client-configured waitlist template.
- Browser automation was unavailable for a visual check; verification exercised the actual public HTTP endpoints with browser-origin headers and real Neon persistence.

## Operator commands

Use Node 22 in the backend checkout and its ignored local environment. Never put keys in command arguments or commit the private receipt.

- `node --import tsx scripts/judging-run.ts 'Your waitlist brief'` queues client-configured generation; run the worker separately.
- `BOUNTYBOX_RETAIN_JUDGING_APP=true node --import tsx scripts/deploy-generated.ts RUN_ID ATTEMPT` retains a tested artifact using existing credits. Inspect account cost/credit eligibility first; paid purchases require explicit cost approval.
- `node --import tsx scripts/verify-deployment.ts PRIVATE_RECEIPT_PATH` performs bounded real public verification with one synthetic email.
- `node --import tsx scripts/deploy-generated.ts --destroy PRIVATE_RECEIPT_PATH` destroys the retained sandbox and its isolated database role/data after judging.

The local private receipt is `.bounty-box/deployments/judge-8af637981f06b5.json`. It must remain private. A retained sandbox occupies the current account's single sandbox slot, so do not start another live test until capacity is available or judging has finished.
