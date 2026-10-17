# Provider setup verification

Verified 2026-10-17 on Stefan's Mac.

- Stripe project: Bounty-Box, initialized via Projects-specific onboarding.
- CreateOS provider link: complete.
- Free account plan: `createos-plan` (`createos/free`), complete.
- Free project service: `createos-project` (`createos/project`), complete.
- Neon free plan and dedicated Postgres service: `neon-plan`, `neon-postgres`, complete.
- Neon terms/privacy accepted explicitly by Stefan before provisioning.
- Credentials synced by `stripe projects env --pull` to ignored `.env`; vault also ignored.
- Variable prefixes: `CREATEOS_PLAN_*`, `CREATEOS_PROJECT_*`. Each includes API_KEY, API_URL, DASHBOARD_URL, CREDENTIALS. Never print values.

## Verified execution

Loaded the CLI-managed environment using Node's `--env-file=.env` and invoked CreateOS CLI with explicit `--sandbox-api-url https://api-eu.sb.createos.sh`.
Created one `s-1vcpu-1gb` sandbox using `devbox:1`, restricted egress to `example.com:443`, no public ingress, and five-minute auto-pause fallback. Uploaded a JavaScript assertion file and executed it with Node.

Result: `{"ok":true,"check":"bounty-box-upload-execute","node":"v24.21.0"}`.

Deleted that sandbox in a finally block; a subsequent sandbox list returned no sandboxes.

Neon connectivity and CREATE/DROP permissions were verified with harmless SQL probes.
The connection is loaded from `NEON_POSTGRES_CONNECTION_STRING` and mapped in memory
to `NEON_DATABASE_URL`. Regional HTTP SQL uses `api.<region>.aws.neon.tech`, so the
sandbox allowlist includes that API host as well as the database endpoint.

Codex CLI is authenticated using ChatGPT. A real noninteractive call returned a
validated application manifest without a separate API key. See backend-development.md.
CreateOS SDK credentials are mapped from `CREATEOS_PROJECT_API_KEY` and the EU endpoint
is explicit. Live debugging verified the 22-character sandbox name limit and managed
process startup. Dependency-free apps begin with database-only egress and skip npm
installation/network-policy switching.

Durable application deployment remains separate unfinished work. Sandbox testing
does not create a permanent application URL.

Use `stripe projects status` and `stripe projects env` for inspection. Do not hand-edit CLI-managed state or environment files. No paid plan was selected.
