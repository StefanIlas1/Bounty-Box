# Bounty-Box: hackathon context

Read this before planning or building anything in this repo.

Event: **Build Agents That Run Code: CreateOS × Stripe Projects**, Sat Oct 17 2026.
Team: Mohsen Sarrafan (GitHub `mohsensc`) and Stefan Ilas (`StefanIlas1`).

## How agents work here

- **Planning and design thinking**: use Fable or Opus, whichever the problem needs.
- **Writing code**: use Sonnet for implementation subagents by default.
- **Speed over polish**: ship working features fast. Skip code review, QA passes, and extra test suites unless someone specifically asks for QA. A quick manual run to confirm it works is enough.

## Deadline

- 12:30 PM PT build starts
- **5:30 PM PT submissions lock** (the 7 PM on Luma is wrong; work back from 5:30)
- 6:00 PM PT top 5 demo live to judges
- Commits after the lock do not count

## Challenge

Build an AI agent that **writes and runs its own code**.
- Stack set up with **Stripe Projects**
- Agent's code runs inside a **CreateOS Sandbox**

Both are mandatory for prize eligibility.

## Rules

- New project only, built during the hackathon. Open-source libraries and templates are fine.
- AI coding tools allowed.
- Max 3 per team, one team per person, one submission per team.
- No edits or commits count after the lock.
- Harassment or plagiarism = disqualification.

## Judging criteria

1. **Sponsor tools**: meaningful use of Stripe Projects + CreateOS Sandbox. Judges call out fork, egress control, live URL, desktop, pause/resume. Use several visibly.
2. **Agent capability**: does it actually write, run, and **fix its own code**?
3. **Real-world use**: a real user with a real problem.
4. **Execution**: does it work, and is the demo clear?
5. **Creativity**: something they have not seen before.

Plan features against these. A working self-fix loop on camera beats extra scope.

## Submission (missing any of 1, 2, or 4 = not judged)

Submit through the form link they share before 5:30 PM PT.
1. **Demo video**, 2–3 min max, at least one team member on camera. Problem → how it works → live demo of the agent writing and running code → how Stripe Projects + CreateOS Sandbox are used. YouTube unlisted, Loom, or Drive (viewable).
2. **Public GitHub repo** with all code. README covers what it does, how to run it, tech used. Never commit `.env` or API keys.
3. **Project details**: team name, members + Discord handles, project name, short description.
4. **Build-in-public post** on X or LinkedIn tagging @createosai (X) / CreateOS (LinkedIn); link goes in the form.

Also submit to the Stripe Projects leaderboard at https://projects.dev/leaderboard with code **`CreateOS-2026`**.

## Docs and links

- Hackathon page and idea list: https://createos.sh/hackathon
- Stripe Projects hackathon guide: https://projects.dev/hackathon-participants
- Stripe Projects docs: https://docs.stripe.com/projects (agent-readable: https://projects.dev/llms.txt, https://projects.dev/skill.md)
- CreateOS Sandbox docs: https://createos.sh/docs/Sandbox/Overview (index for agents: https://createos.sh/docs/llms.txt; append `.md` to any docs page for markdown)
- Sandbox SDK quickstart: https://createos.sh/docs/Sandbox/SDK/Quickstart
- Sandbox REST API: https://createos.sh/docs/Sandbox/REST-API/Overview
- Sandbox limits: https://createos.sh/docs/Sandbox/Limits
- TypeScript SDK: https://github.com/NodeOps-app/createos-sandbox-sdk
- CLI: https://github.com/NodeOps-app/createos-cli
- Plugins: https://github.com/NodeOps-app/createos-plugins
- Other SDKs: createos-go-sdk, createos-rust-sdk, createos-csharp-sdk, createos-java-sdk under https://github.com/NodeOps-app
- Extra tools: https://shipbysundown.dev/
- CreateOS app, API keys, credits: https://createos.sh/app (keys at /app/profile)
- Support: Discord #support, hello@createos.sh

## CreateOS Sandbox facts

- **API URL for this event: `https://api-eu.sb.createos.sh`**. Set `CREATEOS_SANDBOX_BASE_URL` to it; docs default to the US URL and region must match.
- SDK: `npm install @nodeops-createos/sandbox`, `createClient()` reads `CREATEOS_SANDBOX_BASE_URL` + `CREATEOS_SANDBOX_API_KEY`.
- Flow: `client.createSandbox({ shape, rootfs: "devbox:1" })` → `sandbox.runCommand(cmd, args)` / `sandbox.files.upload` → `sandbox.destroy()` in `finally`.
- REST: header `X-Api-Key`, `POST /v1/sandboxes/{id}/exec` (`?stream=true` for NDJSON), `PUT|GET /v1/sandboxes/{id}/files?path=/abs/path`.
- `devbox:1` has Python 3.12 + data/AI packages, Node 24, Bun, Go, Rust, and `claude`/`codex` CLIs.
- **Free plan: 1 concurrent sandbox, 10 per day, max 1 vCPU / 1 GB** (use `s-1vcpu-1gb`). Paused sandboxes still count. Destroy right after each run.
- Egress is open by default; set an allowlist (e.g. `["pypi.org:443", "*.pythonhosted.org:443"]`) before running model-written code. Good judging point.
- Other judge-visible features: `ingress_enabled: true` for a live HTTPS URL, pause/resume/fork, `auto_pause_after_seconds`.
- Credits only arrive after signing up and generating an API key.

## Stripe Projects facts

- Install: `npm install -g @stripe/cli@latest && stripe plugin install projects` (already done on Mohsen's machine).
- If init fails or says invite-only: `stripe plugin upgrade projects` then `stripe projects init`. Backup: https://dashboard.stripe.com/projects/new. No US business details needed.
- `stripe projects add createos/project` provisions CreateOS through Stripe Projects.
- One person runs `init`; the other runs `stripe projects env --pull` after pulling.
- Commit `.projects/state.json` and `.projects/state.local.json`. Never commit `.env`, `.env.*`, `.projects/vault/`, `.projects/cache/`.
- Agents: use `--json`, never print env var values, never hand-edit `.projects/` or `.env`, read vars with `stripe projects env`.
