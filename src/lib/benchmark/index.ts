import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Brief, TestResult } from '../contracts';

const MAX_CONCURRENCY = 50;
const MAX_DURATION_SECONDS = 120;
const MAX_REQUESTS = 100_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 16 * 1024;
export const BENCHMARK_VERSION = 'trusted-http-v2';

export interface BenchmarkInput {
  baseUrl: string;
  token: string;
  brief: Brief;
  /** Expected digest of the exact generated artifact under test. */
  artifactDigest: string;
  signal?: AbortSignal;
  /** Test seam. Production uses Node's global fetch. */
  fetchImpl?: typeof fetch;
}

function endpoint(baseUrl: string, path: string): string {
  const base = new URL(baseUrl);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) || base.username || base.password || base.search || base.hash) {
    throw new Error('Benchmark target must be an HTTPS origin (or loopback HTTP), without credentials or query parameters');
  }
  return new URL(path, base.origin).toString();
}

function percentile95(values: number[]): number {
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  return values[Math.ceil(values.length * 0.95) - 1]!;
}

type Reply = { status: number; ok: boolean; body: string };

/** Timeout and cancellation cover both headers and the bounded response body. */
async function request(fetchImpl: typeof fetch, url: string, init: RequestInit, parent?: AbortSignal): Promise<Reply> {
  parent?.throwIfAborted();
  const controller = new AbortController();
  let rejectStop!: (reason: Error) => void;
  const stop = new Promise<never>((_, reject) => { rejectStop = reject; });
  const forwardAbort = () => {
    controller.abort(parent?.reason);
    rejectStop(new Error('Benchmark cancelled'));
  };
  parent?.addEventListener('abort', forwardAbort, { once: true });
  if (parent?.aborted) forwardAbort();
  const timeout = setTimeout(() => {
    controller.abort(new Error('Individual HTTP request timed out'));
    rejectStop(new Error('Individual HTTP request timed out'));
  }, REQUEST_TIMEOUT_MS);
  const operation = async (): Promise<Reply> => {
    const response = await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'error' });
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) throw new Error('HTTP response exceeded 16 KiB limit');
          chunks.push(value);
        }
      } catch (error) {
        void reader.cancel().catch(() => undefined);
        throw error;
      } finally {
        reader.releaseLock();
      }
    }
    const body = new TextDecoder().decode(Buffer.concat(chunks, bytes));
    return { status: response.status, ok: response.ok, body };
  };
  try {
    return await Promise.race([operation(), stop]);
  } finally {
    clearTimeout(timeout);
    parent?.removeEventListener('abort', forwardAbort);
  }
}

function parseObject(reply: Reply, label: string): Record<string, unknown> {
  if (!reply.ok) throw new Error(`${label} returned HTTP ${reply.status}`);
  try {
    const parsed: unknown = JSON.parse(reply.body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* reported without untrusted response text */ }
  throw new Error(`${label} did not return a JSON object`);
}

/** Measures a real HTTP target independently of generated app/load-test output. */
export async function benchmark({ baseUrl, token, brief, artifactDigest, signal, fetchImpl = fetch }: BenchmarkInput): Promise<TestResult> {
  if (!token || /[\r\n]/.test(token)) throw new Error('Benchmark requires a valid ingress bearer token');
  if (!/^[a-f0-9]{64}$/.test(artifactDigest)) throw new Error('Benchmark requires the expected 64-character artifact digest');
  const { concurrency, durationSeconds, maxP95Ms, maxErrorRate } = brief.load;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY ||
      !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS ||
      !Number.isFinite(maxP95Ms) || maxP95Ms <= 0 ||
      !Number.isFinite(maxErrorRate) || maxErrorRate < 0 || maxErrorRate > 1) {
    throw new Error('Benchmark load settings exceed supported limits or are invalid');
  }
  const healthUrl = endpoint(baseUrl, '/health');
  const signupsUrl = endpoint(baseUrl, '/signups');
  const statsUrl = endpoint(baseUrl, '/stats');
  const headers = { Authorization: `Bearer ${token}` };
  const get = (url: string) => request(fetchImpl, url, { method: 'GET', headers }, signal);
  const signup = (email: string) => request(fetchImpl, signupsUrl, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }, signal);
  signal?.throwIfAborted();
  const health = parseObject(await get(healthUrl), 'Target health check');
  if (health.ok !== true || health.artifactDigest !== artifactDigest) throw new Error('Target health identity or artifact digest mismatch');

  const count = async (): Promise<number> => {
    const stats = parseObject(await get(statsUrl), 'Persistence stats');
    if (!Number.isSafeInteger(stats.count) || (stats.count as number) < 0) throw new Error('Persistence stats returned an invalid count');
    return stats.count as number;
  };
  const before = await count();
  const nonce = randomUUID();
  const first = await signup(`  Probe-${nonce}@Example.Invalid  `);
  if (first.status !== 201) throw new Error('First synthetic signup was not stored as a new record');
  if (await count() !== before + 1) throw new Error('Synthetic signup did not persist exactly once');
  const duplicate = await signup(`probe-${nonce}@example.invalid`);
  if (duplicate.status !== 200) throw new Error('Normalized duplicate signup was not recognized');
  if (await count() !== before + 1) throw new Error('Normalized duplicate changed the persisted count');
  signal?.throwIfAborted();

  const began = performance.now();
  const deadline = began + durationSeconds * 1000;
  const latencies: number[] = [];
  let requests = 0;
  let errors = 0;
  let storedResponses = 0;
  let capped = false;
  const worker = async () => {
    while (performance.now() < deadline) {
      signal?.throwIfAborted();
      if (requests >= MAX_REQUESTS) { capped = true; return; }
      const index = ++requests;
      const started = performance.now();
      try {
        const response = await signup(`bench-${nonce}-${index}@example.invalid`);
        // All load emails are unique; any other status signals a functional failure.
        if (response.status === 201) storedResponses++;
        else errors++;
      } catch {
        signal?.throwIfAborted();
        errors++;
      } finally {
        latencies.push(performance.now() - started);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  signal?.throwIfAborted();
  const elapsedSeconds = (performance.now() - began) / 1000;
  const after = await count();
  if (after < before + 1 + storedResponses || (errors === 0 && after !== before + 1 + storedResponses)) {
    throw new Error('Stored signup count does not match successful benchmark responses');
  }
  const p95Ms = percentile95(latencies);
  const errorRate = requests ? errors / requests : 1;
  const completedDuration = elapsedSeconds >= durationSeconds;
  const passed = !capped && completedDuration && requests > 0 && p95Ms <= maxP95Ms && errorRate <= maxErrorRate;
  const reasons = [
    ...(capped ? ['Safety request cap reached before benchmark duration completed'] : []),
    ...(!completedDuration ? ['Benchmark did not run for the requested duration'] : []),
    ...(requests === 0 ? ['No signup requests were attempted'] : []),
    ...(p95Ms > maxP95Ms ? [`Measured p95 exceeded ${maxP95Ms} ms`] : []),
    ...(errorRate > maxErrorRate ? [`Measured error rate exceeded ${maxErrorRate}`] : []),
  ];
  return {
    mode: 'live', passed, requests,
    throughputRps: requests / elapsedSeconds,
    p95Ms, errorRate, durationSeconds: elapsedSeconds,
    logs: [`${BENCHMARK_VERSION}: health digest matched; normalized duplicate persisted once; ${storedResponses} load signups persisted; ${requests} unique signup attempts, ${errors} errors, ${elapsedSeconds.toFixed(3)}s elapsed; p95 ${p95Ms.toFixed(1)}ms.`],
    ...(passed ? {} : { failureReason: reasons.join('; ') }),
  };
}
