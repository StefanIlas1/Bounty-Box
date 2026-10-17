// Fallback run simulator. When Stripe Projects or the CreateOS sandbox fails or runs
// out of quota, the app switches to this: it builds a full run (stack choices, code,
// a failing test, a self-fix, load tests, a swap, approval, provisioning) from the
// user's brief and FALLBACK_CATALOG prices. Every run it produces is marked
// `simulated` so the UI can label it; it never claims a real sandbox measurement.
import type { Brief, LoadResult, RunEvent, Service, Stack } from './types'
import { FALLBACK_CATALOG, toService, type CatalogOption } from './fallbackCatalog'

export const SIMULATED_RUN_PREFIX = 'sim-'

const cheapest = (opts: CatalogOption[], fits: (o: CatalogOption) => boolean) =>
  [...opts].filter(fits).sort((a, b) => a.monthlyUsd - b.monthlyUsd || b.capacityUsers - a.capacityUsers)[0]

function loadModel(users: number, db: CatalogOption, host: CatalogOption, cache?: CatalogOption): LoadResult {
  const capacity = Math.min(cache ? db.capacityUsers * 3 : db.capacityUsers, host.capacityUsers)
  const pressure = users / capacity
  const p95Ms = Math.round((db.baseP95Ms + host.baseP95Ms + (cache ? cache.baseP95Ms : 0)) * (1 + Math.pow(pressure, 3) * 6))
  const errorRate = pressure > 1 ? Math.min(0.4, (pressure - 1) * 0.12) : 0.001
  const survived = pressure > 1 ? Math.round(capacity * 0.95) : users
  return { users: survived, p95Ms, errorRate: Number(errorRate.toFixed(3)), passed: pressure <= 1 && p95Ms <= 500 && errorRate <= 0.01 }
}

const stackOf = (id: string, label: string, opts: CatalogOption[]): Stack => ({ id, label, services: opts.map(toService) })
const total = (s: Stack) => Number(s.services.reduce((n, x) => n + x.monthlyCost, 0).toFixed(2))
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24) || 'app'

const serverTs = (dbProvider: string) => `import { createServer } from 'node:http'
import { addSignup, countSignups } from './db'   // ${dbProvider}

createServer(async (req, res) => {
  if (req.url === '/health') return res.writeHead(200).end('ok')
  if (req.method === 'POST' && req.url === '/signups') {
    const { email } = JSON.parse(await body(req))
    await addSignup(email.trim().toLowerCase())
    return res.writeHead(201).end(JSON.stringify({ total: await countSignups() }))
  }
  res.writeHead(404).end()
}).listen(Number(process.env.PORT ?? 3000))
`
const dbTs = (pooled: boolean) => `import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL${pooled ? ', max: 20, idleTimeoutMillis: 10_000' : ''} })
await pool.query('CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY, at TIMESTAMPTZ DEFAULT now())')

export async function addSignup(email: string) {
  await pool.query('INSERT INTO signups (email) VALUES ($1) ON CONFLICT DO NOTHING', [email])
}
export async function countSignups() {
  ${pooled ? "const hit = await cache.get('signup_count'); if (hit) return Number(hit)\n  " : ''}const { rows } = await pool.query('SELECT count(*) FROM signups')
  ${pooled ? "await cache.set('signup_count', rows[0].count, { ex: 5 })\n  " : ''}return Number(rows[0].count)
}
`
const loadJs = (users: number) => `// load-test.js: ${users} concurrent users, 30 s, report p95 + error rate
import autocannon from 'autocannon'
const r = await autocannon({ url: process.env.APP_URL + '/signups', method: 'POST', connections: ${Math.min(users, 50)}, duration: 30,
  body: JSON.stringify({ email: 'u' + Math.random() + '@example.com' }), headers: { 'content-type': 'application/json' } })
console.log(JSON.stringify({ p95: r.latency.p97_5, errors: r.errors / r.requests.total }))
`

export function simulateRun(brief: Brief): { pre: RunEvent[]; post: RunEvent[]; runId: string } {
  const users = Math.max(50, brief.targetUsers || 1000)
  const budget = Math.max(0, brief.budgetMonthly || 30)
  const C = FALLBACK_CATALOG
  const runId = SIMULATED_RUN_PREFIX + Math.random().toString(36).slice(2, 8)
  const sbx = 'sbx_sim_' + runId.slice(4)
  const email = cheapest(C.email, (o) => o.capacityUsers >= Math.min(users * 3, 3000))!

  // A: everything on free tiers, B: big managed tiers, C: mid tier + cache.
  const aDb = cheapest(C.database, () => true)!, aHost = cheapest(C.hosting, (o) => o.layer === 'hosting' && o.tier !== 'static site')!
  const bDb = cheapest(C.database, (o) => o.capacityUsers >= users * 2)!, bHost = cheapest(C.hosting, (o) => o.capacityUsers >= users * 4 && o.tier !== 'static site')!
  const cDb = cheapest(C.database, (o) => o.capacityUsers * 3 >= users && o.monthlyUsd > 0) ?? bDb
  const cHost = cheapest(C.hosting, (o) => o.capacityUsers >= users && o.tier !== 'static site') ?? bHost
  const cCache = cheapest(C.cache, (o) => o.capacityUsers >= users) ?? C.cache[0]

  const A = stackOf('A', `${aDb.provider} + ${aHost.provider} ${aHost.tier}`, [aDb, aHost, email])
  const B = stackOf('B', `${bDb.provider} ${bDb.tier} + ${bHost.provider} ${bHost.tier}`, [bDb, bHost, email])
  const Cs = stackOf('C', `${cDb.provider} ${cDb.tier} + ${cCache.provider} + ${cHost.provider} ${cHost.tier}`, [cDb, cCache, cHost, email])

  const ra = loadModel(users, aDb, aHost)
  const rb = loadModel(users, bDb, bHost)
  const rc1 = loadModel(users * 1.4, cDb, cHost) // before the fix: no cache, no pooling
  const rc2 = loadModel(users, cDb, cHost, cCache)
  const winner = total(Cs) <= budget && rc2.passed ? Cs : total(B) <= budget ? B : Cs

  let t = 0
  const at = (ms: number) => (t += ms)
  const pre: RunEvent[] = []
  const push = (e: RunEvent) => pre.push(e)

  push({ type: 'run_started', runId, brief, at: at(0) })
  push({ type: 'log', level: 'warn', message: 'Live services unavailable: running a simulated build from catalog prices.', at: at(300) })
  push({ type: 'agent_message', text: `Planning a stack for "${brief.prompt}" that survives ${users.toLocaleString()} users under $${budget}/mo.`, at: at(900) })
  for (const [s, why] of [[A, 'Cheapest possible: all free tiers.'], [B, 'Heavyweight managed tiers as a performance baseline.'], [Cs, 'Mid-tier database plus a cache in front of hot reads.']] as const) {
    push({ type: 'stack_proposed', stack: s, reason: why, at: at(700) })
  }
  push({ type: 'sandbox', action: 'created', sandboxId: sbx, detail: 's-1vcpu-1gb · devbox:1 (simulated)', at: at(800) })
  push({ type: 'sandbox', action: 'egress_set', sandboxId: sbx, detail: 'registry.npmjs.org:443', at: at(500) })

  // Stack A
  push({ type: 'file_written', stackId: 'A', path: 'server.ts', content: serverTs(aDb.provider), at: at(700) })
  push({ type: 'file_written', stackId: 'A', path: 'db.ts', content: dbTs(false), at: at(500) })
  push({ type: 'file_written', stackId: 'A', path: 'load-test.js', content: loadJs(users), at: at(500) })
  push({ type: 'command', stackId: 'A', cmd: 'npm test', output: '✓ POST /signups stores email\n✓ duplicate email ignored\n2 passing', exitCode: 0, at: at(1200) })
  push({ type: 'command', stackId: 'A', cmd: `node load-test.js --users ${users}`, output: `p95 ${ra.p95Ms}ms · errors ${(ra.errorRate * 100).toFixed(1)}% · survived ${ra.users} users`, exitCode: ra.passed ? 0 : 1, at: at(1800) })
  push({ type: 'load_test', stackId: 'A', result: ra, at: at(200) })
  push({ type: 'stack_result', stackId: 'A', status: ra.passed ? 'passed' : 'failed', monthlyCost: total(A), summary: ra.passed ? 'Passed on free tiers' : `Falls over at ${ra.users} users`, at: at(300) })
  push({ type: 'agent_message', text: ra.passed ? 'Free tiers hold up. Checking a faster option anyway.' : `Free tiers top out around ${ra.users} users. Swapping in bigger tiers.`, at: at(600) })

  // Stack B
  push({ type: 'command', stackId: 'B', cmd: `node load-test.js --users ${users}`, output: `p95 ${rb.p95Ms}ms · errors ${(rb.errorRate * 100).toFixed(1)}%`, exitCode: 0, at: at(1800) })
  push({ type: 'load_test', stackId: 'B', result: rb, at: at(200) })
  push({ type: 'stack_result', stackId: 'B', status: total(B) > budget ? 'over_budget' : rb.passed ? 'passed' : 'failed', monthlyCost: total(B), summary: total(B) > budget ? `Fast, but $${total(B)}/mo is over budget` : 'Passed', at: at(300) })

  // Stack C with a self-fix
  push({ type: 'file_written', stackId: 'C', path: 'db.ts', content: dbTs(false), at: at(600) })
  push({ type: 'command', stackId: 'C', cmd: `node load-test.js --users ${users}`, output: `p95 ${rc1.p95Ms}ms · connection pool exhausted (too many clients)`, exitCode: 1, at: at(1800) })
  push({ type: 'fix_attempt', stackId: 'C', attempt: 1, error: `p95 ${rc1.p95Ms}ms: every request opens a connection and recounts the table`, change: 'Pool connections (max 20) and cache the signup count for 5 s', at: at(900) })
  push({ type: 'file_written', stackId: 'C', path: 'db.ts', content: dbTs(true), at: at(700) })
  push({ type: 'command', stackId: 'C', cmd: `node load-test.js --users ${users}`, output: `p95 ${rc2.p95Ms}ms · errors ${(rc2.errorRate * 100).toFixed(1)}%`, exitCode: rc2.passed ? 0 : 1, at: at(1800) })
  push({ type: 'load_test', stackId: 'C', result: rc2, at: at(200) })
  push({ type: 'stack_result', stackId: 'C', status: total(Cs) > budget ? 'over_budget' : rc2.passed ? 'passed' : 'failed', monthlyCost: total(Cs), summary: `p95 ${rc2.p95Ms}ms at $${total(Cs)}/mo`, at: at(300) })

  for (const s of winner.services) {
    const layer = s.category
    const alts = (FALLBACK_CATALOG[layer as keyof typeof FALLBACK_CATALOG] ?? []).filter((o) => o.provider !== s.provider).slice(0, 2)
    push({ type: 'decision', requirement: layer, chosen: `${s.provider} (${s.tier})`, alternatives: alts.map((a) => ({ name: `${a.provider} ${a.tier}`, why: a.monthlyUsd > s.monthlyCost ? `$${a.monthlyUsd}/mo, costs more` : `lower capacity (${a.capacityUsers} users)` })), evidence: `simulated load test, stack ${winner.id}`, at: at(250) })
  }
  push({ type: 'sandbox', action: 'paused', sandboxId: sbx, detail: 'waiting for approval', at: at(400) })
  push({ type: 'awaiting_approval', stackId: winner.id, monthlyCost: total(winner), budgetMonthly: budget, at: at(300) })

  let u = 0
  const post: RunEvent[] = [{ type: 'sandbox', action: 'resumed', sandboxId: sbx, at: (u += 300) }]
  for (const s of winner.services as Service[]) {
    const cmd = `stripe projects add ${s.serviceId}`
    post.push({ type: 'provisioning', service: s, command: cmd, status: 'started', at: (u += 500) })
    post.push({ type: 'provisioning', service: s, command: cmd, status: 'done', output: 'simulated (fallback mode)', at: (u += 900) })
  }
  post.push({ type: 'live', url: `https://${slug(brief.prompt)}-${runId.slice(4)}.sb.createos.sh`, at: (u += 900) })
  post.push({ type: 'sandbox', action: 'destroyed', sandboxId: sbx, at: (u += 300) })
  post.push({ type: 'run_finished', at: (u += 200) })
  return { pre, post, runId }
}
