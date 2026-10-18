import type { GeneratedApp, RunSnapshot } from '../contracts.js';

export type ArtifactMap = Record<string, { digest: string; app: GeneratedApp }>;
export interface HostedRecord {
  snapshot: RunSnapshot;
  artifacts: ArtifactMap;
  privateState: Record<string, unknown>;
}
export class StoreError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

async function sql(query: string, params: unknown[] = []): Promise<unknown[][]> {
  const connection = process.env.WAITLIST_DATABASE_URL;
  if (!connection) throw new StoreError(503, 'Hosted run storage is not configured.');
  let endpoint: string;
  try {
    const host = new URL(connection).hostname;
    if (!host.endsWith('.neon.tech')) throw new Error();
    endpoint = `https://${host.replace(/^[^.]+\./, 'api.')}/sql`;
  } catch { throw new StoreError(503, 'Hosted run storage configuration is invalid.'); }
  try {
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connection,
        'Neon-Array-Mode': 'true', 'Neon-Raw-Text-Output': 'true' },
      body: JSON.stringify({ query, params }),
    });
    // Only selected JSON fields leave this module. Provider errors can contain SQL data.
    const value = await response.json() as { rows?: unknown[][]; code?: string };
    if (!response.ok) {
      if (value.code === '23505') throw new StoreError(409, 'Another build is active. Wait for it to finish before starting or deploying a run.');
      throw new StoreError(503, 'Hosted run storage is temporarily unavailable.');
    }
    if (!Array.isArray(value.rows)) throw new StoreError(503, 'Hosted run storage returned an invalid response.');
    return value.rows;
  } catch (error) {
    if (error instanceof StoreError) throw error;
    throw new StoreError(503, 'Hosted run storage is temporarily unavailable.');
  }
}

let initialized: Promise<void> | undefined;
export async function init(): Promise<void> {
  initialized ??= (async () => {
    await sql(`CREATE TABLE IF NOT EXISTS public.bb_runs (
      id uuid PRIMARY KEY,
      owner_hash text NOT NULL,
      status text NOT NULL CHECK (status IN ('queued','planning','generating','testing','repairing','awaiting_approval','provisioning','deployed','failed','cancelled')),
      snapshot jsonb NOT NULL,
      artifacts jsonb NOT NULL DEFAULT '{}'::jsonb,
      private_state jsonb NOT NULL DEFAULT '{}'::jsonb,
      lease_until timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await sql(`CREATE UNIQUE INDEX IF NOT EXISTS bb_runs_one_active ON public.bb_runs ((true))
      WHERE status IN ('queued','planning','generating','testing','repairing','provisioning')`);
    await sql(`CREATE TABLE IF NOT EXISTS public.bb_run_quota (
      quota_date date PRIMARY KEY,
      run_count integer NOT NULL CHECK (run_count BETWEEN 0 AND 5)
    )`);
  })().catch(error => { initialized = undefined; throw error; });
  return initialized;
}

function validId(id: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new StoreError(404, 'Run not found.');
}
function owner(value: string) {
  if (!value || value.length > 256) throw new StoreError(401, 'A valid run session is required.');
}
function json<T>(value: unknown): T {
  try { return (typeof value === 'string' ? JSON.parse(value) : value) as T; }
  catch { throw new StoreError(503, 'Stored run data could not be read.'); }
}

export async function create(snapshot: RunSnapshot, ownerHash: string): Promise<void> {
  validId(snapshot.id); owner(ownerHash); await init();
  // A quota-row update serializes the daily cap; the partial unique index serializes
  // active runs. Both are enforced by Postgres in this single atomic statement.
  const rows = await sql(`WITH quota AS (
    INSERT INTO public.bb_run_quota (quota_date, run_count)
      VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
    ON CONFLICT (quota_date) DO UPDATE SET run_count = bb_run_quota.run_count + 1
      WHERE bb_run_quota.run_count < 5
    RETURNING quota_date
  ) INSERT INTO public.bb_runs (id, owner_hash, status, snapshot)
      SELECT $1::uuid, $2, $3, $4::jsonb FROM quota RETURNING id`,
  [snapshot.id, ownerHash, snapshot.status, JSON.stringify(snapshot)]);
  if (!rows.length) throw new StoreError(429, 'The five-build daily demo limit has been reached. Try again tomorrow.');
}

export async function get(id: string, ownerHash: string): Promise<HostedRecord> {
  validId(id); owner(ownerHash); await init();
  const rows = await sql('SELECT snapshot, artifacts, private_state FROM public.bb_runs WHERE id = $1::uuid AND owner_hash = $2', [id, ownerHash]);
  if (!rows.length) throw new StoreError(404, 'Run not found.');
  return { snapshot: json<RunSnapshot>(rows[0][0]), artifacts: json<ArtifactMap>(rows[0][1]), privateState: json<Record<string, unknown>>(rows[0][2]) };
}

/** Trusted worker only; request handlers must first authorize with get(id, ownerHash). */
export async function save(id: string, snapshot: RunSnapshot, artifacts?: ArtifactMap, privateState?: Record<string, unknown>): Promise<void> {
  validId(id);
  if (snapshot.id !== id) throw new StoreError(400, 'Run identity mismatch.');
  await init();
  const rows = await sql(`UPDATE public.bb_runs SET snapshot = CASE WHEN status = 'cancelled' THEN snapshot ELSE $2::jsonb END,
    status = CASE WHEN status = 'cancelled' THEN status ELSE $3 END,
    artifacts = COALESCE($4::jsonb, artifacts), private_state = COALESCE($5::jsonb, private_state), updated_at = now()
    WHERE id = $1::uuid RETURNING id`,
  [id, JSON.stringify(snapshot), snapshot.status, artifacts === undefined ? null : JSON.stringify(artifacts), privateState === undefined ? null : JSON.stringify(privateState)]);
  if (!rows.length) throw new StoreError(404, 'Run not found.');
}

/** One bounded invocation may advance a run at a time. Lease expiration permits recovery. */
export async function acquire(id: string): Promise<boolean> {
  validId(id); await init();
  const rows = await sql(`UPDATE public.bb_runs SET lease_until = now() + interval '6 minutes'
    WHERE id = $1::uuid AND (lease_until IS NULL OR lease_until < now()) RETURNING id`, [id]);
  return rows.length === 1;
}

export async function release(id: string): Promise<void> {
  validId(id); await init();
  await sql('UPDATE public.bb_runs SET lease_until = NULL WHERE id = $1::uuid', [id]);
}

/** Public lookup intentionally selects no credentials, artifacts or private-state object. */
export async function getDeployment(slug: string): Promise<{ url: string; title: string; expiresAt: string } | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(slug)) return null;
  await init();
  const rows = await sql(`SELECT private_state->'deployment'->>'url',
    COALESCE(private_state->'deployment'->>'title', snapshot->'brief'->>'description'),
    COALESCE(private_state->'deployment'->>'expiresAt', private_state->>'expiresAt')
    FROM public.bb_runs WHERE status = 'deployed' AND private_state->>'slug' = $1 LIMIT 1`, [slug]);
  if (!rows.length || typeof rows[0][0] !== 'string' || typeof rows[0][2] !== 'string') return null;
  try {
    const url = new URL(rows[0][0]);
    const expiresAt = rows[0][2];
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.app.sb.createos.sh') || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) return null;
    return { url: url.origin, title: String(rows[0][1] ?? 'Generated app').slice(0, 200), expiresAt };
  } catch { return null; }
}
