import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Generator } from '../contracts';
import { GENERATION_SCHEMA, GENERATION_INSTRUCTIONS, generationInput, validateGeneratedApp, GenerationError, MAX_SOURCE_BYTES } from './index.js';

export interface CodexGeneratorOptions {
  env?: NodeJS.ProcessEnv;
  /** An operator-controlled executable, never taken from a brief. */
  executable?: string;
  model?: string;
  timeoutMs?: number;
  /** Trusted operator contract, never taken from user input. */
  instructions?: string;
}

/** Local signed-in Codex transport. Only source text returns; execution belongs to CreateOS. */
export function createCodexGenerator(options: CodexGeneratorOptions = {}): Generator {
  return { async generate(input) {
    input.signal?.throwIfAborted();
    if (input.stack.mode !== 'live') throw new GenerationError('Live generator requires a live candidate');
    const prompt = `${options.instructions ?? GENERATION_INSTRUCTIONS}\nDo not call any tools, inspect files, execute code, or browse. Produce the complete JSON manifest in your final answer.\nInput data:\n${generationInput(input)}`;
    const env = options.env ?? process.env;
    const childEnv: NodeJS.ProcessEnv = {};
    // Authentication is resolved by the CLI using HOME/CODEX_HOME. No key or DB secret is copied.
    for (const name of ['HOME', 'PATH', 'CODEX_HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT']) {
      if (env[name]) childEnv[name] = env[name];
    }
    const dir = await mkdtemp(join(tmpdir(), 'bounty-codex-generation-'));
    const schemaPath = join(dir, 'schema.json');
    const outputPath = join(dir, 'manifest.json');
    const combined = AbortSignal.any([...(input.signal ? [input.signal] : []), AbortSignal.timeout(options.timeoutMs ?? 240_000)]);
    try {
      await writeFile(schemaPath, JSON.stringify(GENERATION_SCHEMA), { mode: 0o600 });
      const args = ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check',
        '--sandbox', 'read-only', '--color', 'never', '--cd', dir,
        '--output-schema', schemaPath, '--output-last-message', outputPath,
        '-c', 'approval_policy="never"', '-c', 'web_search="disabled"',
        '--disable', 'shell_tool', '--disable', 'unified_exec', '--disable', 'apps', '--disable', 'plugins',
        '--disable', 'computer_use', '--disable', 'browser_use', '--disable', 'multi_agent',
        '--enable', 'skip_host_skill_discovery'];
      if (options.model ?? env.BOUNTYBOX_CODEX_MODEL) args.push('--model', (options.model ?? env.BOUNTYBOX_CODEX_MODEL)!);
      args.push('-');
      await new Promise<void>((resolve, reject) => {
        combined.throwIfAborted();
        const child = spawn(options.executable ?? env.BOUNTYBOX_CODEX_EXECUTABLE ?? 'codex', args,
          { cwd: dir, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
        let bytes = 0;
        let failure: GenerationError | undefined;
        let killTimer: ReturnType<typeof setTimeout> | undefined;
        const kill = (signal: NodeJS.Signals) => {
          try {
            if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
            else child.kill(signal);
          } catch { /* Already exited. */ }
        };
        const stop = (message: string) => {
          if (failure) return;
          failure = new GenerationError(message);
          kill('SIGTERM');
          killTimer = setTimeout(() => kill('SIGKILL'), 1000);
        };
        const abort = () => stop('Codex generation cancelled or exceeded its deadline');
        combined.addEventListener('abort', abort, { once: true });
        const consume = (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 4 * MAX_SOURCE_BYTES) stop('Codex output exceeds limit');
        };
        child.stdout.on('data', consume);
        child.stderr.on('data', consume);
        child.stdin.on('error', () => { /* Exit/error reports a sanitized failure. */ });
        child.once('error', () => { failure = new GenerationError('Could not start Codex CLI; verify it is installed and signed in'); });
        child.once('close', (code) => {
          combined.removeEventListener('abort', abort);
          if (killTimer) clearTimeout(killTimer);
          if (failure) reject(failure);
          else if (code !== 0) reject(new GenerationError(`Codex generation failed (exit ${code ?? 'signal'}); verify login and available allowance`));
          else resolve();
        });
        child.stdin.end(prompt);
        if (combined.aborted) abort();
      });
      combined.throwIfAborted();
      const outputStat = await stat(outputPath).catch(() => undefined);
      if (!outputStat?.isFile() || outputStat.size > 2 * MAX_SOURCE_BYTES) throw new GenerationError('Codex returned a missing or oversized manifest');
      let value: unknown;
      try { value = JSON.parse(await readFile(outputPath, 'utf8')); }
      catch { throw new GenerationError('Codex did not return a valid application manifest'); }
      return validateGeneratedApp(value, input.stack, (input.previous?.revision ?? 0) + 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  } };
}
