# Frontend ⇄ backend integration

The backend contract is owned by the backend team: see [`src/lib/contracts.ts`](../src/lib/contracts.ts)
and [backend-system-design.md](backend-system-design.md) §5. This file only describes how the web app uses it.

- **Demo mode** (`/app?mode=demo`): a scripted run in the browser. No backend.
- **Live mode** (`/app?mode=live`): calls `/api/*` on the Vite dev server, which proxies to the
  backend at `BOUNTYBOX_API_URL` (default `http://127.0.0.1:3000`) and adds
  `Authorization: Bearer $BOUNTYBOX_API_TOKEN` (set both in `web/.env.local`, never committed).
  - `POST /api/runs { brief, mode: 'live' | 'fixture' }`, then poll `GET /api/runs/:id` every 2 s.
  - `POST /api/runs/:id/approve { proposalId }`, `POST /api/runs/:id/cancel`.
  - `web/src/app/live/snapshotAdapter.ts` turns successive `RunSnapshot`s into the UI's event stream
    (`web/src/shared/types.ts`), so demo and live render through the same components.
  - Fixture runs are always labelled in the UI (ADR-16).
