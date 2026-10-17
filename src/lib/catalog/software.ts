import type { Brief, CandidateStack, Catalog } from '../contracts';

export const SOFTWARE_PROFILES = {
  'createos-neon': { database: 'neon/postgres', name: 'CreateOS + Neon Postgres', required: ['NEON_DATABASE_URL'], ready: 'BOUNTYBOX_NEON_TRIAL_READY', source: 'https://neon.com/pricing' },
  'createos-turso': { database: 'turso/database', name: 'CreateOS + Turso', required: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'], ready: 'BOUNTYBOX_TURSO_TRIAL_READY', source: 'https://turso.tech/pricing' },
} as const;
export type SoftwareStackId = keyof typeof SOFTWARE_PROFILES;
export type ProviderEnvironment = Readonly<Record<string, string | undefined>>;
export interface VerifiedSoftwareQuote {
  serviceId: 'createos/project' | 'neon/postgres' | 'turso/database';
  monthlyCostUsd: number;
  sourceUrl: string;
  verifiedAt: string;
  expiresAt: string;
  /** Operator confirmed this account's eligibility/configuration, not merely a public headline price. */
  accountEligible: true;
  assumptions: string[];
  maxTargetUsers: number;
}
export class SoftwareSetupError extends Error {
  constructor(message: string) { super(message); this.name = 'SoftwareSetupError'; }
}
export function softwareProfile(stack: Pick<CandidateStack, 'id' | 'services' | 'mode'>) {
  if (!Object.hasOwn(SOFTWARE_PROFILES, stack.id) || stack.mode !== 'live') throw new SoftwareSetupError('Unsupported live software stack.');
  const profile = SOFTWARE_PROFILES[stack.id as SoftwareStackId];
  if (stack.services.length !== 2 || !stack.services.some(s => s.id === 'createos/project' && s.role === 'host') || !stack.services.some(s => s.id === profile.database && s.role === 'database')) throw new SoftwareSetupError('Software stack services do not match the selected trial profile.');
  return profile;
}
/** Internal-only: values must never be put in snapshots, errors or logs. */
export function resolveSoftwareTrial(id: SoftwareStackId, env: ProviderEnvironment): { secrets: Record<string, string>; egress: string[] } {
  const profile = SOFTWARE_PROFILES[id];
  if (!profile) throw new SoftwareSetupError('Unsupported trial database profile.');
  if (env[profile.ready] !== 'true') throw new SoftwareSetupError(`Missing isolated, scoped operator trial confirmation: ${profile.ready}=true.`);
  const secrets: Record<string, string> = {};
  for (const name of profile.required) {
    const value = env[name];
    if (!value?.trim() || value.length > 16384 || value.includes('\0')) throw new SoftwareSetupError(`Missing or invalid scoped trial credential: ${name}.`);
    secrets[name] = value;
  }
  let url: URL;
  try { url = new URL(secrets[profile.required[0]]); } catch { throw new SoftwareSetupError('Invalid trial database URL; credential values are withheld.'); }
  const neon = id === 'createos-neon';
  const domain = neon ? '.neon.tech' : '.turso.io';
  if (!url.hostname.endsWith(domain) || !/^[a-z0-9.-]+$/.test(url.hostname) || (neon ? !['postgres:', 'postgresql:'].includes(url.protocol) : !['libsql:', 'https:'].includes(url.protocol))) throw new SoftwareSetupError('Trial URL must identify the selected hosted database provider.');
  if (neon && (!url.username || !url.password || url.pathname.length < 2)) throw new SoftwareSetupError('Neon trial requires a scoped database connection URL.');
  if (!neon && (url.username || url.password || url.port || url.search || url.hash)) throw new SoftwareSetupError('Turso trial URL must use the hosted HTTPS endpoint without embedded credentials.');
  // Neon serverless HTTP driver and @libsql/client/http use HTTPS, not raw PG TCP.
  return { secrets, egress: [`${url.hostname}:443`] };
}

export interface SoftwareCatalogOptions {
  /** Fresh operator-verified account quotes; no environment JSON or inferred zero prices. */
  quotes?: () => Promise<readonly VerifiedSoftwareQuote[]> | readonly VerifiedSoftwareQuote[];
  environment?: () => ProviderEnvironment;
  now?: () => number;
}
export function createCatalog(options: SoftwareCatalogOptions = {}): Catalog {
  if (typeof window !== 'undefined') throw new SoftwareSetupError('Software catalog is server-only.');
  return { async listCandidates(brief: Brief) {
    if (!Number.isFinite(brief.monthlyBudgetUsd) || brief.monthlyBudgetUsd < 0 || !Number.isSafeInteger(brief.targetUsers) || brief.targetUsers < 1) throw new SoftwareSetupError('Invalid software budget or target usage.');
    if (!options.quotes) throw new SoftwareSetupError('Missing verified CreateOS hosting and trial database price quotes. Supply createCatalog({quotes}); provisioned sandbox credits do not establish deployment pricing.');
    let quotes: readonly VerifiedSoftwareQuote[];
    try { quotes = await options.quotes(); }
    catch { throw new SoftwareSetupError('Verified pricing provider is unavailable; raw details withheld.'); }
    const env = (options.environment ?? (() => process.env))();
    const now = (options.now ?? Date.now)();
    const candidates: CandidateStack[] = [];
    const missing: string[] = [];
    for (const id of Object.keys(SOFTWARE_PROFILES) as SoftwareStackId[]) {
      const profile = SOFTWARE_PROFILES[id];
      try {
        resolveSoftwareTrial(id, env);
        const selected = ['createos/project', profile.database].map(serviceId => {
          const q = quotes.filter(q => q.serviceId === serviceId).sort((a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt))[0];
          let source: URL | undefined;
          try { source = q && new URL(q.sourceUrl); } catch { /* reject below */ }
          const sourceHosts = serviceId === 'createos/project' ? ['createos.sh', 'projects.dev', 'docs.stripe.com'] : serviceId === 'neon/postgres' ? ['neon.com', 'projects.dev', 'docs.stripe.com'] : ['turso.tech', 'projects.dev', 'docs.stripe.com'];
          if (!q || !q.accountEligible || !Number.isFinite(q.monthlyCostUsd) || q.monthlyCostUsd < 0 || !Number.isFinite(now)
            || !Number.isFinite(Date.parse(q.verifiedAt)) || Date.parse(q.verifiedAt) > now || !(Date.parse(q.expiresAt) > now)
            || !source || source.protocol !== 'https:' || source.username || source.password || source.search || source.hash || !sourceHosts.includes(source.hostname)
            || !q.assumptions.length || q.assumptions.some(a => !a.trim() || a.length > 500)
            || !Number.isSafeInteger(q.maxTargetUsers) || q.maxTargetUsers < brief.targetUsers) throw new SoftwareSetupError(`Missing valid account-eligible usage quote: ${serviceId}.`);
          // Quotes are trusted operator configuration, but reject exact credential leaks before publication.
          const publicText = JSON.stringify(q);
          if (Object.values(env).some(value => value && value.length >= 8 && publicText.includes(value))) throw new SoftwareSetupError('Quote contains private configuration; remove it before publishing.');
          return q;
        });
        const total = selected.reduce((sum, q) => sum + q.monthlyCostUsd, 0);
        if (total > brief.monthlyBudgetUsd) { missing.push(`${id}: verified cost exceeds monthly budget.`); continue; }
        candidates.push({ id, name: profile.name, description: 'Waitlist application with operator-owned isolated trial database; production deployment is separate.',
          services: selected.map(q => ({ id: q.serviceId, name: q.serviceId, role: q.serviceId === 'createos/project' ? 'host' : 'database', monthlyCostUsd: q.monthlyCostUsd })),
          estimatedMonthlyCostUsd: total, costAssumptions: selected.flatMap(q => [...q.assumptions, `Quote verified ${q.verifiedAt}; expires ${q.expiresAt}.`]),
          pricingSources: [...new Set(['https://projects.dev/llms.txt', profile.source, ...selected.map(q => q.sourceUrl)])],
          partner: false, mode: 'live', requiredEnvNames: [...profile.required] });
      } catch (error) {
        if (!(error instanceof SoftwareSetupError)) throw new SoftwareSetupError('Invalid software catalog configuration.');
        missing.push(`${id}: ${error.message}`);
      }
    }
    if (!candidates.length) throw new SoftwareSetupError(`No eligible software candidate. ${missing.join(' ')}`);
    return candidates;
  } };
}
