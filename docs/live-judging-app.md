# Real judging app

During judging, Bounty-Box generated and deployed a real Node application with persistent Neon Postgres storage in a CreateOS sandbox. The client brief asked for a navy-and-gold Bounty-Box early-access waitlist. That sandbox was destroyed after judging, so its URL no longer resolves. The exact generated source is in `examples/judging-app`, and the artifact digest and measured evidence are in `docs/evidence/judging-run.json` and `docs/evidence/judging-verification.json`.

## What happened

1. Stripe Projects confirmed the existing CreateOS and Neon free-plan resources. No purchase, upgrade or top-up was made.
2. Signed-in local Codex generated the application from the client brief. Provider and database credentials were not passed to the model.
3. CreateOS ran the generated code and an independent persistence and load check.
4. Public deployment verification found a real bug: proxy headers made same-origin browser submissions return HTTP 403.
5. The measured failure and previous source went back to the model. Revision 2 used a trusted public-origin setting and passed retesting.
6. The exact tested revision was deployed with a unique restricted Neon login. Final public verification confirmed HTML form delivery, protected diagnostics, a matching artifact digest, cross-origin rejection, invalid-email rejection, persistent signup and normalized duplicate handling.

Revision 2 benchmark: **26 requests, 2 concurrent requests, 5.185 seconds, 624.11 ms p95, 0% errors**. Target users was a planning input; this does not prove 100 or 1,000 concurrent-user capacity.

## Boundaries

- The app process was bounded to 24 hours, ending October 18, 2026 at 9:17 PM EDT. It was a judging sandbox, not production hosting.
- Egress was restricted to the selected Neon HTTPS hosts. No CreateOS API key or database owner credential was injected into the app.
- The app's database login had no privileges on pre-existing tables and owned only the app's namespaced table.
- Temporary test sandboxes and the failed first deployment were destroyed.
- The public `/demo` is a scripted replay. Its catalog prices, hardware selection, benchmarks, provisioning steps and purchases are examples, not live evidence. Its final link opens a local waitlist preview, not this app.
- No confirmation email was sent. Arbitrary-app generation and approval from the hosted frontend are unfinished; the verified path was one operator-run waitlist template.

## Reproducing a run

Use Node 22 with your own `.env.backend.local` (see `.env.example`). Never put keys in command arguments.

- `node --import tsx scripts/judging-run.ts 'Your waitlist brief'` queues generation; run `npm run worker:hosted` separately.
- `BOUNTYBOX_RETAIN_JUDGING_APP=true node --import tsx scripts/deploy-generated.ts RUN_ID ATTEMPT` deploys a tested artifact and writes a private receipt under `.bounty-box/deployments/`.
- `node --import tsx scripts/verify-deployment.ts RECEIPT_PATH` runs a bounded public verification with one synthetic email.
- `node --import tsx scripts/deploy-generated.ts --destroy RECEIPT_PATH` destroys the sandbox and its database role and data.
