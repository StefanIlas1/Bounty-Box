/** Retain one real, verified CreateOS judging sandbox. No purchases or top-ups. */
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CreateosSandboxClient, type Sandbox } from '@nodeops-createos/sandbox';
import { config } from '../src/lib/server/config';
import { Store } from '../src/lib/server/store';
import { resolveSoftwareTrial } from '../src/lib/catalog/software';
import { CREATEOS_EU_ENDPOINT } from '../src/lib/createos/software';

const settings = config();
async function ownerSql(query: string) {
  const connection = process.env.NEON_DATABASE_URL!;
  const host = new URL(connection).hostname.replace(/^[^.]+\./, 'api.');
  const response = await fetch(`https://${host}/sql`, { method: 'POST', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connection }, body: JSON.stringify({ query, params: [] }) });
  const data = await response.json() as { error?: unknown; message?: unknown; rows?: unknown[] };
  if (!response.ok || data.error || !Array.isArray(data.rows)) throw new Error('Scoped Neon role provisioning failed; provider response withheld.');
  return data;
}
function safeRole(role: string) { if (!/^judge_[a-f0-9]{14}$/.test(role)) throw new Error('Invalid scoped role.'); return role; }
const [runId, attemptText] = process.argv.slice(2);
if (runId === '--destroy') {
  let cleanupStage = 'receipt';
  try {
  if (!attemptText) throw new Error('Supply the private deployment receipt path.');
  const receipt = JSON.parse(await readFile(attemptText, 'utf8'));
  if (!/^judge-[a-f0-9]{14}$/.test(receipt.name) || !/^sb-/.test(receipt.sandboxId)) throw new Error('Invalid judging receipt.');
  const key = process.env.CREATEOS_PROJECT_API_KEY;
  if (!key) throw new Error('Missing CreateOS credential.');
  const cleanup = new CreateosSandboxClient({ apiKey: key, baseUrl: CREATEOS_EU_ENDPOINT, retry: false });
  cleanupStage = 'sandbox';
  try {
    const target = await cleanup.getSandbox(receipt.sandboxId, { timeoutMs: 15_000, retry: false });
    await target.destroy({ timeoutMs: 30_000, retry: false });
  } catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
  if (receipt.databaseRole) {
    cleanupStage = 'database role';
    const role = safeRole(receipt.databaseRole);
    await ownerSql(`GRANT ${role} TO CURRENT_USER`);
    await ownerSql(`DROP OWNED BY ${role}`);
    await ownerSql(`DROP ROLE ${role}`);
  }
  cleanupStage = 'lifecycle';
  const cleanupStore = new Store(settings.db);
  cleanupStore.recordSandbox(receipt.runId, { name: receipt.name, sandboxId: receipt.sandboxId, phase: 'destroyed' });
  cleanupStore.close();
  console.log('Judging sandbox destroyed.');
  process.exit(0);
  } catch (error) { console.error(`Judging cleanup failed at ${cleanupStage}; status ${(error as { status?: number }).status ?? 'unavailable'}. Provider details withheld.`); process.exit(1); }
}
const attempt = Number(attemptText);
if (!runId || !Number.isSafeInteger(attempt) || attempt < 1) throw new Error('Usage: deploy-generated.ts RUN_ID ATTEMPT');
if (process.env.BOUNTYBOX_RETAIN_JUDGING_APP !== 'true') throw new Error('Set BOUNTYBOX_RETAIN_JUDGING_APP=true only after verifying existing credits and authorizing retained judging execution.');
const store = new Store(settings.db);
let sandbox: Sandbox | undefined;
let retained = false;
const name = `judge-${randomBytes(7).toString('hex')}`;
let databaseRole: string | undefined;
const signal = AbortSignal.timeout(240_000);
let stage = 'preflight';
try {
  if (store.unsettledSandboxes().length) throw new Error('Reconcile existing sandboxes before retaining a new judging app.');
  const run = store.get(runId);
  if (run.mode !== 'live' || run.candidates[0]?.id !== 'createos-neon') throw new Error('Only a real CreateOS + Neon run is supported.');
  const { app, digest } = store.artifact(runId, attempt);
  const tested = run.attempts.find(item => item.number === attempt);
  if (!tested || tested.result?.passed !== true || tested.result.mode !== 'live' || tested.revision !== app.revision || tested.stack.id !== 'createos-neon') throw new Error('Selected artifact has not passed a real matching revision test.');
  if (run.proposal?.artifactDigest && run.proposal.artifactDigest !== digest) throw new Error('Selected artifact differs from tested proposal.');
  if (app.start.command !== 'node' || JSON.stringify(app.start.args) !== '["server.mjs"]' || app.start.port !== 3000) throw new Error('Unsupported generated app start command.');
  const manifestFile = app.files.find(f => f.path === 'package.json');
  const lockFile = app.files.find(f => f.path === 'package-lock.json');
  if (!!manifestFile !== !!lockFile) throw new Error('Package manifest requires lockfile.');
  if (manifestFile && lockFile) {
    const manifest = JSON.parse(manifestFile.content);
    const lock = JSON.parse(lockFile.content);
    if (['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'scripts'].some(key => Object.keys(manifest[key] ?? {}).length) || manifest.workspaces || lock.lockfileVersion !== 3 || Object.keys(lock.packages ?? {}).some(key => key !== '')) throw new Error('Only dependency-free manifests without scripts are supported.');
  }
  const trial = resolveSoftwareTrial('createos-neon', process.env);
  const apiKey = process.env.CREATEOS_PROJECT_API_KEY;
  if (!apiKey) throw new Error('Missing CreateOS credential.');
  const knownSecrets = Object.entries(process.env).filter(([k,v]) => /KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|CONNECTION_STRING/.test(k) && v && v.length >= 8).map(([,v]) => v!);
  let size = 0;
  const paths = new Set<string>();
  for (const file of app.files) {
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*(?:\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*)*$/.test(file.path) || file.path.split('/').some(p => p === '..' || p === 'node_modules') || paths.has(file.path)) throw new Error('Unsafe artifact path.');
    paths.add(file.path); size += Buffer.byteLength(file.content);
    if (knownSecrets.some(value => file.content.includes(value))) throw new Error('Artifact includes a credential.');
  }
  if (size > 1024 * 1024 || app.files.length > 50 || !paths.has('server.mjs')) throw new Error('Artifact exceeds deployment bounds.');
  const client = new CreateosSandboxClient({ apiKey, baseUrl: CREATEOS_EU_ENDPOINT, retry: false });
  const token = randomBytes(32).toString('hex');
  const namespace = name.replaceAll('-', '_');
  const role = safeRole(namespace);
  const password = randomBytes(32).toString('hex');
  const scopedUrl = new URL(trial.secrets.NEON_DATABASE_URL);
  stage = 'scoped database role';
  await ownerSql(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
  databaseRole = role;
  const dbName = decodeURIComponent(scopedUrl.pathname.slice(1)).replaceAll('"', '""');
  await ownerSql(`GRANT CONNECT ON DATABASE "${dbName}" TO ${role}`);
  await ownerSql(`GRANT USAGE, CREATE ON SCHEMA public TO ${role}`);
  const privileges = await ownerSql(`SELECT count(*)::int AS accessible FROM pg_tables WHERE schemaname = 'public' AND has_table_privilege('${role}', quote_ident(schemaname)||'.'||quote_ident(tablename), 'SELECT,INSERT,UPDATE,DELETE')`);
  if (Number((privileges.rows?.[0] as { accessible?: number })?.accessible) !== 0) throw new Error('Scoped role unexpectedly has access to existing public tables.');
  scopedUrl.username = role; scopedUrl.password = password;
  const runtime = { NEON_DATABASE_URL: scopedUrl.toString(), PORT: '3000', BOUNTYBOX_INGRESS_TOKEN: token, BOUNTYBOX_ARTIFACT_DIGEST: digest, BOUNTYBOX_TRIAL_NAMESPACE: namespace, BOUNTYBOX_PUBLIC_ORIGIN: '' };
  store.recordSandbox(runId, { name, phase: 'creating' });
  stage = 'sandbox create';
  sandbox = await client.createSandbox({ name, shape: 's-1vcpu-1gb', rootfs: 'devbox:1', ingress_enabled: true, egress: trial.egress, auto_pause_after_seconds: 86400,
    envs: Object.fromEntries(Object.keys(runtime).map(key => [key, ''])) }, { signal, timeoutMs: 90_000, retry: false });
  store.recordSandbox(runId, { name, sandboxId: sandbox.id, phase: 'created' });
  runtime.BOUNTYBOX_PUBLIC_ORIGIN = new URL(sandbox.previewUrl(3000)).origin;
  stage = 'artifact upload';
  for (const file of app.files) {
    const folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    const result = await sandbox.runCommand('mkdir', ['-p', `/tmp/bounty-app/${folder}`], { signal, timeoutMs: 15_000, retry: false });
    if (result.result.exit_code !== 0) throw new Error('Could not prepare deployment directory.');
    await sandbox.files.upload(`/tmp/bounty-app/${file.path}`, file.content, { signal, timeoutMs: 15_000, retry: false });
  }
  stage = 'application start';
  const managed = await sandbox.processes.create({ cmd: 'timeout', args: ['--signal=TERM', '--kill-after=10s', '86400', 'node', 'server.mjs'], cwd: '/tmp/bounty-app', env: runtime }, { signal, timeoutMs: 15_000, retry: false });
  if (managed.leader_exited) throw new Error('Judging application exited during startup.');
  await sandbox.waitForPortReady(3000, { signal, timeoutMs: 60_000 });
  const url = sandbox.previewUrl(3000);
  stage = 'public application verification';
  if (new URL(url).protocol !== 'https:') throw new Error('Expected HTTPS judging URL.');
  const health = await fetch(new URL('/health', url), { headers: { Authorization: `Bearer ${token}` }, signal, redirect: 'error' });
  const healthBody = await health.json() as { artifactDigest?: string };
  if (!health.ok || healthBody.artifactDigest !== digest) throw new Error('Live deployment artifact identity did not verify.');
  const root = await fetch(url, { signal, redirect: 'error' });
  if (!root.ok || !root.headers.get('content-type')?.includes('text/html') || !(await root.text()).includes('<form')) throw new Error('Public judging page did not render a signup form.');
  const receipt = { runId, attempt, digest, sandboxId: sandbox.id, name, url, token, namespace, databaseRole,
    createdAt: new Date().toISOString(), applicationExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
    egress: trial.egress, executionSeconds: 86400, idleAutoPauseSeconds: 86400,
    limitation: 'Application process ends after 24 hours. Idle auto-pause is not a hard sandbox lifetime or billing cap. Retained sandbox must be destroyed manually after judging.' };
  const receiptDir = resolve(process.cwd(), '.bounty-box', 'deployments');
  stage = 'private receipt';
  await mkdir(receiptDir, { recursive: true, mode: 0o700 });
  await writeFile(resolve(receiptDir, `${name}.json`), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: 'wx' });
  store.recordSandbox(runId, { name, sandboxId: sandbox.id, phase: 'retained-for-judging' });
  retained = true;
  console.log(JSON.stringify({ url, sandboxId: sandbox.id, digest, receipt: `.bounty-box/deployments/${name}.json`, applicationExpiresAt: receipt.applicationExpiresAt, warning: receipt.limitation }));
} catch (error) {
  if (!sandbox) {
    const pending = store.unsettledSandboxes().some(row => row.name === name);
    if (pending) store.recordSandbox(runId, { name, phase: 'reconcile' });
  }
  console.error(`Judging deployment failed during ${stage}; provider details withheld. Inspect lifecycle records before retrying.`);
  process.exitCode = 1;
} finally {
  if (!retained && sandbox) {
    try { await sandbox.destroy({ timeoutMs: 30_000, retry: false }); store.recordSandbox(runId, { name, sandboxId: sandbox.id, phase: 'destroyed' }); }
    catch { store.recordSandbox(runId, { name, sandboxId: sandbox.id, phase: 'reconcile' }); }
  }
  if (!retained && databaseRole) {
    try { await ownerSql(`GRANT ${safeRole(databaseRole)} TO CURRENT_USER`); await ownerSql(`DROP OWNED BY ${safeRole(databaseRole)}`); await ownerSql(`DROP ROLE ${safeRole(databaseRole)}`); }
    catch { console.error(`Scoped database role ${databaseRole} requires cleanup; no automatic retry.`); }
  }
  store.close();
}
