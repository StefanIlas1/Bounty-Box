import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Store } from './store';
import { config } from './config';
import { fixtureAdapters } from './fixtures';
import { orchestrateRun } from '../orchestrator';
import { liveAdapters, livePreflight } from './live';

export async function processNext(store: Store, owner: string, shutdown?: AbortSignal) {
  const run = store.next(owner);
  if (!run) return false;
  const controller = new AbortController();
  const abort = () => controller.abort();
  shutdown?.addEventListener('abort', abort, { once: true });
  if (shutdown?.aborted) abort();
  const deadline = setTimeout(abort, 15 * 60_000);
  const watch = setInterval(() => {
    try { if (store.get(run.id).status === 'cancelled') abort(); }
    catch { abort(); }
  }, 200);
  try {
    if (run.mode === 'live') await livePreflight(run.brief, store);
    const adapters = run.mode === 'fixture' ? fixtureAdapters() : liveAdapters(store, run.id);
    let attempt = 0;
    const generator = { generate: async (...args: Parameters<typeof adapters.generator.generate>) => {
      const app = await adapters.generator.generate(...args);
      store.recordArtifact(run.id, ++attempt, app);
      return app;
    } };
    const result = await orchestrateRun({ run, ...adapters, generator, signal: controller.signal,
      onUpdate: async (snapshot) => {
        if (store.get(run.id).status === 'cancelled') abort();
        // Approval becomes visible only when the tested artifact is stored atomically.
        if (snapshot.status !== 'awaiting_approval') store.update(snapshot);
      } });
    store.finish(result.run, result.app);
  } catch {
    const failed = store.get(run.id);
    if (failed.status !== 'cancelled') { failed.status = 'failed'; failed.error = 'Worker failed; inspect configuration and reconcile external resources before retrying.'; failed.updatedAt = new Date().toISOString(); }
    store.finish(failed);
  } finally { clearTimeout(deadline); clearInterval(watch); shutdown?.removeEventListener('abort', abort); }
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = new Store(config().db);
  const owner = randomUUID();
  store.acquire(owner);
  const stop = new AbortController();
  for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal, () => stop.abort());
  let leaseFailure = false;
  const heartbeat = setInterval(() => { try { store.heartbeat(owner); } catch { leaseFailure = true; stop.abort(); } }, 10_000);
  console.log('Bounty-Box worker running (live adapters require explicit configuration)');
  try {
    while (!stop.signal.aborted) {
      if (!await processNext(store, owner, stop.signal)) await delay(250);
    }
  } finally { clearInterval(heartbeat); if (!leaseFailure) store.release(owner); store.close(); }
}
