import { config } from '../src/lib/server/config';
import { Store } from '../src/lib/server/store';
import { createSandboxRunner } from '../src/lib/createos/software';
const store = new Store(config().db);
const runId = process.argv[2];
if (!runId) throw new Error('Supply the run ID whose generated artifact should be verified');
try {
  if (store.unsettledSandboxes().length) throw new Error('Reconcile resources first');
  const run = store.get(runId);
  const app = store.artifact(runId, 1).app;
  const result = await createSandboxRunner({ onLifecycle: async event => {
    store.recordSandbox(runId, event); console.log(JSON.stringify(event));
  } }).run({ app, stack: run.candidates[0], brief: run.brief, signal: AbortSignal.timeout(300000) });
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Verification failed'); process.exitCode = 1;
} finally { store.close(); }
