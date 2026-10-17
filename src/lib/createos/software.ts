import { randomBytes } from 'node:crypto';
import { artifactDigest } from '../server/artifacts';
import { benchmark as independentBenchmark } from '../benchmark';
import { CreateosSandboxClient, type CreateSandboxOptions, type CreateSandboxRequest, type Sandbox } from '@nodeops-createos/sandbox';
import type { Brief, GeneratedApp, SandboxRunner, TestResult } from '../contracts';
import { resolveSoftwareTrial, softwareProfile, type ProviderEnvironment, type SoftwareStackId } from '../catalog/software';

// Trusted harness failures that are useful repair feedback, never arbitrary response text.
const REPAIRABLE_BENCHMARK_FAILURES = new Set([
  'Target health identity or artifact digest mismatch',
  'Persistence stats returned an invalid count',
  'First synthetic signup was not stored as a new record',
  'Synthetic signup did not persist exactly once',
  'Normalized duplicate signup was not recognized',
  'Normalized duplicate changed the persisted count',
  'Stored signup count does not match successful benchmark responses',
]);

export const CREATEOS_EU_ENDPOINT = 'https://api-eu.sb.createos.sh';
export interface SoftwareBenchmarkInput {
  baseUrl: string;
  token: string;
  brief: Brief;
  signal: AbortSignal;
  artifactDigest: string;
}
export type SoftwareBenchmark = (input: SoftwareBenchmarkInput) => Promise<TestResult>;
export type SoftwareSandbox = Pick<Sandbox, 'id' | 'files' | 'streamCommand' | 'setEgress' | 'waitForPortReady' | 'previewUrl' | 'destroy'>;
export interface SoftwareRunnerOptions {
  /** Defaults to agent-2's trusted worker-side benchmark. */
  benchmark?: SoftwareBenchmark;
  /** Test seam for authenticated health verification and the default benchmark. */
  fetchImpl?: typeof fetch;
  environment?: () => ProviderEnvironment;
  /** Test injection; production uses the installed SDK with explicit EU configuration. */
  clientFactory?: (config: { apiKey: string; baseUrl: string; retry: false }) => {
    createSandbox(request: CreateSandboxRequest, options: CreateSandboxOptions): Promise<SoftwareSandbox>;
  };
  /** Awaited durable lifecycle hook. Private control-plane metadata only; no credentials. */
  onLifecycle?: (event: { phase: 'creating' | 'created' | 'destroyed' | 'reconcile'; name: string; sandboxId?: string }) => Promise<void>;
}
export class SoftwareRunnerError extends Error {
  constructor(message: string) { super(message); this.name = 'SoftwareRunnerError'; }
}
/** Matches the coordinator's agreed canonical artifact envelope. */
export function softwareArtifactDigest(app: GeneratedApp): string {
  return artifactDigest(app);
}
function validateApp(app: GeneratedApp, allowedEnv: readonly string[]): boolean {
  if (!Number.isSafeInteger(app.revision) || app.revision < 1 || !app.files.length || app.files.length > 50) throw new SoftwareRunnerError('Invalid artifact revision or file count.');
  if (app.start.command !== 'node' || JSON.stringify(app.start.args) !== '["server.mjs"]' || app.start.port !== 3000 || app.loadTest.command !== 'node' || JSON.stringify(app.loadTest.args) !== '["diagnostic.mjs"]') throw new SoftwareRunnerError('Required commands: node server.mjs on port 3000; node diagnostic.mjs.');
  if (app.requiredEnvNames.some(name => !allowedEnv.includes(name))) throw new SoftwareRunnerError('Artifact requests an environment variable outside the scoped trial profile.');
  const paths = new Set<string>();
  let bytes = 0;
  for (const file of app.files) {
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*(?:\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*)*$/.test(file.path) || file.path.split('/').some(p => p === 'node_modules' || p === '.git') || paths.has(file.path)) throw new SoftwareRunnerError('Artifact paths must be unique safe relative paths; hidden files and node_modules are forbidden.');
    bytes += Buffer.byteLength(file.content);
    paths.add(file.path);
  }
  if (bytes > 1024 * 1024 || !paths.has('server.mjs') || !paths.has('diagnostic.mjs')) throw new SoftwareRunnerError('Artifact must include server.mjs and diagnostic.mjs within the 1 MiB limit.');
  if (paths.has('package.json') !== paths.has('package-lock.json')) throw new SoftwareRunnerError('Dependencies require both package.json and package-lock.json.');
  if (!paths.has('package.json')) return false;
  try {
    const manifest = JSON.parse(app.files.find(f => f.path === 'package.json')!.content);
    const lock = JSON.parse(app.files.find(f => f.path === 'package-lock.json')!.content);
    if (lock.lockfileVersion !== 3 || !lock.packages?.[''] || manifest.workspaces || manifest.devDependencies && Object.keys(manifest.devDependencies).length) throw new Error();
    for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
      if (!['@neondatabase/serverless', '@libsql/client'].includes(name) || typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) || lock.packages[''].dependencies?.[name] !== version) throw new Error();
    }
    for (const [path, value] of Object.entries(lock.packages) as Array<[string, { resolved?: string; integrity?: string; link?: boolean }]>) {
      if (!path) continue;
      if (!path.startsWith('node_modules/') || path.split('/').includes('..') || value.link || !value.resolved || !value.integrity) throw new Error();
      const url = new URL(value.resolved);
      if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.username || url.password || url.port || url.search || url.hash) throw new Error();
    }
  } catch { throw new SoftwareRunnerError('Invalid locked dependencies: use lockfile v3, pinned Neon/libSQL dependencies, and integrity-checked npm registry packages.'); }
  return true;
}
function validateBrief(brief: Brief) {
  const l = brief.load;
  if (!Number.isInteger(l.concurrency) || l.concurrency < 1 || l.concurrency > 50 || !Number.isFinite(l.durationSeconds) || l.durationSeconds < 1 || l.durationSeconds > 120 || !Number.isFinite(l.maxP95Ms) || l.maxP95Ms <= 0 || !Number.isFinite(l.maxErrorRate) || l.maxErrorRate < 0 || l.maxErrorRate > 1) throw new SoftwareRunnerError('Load parameters exceed supported bounds.');
}
async function withinDeadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new SoftwareRunnerError('Software run cancelled or exceeded its deadline.'));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try { return await Promise.race([work, aborted]); }
  finally { signal.removeEventListener('abort', onAbort); }
}
async function verifyHealth(fetchImpl: typeof fetch, baseUrl: string, token: string, digest: string, signal: AbortSignal): Promise<void> {
  const response = await fetchImpl(new URL('/health', baseUrl), {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal,
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new SoftwareRunnerError('Authenticated application health check failed.');
  }
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 4096) throw new SoftwareRunnerError('Health response exceeded its size limit.');
      chunks.push(chunk.value);
    }
    const health = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (health?.ok !== true || health.artifactDigest !== digest) throw new SoftwareRunnerError('Application health does not identify the selected artifact.');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function createSandboxRunner(options: SoftwareRunnerOptions = {}): SandboxRunner {
  if (typeof window !== 'undefined') throw new SoftwareRunnerError('Software runner is server-only.');
  if (options.benchmark !== undefined && typeof options.benchmark !== 'function') throw new SoftwareRunnerError('Independent benchmark callback must be a function.');
  const benchmark: SoftwareBenchmark = options.benchmark ?? (input => independentBenchmark({ ...input, fetchImpl: options.fetchImpl }));
  return { async run({ app: originalApp, stack, brief, signal }) {
    signal?.throwIfAborted();
    const app = structuredClone(originalApp);
    validateBrief(brief);
    const profile = softwareProfile(stack);
    const install = validateApp(app, [...profile.required, 'PORT', 'BOUNTYBOX_INGRESS_TOKEN', 'BOUNTYBOX_ARTIFACT_DIGEST', 'BOUNTYBOX_TRIAL_NAMESPACE']);
    const env = (options.environment ?? (() => process.env))();
    const trial = resolveSoftwareTrial(stack.id as SoftwareStackId, env);
    const apiKey = env.CREATEOS_PROJECT_API_KEY;
    if (!apiKey?.trim()) throw new SoftwareRunnerError('Missing CREATEOS_PROJECT_API_KEY; load CLI-managed credentials at process startup.');
    // Reject embedded known credentials before uploading source or returning app-derived metadata.
    const privateValues = [apiKey, ...Object.values(trial.secrets), ...Object.entries(env).filter(([name]) => /KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|CREDENTIAL/.test(name)).map(([, value]) => value)].filter((v): v is string => !!v && v.length >= 8);
    if (app.files.some(f => privateValues.some(secret => f.content.includes(secret)))) throw new SoftwareRunnerError('Artifact contains credentials; use runtime environment injection.');
    const client = options.clientFactory ? options.clientFactory({ apiKey, baseUrl: CREATEOS_EU_ENDPOINT, retry: false }) : new CreateosSandboxClient({ apiKey, baseUrl: CREATEOS_EU_ENDPOINT, retry: false });
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 15 * 60 * 1000);
    const token = randomBytes(32).toString('hex');
    const name = `bounty-${randomBytes(12).toString('hex')}`;
    const digest = softwareArtifactDigest(app);
    const runtime = { ...trial.secrets, PORT: '3000', BOUNTYBOX_INGRESS_TOKEN: token, BOUNTYBOX_ARTIFACT_DIGEST: digest, BOUNTYBOX_TRIAL_NAMESPACE: name.replaceAll('-', '_') };
    const logs: string[] = [];
    let sandbox: SoftwareSandbox | undefined;
    let stage = 'preflight';
    let outputBytes = 0;
    const execute = async (label: string, command: string, args: string[], timeoutMs: number, withSecrets = false) => {
      stage = label;
      const commandSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
      let exitCode: number | undefined;
      for await (const event of sandbox!.streamCommand(command, args, { signal: commandSignal, timeoutMs, retry: false, ...(withSecrets ? { env: runtime } : {}) })) {
        commandSignal.throwIfAborted();
        if (event.type === 'stdout' || event.type === 'stderr') {
          outputBytes += Buffer.byteLength(event.data);
          if (outputBytes > 256 * 1024) throw new SoftwareRunnerError('Attempt output exceeded 256 KiB.');
          // Deliberately do not retain arbitrary process text: it can encode scoped secrets.
        } else if (event.type === 'exit') exitCode = event.exitCode;
        else if (event.type === 'error') throw new SoftwareRunnerError(`Sandbox ${label} failed to execute.`);
      }
      if (exitCode === undefined) throw new SoftwareRunnerError(`Sandbox ${label} returned no exit status.`);
      logs.push(`${label}: exit ${exitCode}. Process output withheld.`);
      return exitCode;
    };
    const failed = (reason: string): TestResult => ({ passed: false, requests: 0, throughputRps: 0, p95Ms: 0, errorRate: 1, durationSeconds: 0, logs, failureReason: reason, mode: 'live' });
    try {
      controller.signal.throwIfAborted();
      await options.onLifecycle?.({ phase: 'creating', name });
      stage = 'create';
      sandbox = await client.createSandbox({ name, shape: 's-1vcpu-1gb', rootfs: 'devbox:1', ingress_enabled: true, auto_pause_after_seconds: 300,
        egress: install ? ['registry.npmjs.org:443'] : trial.egress,
        envs: Object.fromEntries(Object.keys(runtime).map(key => [key, ''])) }, { signal: controller.signal, timeoutMs: 90_000, retry: false });
      await options.onLifecycle?.({ phase: 'created', name, sandboxId: sandbox.id });
      if (await execute('workspace', 'mkdir', ['-p', '/tmp/bounty-app'], 15_000)) throw new SoftwareRunnerError('Could not create application workspace.');
      stage = 'upload';
      for (const file of app.files) {
        controller.signal.throwIfAborted();
        const parent = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
        if (parent && await execute('directory', 'mkdir', ['-p', `/tmp/bounty-app/${parent}`], 15_000)) throw new SoftwareRunnerError('Could not create application directory.');
        await sandbox.files.upload(`/tmp/bounty-app/${file.path}`, file.content, { signal: controller.signal, timeoutMs: 30_000, retry: false });
      }
      if (install && await execute('dependency install', 'sh', ['-c', 'cd /tmp/bounty-app && exec npm ci --ignore-scripts --omit=dev --no-audit --no-fund'], 120_000)) return failed('Locked dependency installation failed; no benchmark ran.');
      stage = 'restrict runtime network';
      await sandbox.setEgress(trial.egress, { signal: controller.signal, timeoutMs: 15_000, retry: false });
      if (await execute('start', 'sh', ['-c', 'cd /tmp/bounty-app && nohup setsid node server.mjs </dev/null >/dev/null 2>&1 &'], 15_000, true)) return failed('Application launch failed; no benchmark ran.');
      stage = 'readiness';
      try { await sandbox.waitForPortReady(3000, { signal: controller.signal, timeoutMs: 90_000 }); }
      catch { controller.signal.throwIfAborted(); return failed('Application did not become ready within 90 seconds; no benchmark ran.'); }
      // Generated diagnostics never qualify a proposal and are not interpreted as measured evidence.
      await execute('generated diagnostic (non-authoritative)', 'sh', ['-c', 'cd /tmp/bounty-app && exec node diagnostic.mjs'], 30_000, true);
      stage = 'independent benchmark';
      const baseUrl = sandbox.previewUrl(3000);
      const url = new URL(baseUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new SoftwareRunnerError('SDK did not supply a secure ingress origin.');
      stage = 'artifact health verification';
      const healthSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
      try { await withinDeadline(verifyHealth(options.fetchImpl ?? fetch, baseUrl, token, digest, healthSignal), healthSignal); }
      catch { controller.signal.throwIfAborted(); return failed('Authenticated health did not verify the selected artifact within its bounds; no benchmark ran.'); }
      stage = 'independent benchmark';
      let result: TestResult;
      try { result = await withinDeadline(benchmark({ baseUrl, token, brief: structuredClone(brief), signal: controller.signal, artifactDigest: digest }), controller.signal); }
      catch (error) {
        controller.signal.throwIfAborted();
        if (error instanceof Error && REPAIRABLE_BENCHMARK_FAILURES.has(error.message)) return failed(`Independent functional verification failed: ${error.message}. No qualifying benchmark measurements.`);
        throw error;
      }
      controller.signal.throwIfAborted();
      if (result.mode !== 'live' || !Number.isSafeInteger(result.requests) || result.requests < 1 || ![result.throughputRps, result.p95Ms, result.errorRate, result.durationSeconds].every(Number.isFinite) || result.throughputRps <= 0 || result.p95Ms < 0 || result.errorRate < 0 || result.errorRate > 1 || result.durationSeconds < brief.load.durationSeconds) throw new SoftwareRunnerError('Independent benchmark returned incomplete or invalid measurements.');
      const passed = result.passed && result.p95Ms <= brief.load.maxP95Ms && result.errorRate <= brief.load.maxErrorRate;
      return { passed, requests: result.requests, throughputRps: result.throughputRps, p95Ms: result.p95Ms, errorRate: result.errorRate, durationSeconds: result.durationSeconds,
        logs: [...logs, 'Independent worker benchmark completed. Sandbox is destroyed after measurement.'], mode: 'live', ...(passed ? {} : { failureReason: 'Independent benchmark did not meet acceptance criteria.' }) };
    } catch (error) {
      if (!sandbox && stage === 'create') {
        await options.onLifecycle?.({ phase: 'reconcile', name });
        throw new SoftwareRunnerError(`CreateOS create outcome requires reconciliation by sandbox name ${name}; do not retry automatically.`);
      }
      if (controller.signal.aborted) throw new SoftwareRunnerError('Software run cancelled or exceeded its deadline.');
      if (error instanceof SoftwareRunnerError) throw error;
      throw new SoftwareRunnerError(`Software provider failed during ${stage}; raw provider details withheld.`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (sandbox) {
        try { await sandbox.destroy({ timeoutMs: 30_000, retry: false }); }
        catch {
          await options.onLifecycle?.({ phase: 'reconcile', name, sandboxId: sandbox.id });
          throw new SoftwareRunnerError(`Cleanup failed for sandbox ${sandbox.id}; reconcile before another run.`);
        }
        await options.onLifecycle?.({ phase: 'destroyed', name, sandboxId: sandbox.id });
      }
    }
  } };
}
