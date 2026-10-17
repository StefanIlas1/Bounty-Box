# Provider setup verification

Verified 2026-10-17 on Stefan's Mac.

- Stripe project: Bounty-Box, initialized via Projects-specific onboarding.
- CreateOS provider link: complete.
- Free account plan: `createos-plan` (`createos/free`), complete.
- Free project service: `createos-project` (`createos/project`), complete.
- Credentials synced by `stripe projects env --pull` to ignored `.env`; vault also ignored.
- Variable prefixes: `CREATEOS_PLAN_*`, `CREATEOS_PROJECT_*`. Each includes API_KEY, API_URL, DASHBOARD_URL, CREDENTIALS. Never print values.

## Verified execution

Loaded the CLI-managed environment using Node's `--env-file=.env` and invoked CreateOS CLI with explicit `--sandbox-api-url https://api-eu.sb.createos.sh`.
Created one `s-1vcpu-1gb` sandbox using `devbox:1`, restricted egress to `example.com:443`, no public ingress, and five-minute auto-pause fallback. Uploaded a JavaScript assertion file and executed it with Node.

Result: `{"ok":true,"check":"bounty-box-upload-execute","node":"v24.21.0"}`.

Deleted that sandbox in a finally block; a subsequent sandbox list returned no sandboxes.

This verifies Stripe provisioning, credential sync, and CLI upload/execution/cleanup. SDK credential mapping, application generation, benchmark harness, and durable application deployment still need implementation and validation. The CLI uses CREATEOS_SANDBOX_URL; the planned SDK uses CREATEOS_SANDBOX_BASE_URL. Pass the EU endpoint explicitly.

Use `stripe projects status` and `stripe projects env` for inspection. Do not hand-edit CLI-managed state or environment files. No paid plan was selected. Setup changes are local and have not been pushed.
