import { hardwareDigest, type HardwarePackage, type HardwareCheck } from '../catalog/packages';

export interface HardwareSandbox {
  id: string;
  files: { upload(path: string, content: string, options: { signal: AbortSignal; timeoutMs: number }): Promise<unknown> };
  streamCommand(command: string, args: string[], options: { signal: AbortSignal; timeoutMs: number }): AsyncIterable<
    { type: 'stdout' | 'stderr'; data: string } | { type: 'exit'; exitCode: number } |
    { type: 'error'; message: string } | { type: 'heartbeat' }>;
  destroy(options: { timeoutMs: number }): Promise<unknown>;
}
export interface HardwareSandboxFactory {
  /** Must create an isolated sandbox with egress set before executing any source. */
  create(options: { shape: 's-1vcpu-1gb'; egress: string[]; signal: AbortSignal }): Promise<HardwareSandbox>;
}
export interface HardwareValidation {
  artifactDigest: string;
  sandboxId: string;
  mode: 'live' | 'fixture';
  checks: Array<{ id: string; scope: HardwareCheck['scope']; status: 'passed' | 'failed' | 'not-run'; exitCode?: number }>;
  logs: string[];
  passed: boolean;
  physicalVerification: 'not-performed';
  cleanup: 'destroyed';
}
const ALLOWED_TOOLS = new Set(['cmake', 'iverilog', 'vvp', 'yosys', 'nextpnr-ice40', 'icepack']);
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";

/** Uses the SDK-compatible session supplied by the coordinator; never executes source on the host. */
export function createHardwareValidator(factory: HardwareSandboxFactory, mode: 'live' | 'fixture' = 'live') {
  if (typeof window !== 'undefined') throw new Error('Hardware validation is server-only.');
  return {
    async validate(bundle: HardwarePackage, signal?: AbortSignal): Promise<HardwareValidation> {
      if (!bundle.files.length || bundle.files.length > 50 || bundle.files.reduce((n, f) => n + new TextEncoder().encode(f.content).length, 0) > 1024 * 1024) throw new Error('Hardware source exceeds file/byte bounds.');
      const paths = new Set<string>();
      for (const file of bundle.files) {
        if (!/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(file.path) || file.path.split('/').some(p => p === '.' || p === '..') || paths.has(file.path)) throw new Error('Invalid or duplicate hardware artifact path.');
        paths.add(file.path);
      }
      if (await hardwareDigest(bundle.files) !== bundle.artifactDigest) throw new Error('Hardware artifact digest mismatch.');
      const manifestFile = bundle.files.find(f => f.path === 'hardware-manifest.json');
      if (!manifestFile) throw new Error('Hardware manifest is missing.');
      const manifest = JSON.parse(manifestFile.content);
      if (manifest.targetId !== bundle.targetId || manifest.task !== bundle.task || JSON.stringify(manifest.blockers) !== JSON.stringify(bundle.blockers)) throw new Error('Hardware target metadata does not match artifact.');
      const plan = bundle.files.find(f => f.path === 'validation-plan.json');
      if (!plan || JSON.stringify(JSON.parse(plan.content)) !== JSON.stringify(bundle.checks)) throw new Error('Validation plan is not bound to artifact digest.');
      if (!bundle.checks.length || bundle.checks.length > 10 || bundle.checks.some(c => !ALLOWED_TOOLS.has(c.tool) || c.args.length > 30 || c.args.some(a => a.length > 4096 || a.includes('\0')))) throw new Error('Unsupported hardware toolchain command.');
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, 15 * 60 * 1000);
      let sandbox: HardwareSandbox | undefined;
      const logs: string[] = [];
      let bytes = 0;
      const run = async (command: string, args: string[]) => {
        let exitCode: number | undefined;
        for await (const event of sandbox!.streamCommand(command, args, { signal: controller.signal, timeoutMs: 90_000 })) {
          controller.signal.throwIfAborted();
          if (event.type === 'stdout' || event.type === 'stderr') {
            bytes += new TextEncoder().encode(event.data).length;
            if (bytes > 256 * 1024) { controller.abort(); throw new Error('Hardware tool output exceeds 256 KiB.'); }
            logs.push(event.data);
          } else if (event.type === 'exit') exitCode = event.exitCode;
          else if (event.type === 'error') throw new Error('Sandbox could not execute hardware toolchain; verify preinstalled tools.');
        }
        if (exitCode === undefined) throw new Error('Hardware tool stream ended without an exit code.');
        return exitCode;
      };
      try {
        if (signal?.aborted) controller.abort();
        controller.signal.throwIfAborted();
        // No runtime package downloads: install/version toolchains in the operator-selected image.
        // CreateOS treats [] as allow-all. Use the same narrow rule verified by
        // coordinator setup, even though these offline builds require no downloads.
        sandbox = await factory.create({ shape: 's-1vcpu-1gb', egress: ['example.com:443'], signal: controller.signal });
        if (await run('mkdir', ['-p', '/tmp/bounty-hardware']) !== 0) throw new Error('Could not create hardware workspace.');
        for (const file of bundle.files) {
          const dir = file.path.includes('/') ? '/tmp/bounty-hardware/' + file.path.slice(0, file.path.lastIndexOf('/')) : '/tmp/bounty-hardware';
          if (await run('mkdir', ['-p', dir]) !== 0) throw new Error('Could not create artifact directory.');
          await sandbox.files.upload('/tmp/bounty-hardware/' + file.path, file.content, { signal: controller.signal, timeoutMs: 30_000 });
        }
        const checks: HardwareValidation['checks'] = [];
        let failed = false;
        for (const check of bundle.checks) {
          if (failed) { checks.push({ id: check.id, scope: check.scope, status: 'not-run' }); continue; }
          const code = await run('sh', ['-c', 'cd /tmp/bounty-hardware && exec ' + [check.tool, ...check.args].map(quote).join(' ')]);
          failed = code !== 0;
          checks.push({ id: check.id, scope: check.scope, status: failed ? 'failed' : 'passed', exitCode: code });
        }
        return { artifactDigest: bundle.artifactDigest, sandboxId: sandbox.id, mode, checks, logs,
          passed: !failed, physicalVerification: 'not-performed', cleanup: 'destroyed' };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        // Cleanup deliberately uses an independent timeout, not the cancelled run signal.
        if (sandbox) {
          try { await sandbox.destroy({ timeoutMs: 30_000 }); }
          catch { throw new Error(`Hardware sandbox cleanup failed; coordinator must reconcile sandbox ${sandbox.id} before another run.`); }
        }
      }
    },
  };
}
