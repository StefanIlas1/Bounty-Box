import type { Brief, CandidateStack } from '../contracts.js';

// Same public read-only catalog route/version used by Stripe Projects CLI 0.50.
// It does not require a Stripe secret key and never provisions or purchases.
const SOURCE = 'https://api.stripe.com/v2/provisioning/services';
interface CatalogService {
  provider_name?: string;
  service_id?: string;
  availability?: string;
  development?: boolean;
  pricing?: { type?: string; component?: { options?: Array<{ type?: string; parent_services?: string[] }> } };
}

export async function liveCandidate(brief: Brief): Promise<CandidateStack> {
  if (!Number.isFinite(brief.monthlyBudgetUsd) || brief.monthlyBudgetUsd < 0) throw new Error('A nonnegative monthly budget is required.');
  const services: CatalogService[] = [];
  let page: string | null = `${SOURCE}?limit=100`;
  const signal = AbortSignal.timeout(25_000);
  try {
    for (let pages = 0; page && pages < 5; pages++) {
      const url = new URL(page, SOURCE);
      if (url.origin !== 'https://api.stripe.com' || url.pathname !== '/v2/provisioning/services') throw new Error();
      const response = await fetch(url, { headers: { 'Stripe-Version': 'unsafe-development', 'User-Agent': 'bounty-box-catalog/1.0' }, redirect: 'error', signal });
      if (!response.ok) throw new Error();
      const body = await response.json() as { data?: CatalogService[]; next_page_url?: string | null };
      if (!Array.isArray(body.data)) throw new Error();
      services.push(...body.data.filter(s => ['createos', 'neon'].includes(s.provider_name?.toLowerCase() ?? '')));
      const available = (provider: string, id: string) => services.find(s => s.provider_name?.toLowerCase() === provider && s.service_id === id && s.availability === 'available' && s.development !== true);
      if (available('createos', 'free') && available('createos', 'project') && available('neon', 'free') && available('neon', 'postgres')) break;
      page = body.next_page_url ?? null;
    }
  } catch { throw new Error('The live Stripe Projects catalog is unavailable. Retry before generating a build.'); }
  const freePlan = (provider: string) => services.some(s => s.provider_name?.toLowerCase() === provider && s.service_id === 'free' && s.availability === 'available' && s.development !== true && s.pricing?.type === 'free');
  const freeResource = (provider: string, id: string) => services.some(s => s.provider_name?.toLowerCase() === provider && s.service_id === id && s.availability === 'available' && s.development !== true && (s.pricing?.type === 'free' || s.pricing?.component?.options?.some(o => o.type === 'free' && o.parent_services?.includes('free'))));
  if (!freePlan('createos') || !freePlan('neon') || !freeResource('createos', 'project') || !freeResource('neon', 'postgres')) throw new Error('Stripe Projects did not confirm the supported free CreateOS and Neon services. No paid plan was selected.');
  const checkedAt = new Date();
  return {
    id: 'createos-neon', name: 'CreateOS + Neon Postgres',
    description: 'A generated web app executed in CreateOS with Neon persistence; free base plans verified against the live Stripe Projects catalog.',
    services: [{ id: 'createos/project', name: 'CreateOS project', role: 'host', monthlyCostUsd: 0 }, { id: 'neon/postgres', name: 'Neon Postgres', role: 'database', monthlyCostUsd: 0 }],
    estimatedMonthlyCostUsd: 0,
    costAssumptions: [
      `Free base-plan catalog checked ${checkedAt.toISOString()}; estimate expires ${new Date(checkedAt.getTime() + 15 * 60_000).toISOString()}.`,
      'Zero dollars refers only to listed base plans. Generation and sandbox runtime consume existing account credits and remain subject to quotas.',
      'No paid services, upgrades or overages are purchased. Additional paid use requires a concrete quote and approval.',
      'Target users are a planning input, not a verified capacity guarantee. Only recorded checks are measured performance.',
    ],
    pricingSources: [SOURCE, 'https://projects.dev/'], partner: true, mode: 'live', requiredEnvNames: ['NEON_DATABASE_URL'],
  };
}
