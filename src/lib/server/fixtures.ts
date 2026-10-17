import type { CandidateStack, Catalog, Generator, SandboxRunner } from '../contracts';

export function fixtureAdapters(): { catalog: Catalog; generator: Generator; sandbox: SandboxRunner } {
  const stack: CandidateStack = { id: 'fixture-waitlist', name: 'Simulated waitlist stack', description: 'Fixture only; no real provider performance or price claims', services: [], estimatedMonthlyCostUsd: 0,
    costAssumptions: ['Simulated cost'], pricingSources: [], partner: false, mode: 'fixture', requiredEnvNames: [] };
  return {
    catalog: { async listCandidates() { return [stack]; } },
    generator: { async generate({ previous, signal }) {
      signal?.throwIfAborted();
      const revision = (previous?.revision ?? 0) + 1;
      return { files: [{ path: 'app.js', content: `// Fixture revision ${revision}; never executed or deployed.\n` }], revision, start: { command: 'node', args: ['app.js'], port: 3000 }, loadTest: { command: 'node', args: ['diagnostic.js'] }, requiredEnvNames: [] };
    } },
    sandbox: { async run({ app, brief, signal }) {
      signal?.throwIfAborted();
      const passed = app.revision > 1;
      return { passed, mode: 'fixture', requests: 100, throughputRps: 100 / brief.load.durationSeconds, durationSeconds: brief.load.durationSeconds,
        p95Ms: passed ? brief.load.maxP95Ms / 2 : brief.load.maxP95Ms * 2, errorRate: passed ? 0 : 1,
        logs: ['SIMULATED fixture evidence; no sandbox was used.'], ...(passed ? {} : { failureReason: 'Simulated first-revision failure to exercise repair' }) };
    } },
  };
}
