import { readFileSync } from 'node:fs';
import { createCatalog, type VerifiedSoftwareQuote } from '../catalog/software';
import { createSandboxRunner } from '../createos/software';
import { createCodexGenerator } from '../generation/codex';
import { createGenerator } from '../generation';
import type { Brief } from '../contracts';
import type { Store } from './store';

function quotes(): VerifiedSoftwareQuote[] {
  const path = process.env.BOUNTYBOX_PRICING_FILE;
  if (!path) throw new Error('Set BOUNTYBOX_PRICING_FILE to verified account pricing');
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(value)) throw new Error('Pricing must be an array');
  return value;
}
export async function livePreflight(brief: Brief, store: Store) {
  if (process.env.BOUNTYBOX_LIVE_ENABLED !== 'true') throw new Error('Live mode is disabled');
  if (store.unsettledSandboxes().length) throw new Error('Reconcile the previous sandbox before another live run');
  if (!process.env.CREATEOS_PROJECT_API_KEY) throw new Error('Missing CreateOS credential');
  if (!['codex', 'openai'].includes(process.env.BOUNTYBOX_GENERATOR ?? '')) throw new Error('Select a generator');
  if (process.env.BOUNTYBOX_GENERATOR === 'openai' && (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)) throw new Error('Missing model configuration');
  // A small demo is bounded independently of the generic HTTP input limits.
  if (brief.load.concurrency > 5 || brief.load.durationSeconds > 30 || brief.targetUsers > 100) throw new Error('Live demo supports at most 5 concurrent requests, 30 seconds, and 100 target users');
  await createCatalog({ quotes }).listCandidates(brief);
}
export function liveAdapters(store: Store, runId: string) {
  return {
    catalog: createCatalog({ quotes }),
    generator: process.env.BOUNTYBOX_GENERATOR === 'codex' ? createCodexGenerator() : createGenerator(),
    sandbox: createSandboxRunner({ onLifecycle: async event => { store.recordSandbox(runId, event); } }),
  };
}
