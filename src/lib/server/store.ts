import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Brief, GeneratedApp, RunSnapshot } from '../contracts';
import { artifactDigest, artifactJson, saveArtifact, readArtifact } from './artifacts';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class Store {
  db: DatabaseSync;
  artifactRoot: string;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.artifactRoot = join(dirname(path), 'artifacts');
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, snapshot TEXT NOT NULL, app TEXT, digest TEXT, expires INTEGER);
      CREATE TABLE IF NOT EXISTS jobs(run_id TEXT PRIMARY KEY, state TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS requests(key TEXT PRIMARY KEY, hash TEXT NOT NULL, run_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS artifacts(run_id TEXT NOT NULL, attempt INTEGER NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(run_id,attempt));
      CREATE TABLE IF NOT EXISTS sandbox_resources(name TEXT PRIMARY KEY, run_id TEXT NOT NULL, phase TEXT NOT NULL, sandbox_id TEXT, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS lease(id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires INTEGER NOT NULL);`);
  }
  close() { this.db.close(); }
  recordSandbox(runId: string, event: { name: string; phase: string; sandboxId?: string }) {
    this.db.prepare(`INSERT INTO sandbox_resources VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET phase=excluded.phase,sandbox_id=COALESCE(excluded.sandbox_id,sandbox_resources.sandbox_id),updated_at=excluded.updated_at`)
      .run(event.name, runId, event.phase, event.sandboxId ?? null, new Date().toISOString());
  }
  unsettledSandboxes() {
    return this.db.prepare("SELECT name,run_id,phase,sandbox_id FROM sandbox_resources WHERE phase != 'destroyed'").all();
  }
  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  get(id: string): RunSnapshot {
    const row = this.db.prepare('SELECT snapshot FROM runs WHERE id=?').get(id);
    if (!row) throw new HttpError(404, 'Run not found');
    return JSON.parse(row.snapshot as string);
  }
  save(run: RunSnapshot) {
    this.db.prepare('UPDATE runs SET snapshot=? WHERE id=?').run(JSON.stringify(run), run.id);
  }
  recordArtifact(runId: string, attempt: number, app: GeneratedApp) {
    const digest = saveArtifact(this.artifactRoot, app);
    this.db.prepare('INSERT INTO artifacts VALUES(?,?,?)').run(runId, attempt, digest);
    return digest;
  }
  artifacts(runId: string) {
    this.get(runId);
    return this.db.prepare('SELECT attempt,digest FROM artifacts WHERE run_id=? ORDER BY attempt').all(runId);
  }
  artifact(runId: string, attempt: number) {
    this.get(runId);
    const row = this.db.prepare('SELECT digest FROM artifacts WHERE run_id=? AND attempt=?').get(runId, attempt);
    if (!row) throw new HttpError(404, 'Artifact not found');
    return { digest: row.digest as string, app: readArtifact(this.artifactRoot, row.digest as string) };
  }
  existingRequest(brief: Brief, mode: RunSnapshot['mode'], key?: string): RunSnapshot | undefined {
    if (!key) return;
    const old = this.db.prepare('SELECT hash,run_id FROM requests WHERE key=?').get(key);
    if (!old) return;
    const hash = createHash('sha256').update(JSON.stringify({ brief, mode })).digest('hex');
    if (old.hash !== hash) throw new HttpError(409, 'Idempotency key used for a different request');
    return this.get(old.run_id as string);
  }
  create(brief: Brief, mode: RunSnapshot['mode'], key?: string) {
    return this.tx(() => {
      const hash = createHash('sha256').update(JSON.stringify({ brief, mode })).digest('hex');
      const existing = this.existingRequest(brief, mode, key);
      if (existing) return existing;
      const count = this.db.prepare("SELECT count(*) AS n FROM jobs WHERE state IN ('queued','running')").get()!;
      if (Number(count.n) >= 5) throw new HttpError(429, 'Queue full; at most five unfinished runs');
      const now = new Date().toISOString();
      const run: RunSnapshot = { id: randomUUID(), mode, brief, status: 'queued', candidates: [], attempts: [],
        events: [{ id: 1, at: now, stage: 'queued', message: mode === 'fixture' ? 'Queued fixture run: all evidence is simulated.' : 'Queued live run.' }], createdAt: now, updatedAt: now };
      this.db.prepare('INSERT INTO runs(id,snapshot) VALUES(?,?)').run(run.id, JSON.stringify(run));
      this.db.prepare("INSERT INTO jobs VALUES(?,'queued',?)").run(run.id, Date.now());
      if (key) this.db.prepare('INSERT INTO requests VALUES(?,?,?)').run(key, hash, run.id);
      return run;
    });
  }
  acquire(owner: string) {
    return this.tx(() => {
      const lease = this.db.prepare('SELECT owner,expires FROM lease WHERE id=1').get();
      // Never steal an expired lease: external sandbox work may still be alive.
      if (lease) throw new Error(Number(lease.expires) < Date.now()
        ? 'Expired worker lease: reconcile external resources before restarting worker.' : 'Another worker owns the lease.');
      this.db.prepare('INSERT INTO lease VALUES(1,?,?)').run(owner, Date.now() + 60_000);
    });
  }
  heartbeat(owner: string) {
    const result = this.db.prepare('UPDATE lease SET expires=? WHERE id=1 AND owner=?').run(Date.now() + 60_000, owner);
    if (result.changes !== 1) throw new Error('Worker lease lost');
  }
  release(owner: string) { this.db.prepare('DELETE FROM lease WHERE id=1 AND owner=?').run(owner); }
  next(owner: string): RunSnapshot | undefined {
    return this.tx(() => {
      const lease = this.db.prepare('SELECT owner,expires FROM lease WHERE id=1').get();
      if (lease?.owner !== owner || Number(lease.expires) < Date.now()) throw new Error('Worker lease not held');
      const job = this.db.prepare("SELECT run_id FROM jobs WHERE state='queued' ORDER BY created LIMIT 1").get();
      if (!job) return;
      this.db.prepare("UPDATE jobs SET state='running' WHERE run_id=?").run(job.run_id);
      return this.get(job.run_id as string);
    });
  }
  update(run: RunSnapshot) {
    this.tx(() => {
      if (this.get(run.id).status === 'cancelled') return;
      this.save(run);
    });
  }
  finish(run: RunSnapshot, app?: GeneratedApp) {
    this.tx(() => {
      if (this.get(run.id).status !== 'cancelled') {
        if (run.status === 'awaiting_approval') {
          if (!app || !run.proposal) throw new Error('Proposal missing its tested artifact');
          const serialized = artifactJson(app);
          const digest = saveArtifact(this.artifactRoot, app);
          const expires = Date.now() + 15 * 60_000;
          run.proposal.artifactDigest = digest;
          run.proposal.approvalExpiresAt = new Date(expires).toISOString();
          this.db.prepare('UPDATE runs SET app=?,digest=?,expires=? WHERE id=?').run(serialized, digest, expires, run.id);
        }
        this.save(run);
      }
      this.db.prepare("UPDATE jobs SET state='done' WHERE run_id=?").run(run.id);
    });
  }
  cancel(id: string) {
    return this.tx(() => {
      const run = this.get(id);
      if (['deployed','failed','cancelled'].includes(run.status)) return run;
      if (run.status === 'provisioning') throw new HttpError(409, 'Shipping requires reconciliation before cancellation');
      run.status = 'cancelled';
      delete run.proposal;
      run.updatedAt = new Date().toISOString();
      run.events.push({ id: (run.events.at(-1)?.id ?? 0) + 1, at: run.updatedAt, stage: 'cancelled', message: 'Cancellation requested; active worker will clean up before processing another job.' });
      this.save(run);
      this.db.prepare("UPDATE jobs SET state='done' WHERE run_id=? AND state='queued'").run(id);
      return run;
    });
  }
  approve(id: string, proposalId: string): never {
    return this.tx(() => {
      const run = this.get(id);
      if (run.status !== 'awaiting_approval' || run.proposal?.id !== proposalId) throw new HttpError(409, 'Proposal is no longer current');
      if (run.mode === 'fixture') throw new HttpError(409, 'Fixture evidence cannot authorize live provisioning');
      const row = this.db.prepare('SELECT app,digest,expires FROM runs WHERE id=?').get(id)!;
      if (!row.app || Number(row.expires) <= Date.now()) throw new HttpError(409, 'Proposal expired or artifact missing');
      const digest = artifactDigest(JSON.parse(row.app as string));
      if (digest !== row.digest || digest !== run.proposal.artifactDigest) throw new HttpError(409, 'Artifact binding changed');
      readArtifact(this.artifactRoot, digest);
      throw new HttpError(503, 'Shipping adapter is not configured; no approval or purchase recorded');
    });
  }
}
