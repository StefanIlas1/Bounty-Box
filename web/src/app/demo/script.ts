// Scripted demo run. Fixed example content per CLAUDE.md / task spec, regardless of what the
// user typed on the Brief screen (the UI shows "Demo · scripted example run" for this reason).
// Two arrays: events up to the approval gate, and events after the user clicks Approve.
import type { BomItem, RunEvent, Service } from '../../shared/types'

export const DEMO_BRIEF = {
  prompt: 'A waitlist app with email signups that survives 1,000 concurrent users',
  budgetMonthly: 30,
  targetUsers: 1000,
}

export const DEMO_RUN_ID = 'demo-run'
const SANDBOX_ID = 'sbx_7f3a9c2d'

const svcNeon: Service = { category: 'database', provider: 'Neon', serviceId: 'neon/free', monthlyCost: 0, tier: 'free' }
const svcUpstash: Service = { category: 'cache', provider: 'Upstash', serviceId: 'upstash/redis', monthlyCost: 17.4, tier: 'pay-as-you-go' }
const svcCreateosBeginner: Service = { category: 'hosting', provider: 'CreateOS', serviceId: 'createos/beginner-monthly', monthlyCost: 10, tier: 'beginner' }
const svcResend: Service = { category: 'email', provider: 'Resend', serviceId: 'resend/free', monthlyCost: 0, tier: 'free' }

const SERVER_TS_A = `import { createServer } from 'node:http'
import { addSignup, countSignups } from './db'

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/signup') {
    const email = await readBody(req)
    await addSignup(email)
    res.writeHead(200).end(JSON.stringify({ ok: true, total: await countSignups() }))
    return
  }
  res.writeHead(404).end()
}).listen(3000)
`

const DB_TS_A_V1 = `import Database from 'better-sqlite3'
const db = new Database('waitlist.db')
db.exec('CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY)')

export async function addSignup(email: string) {
  db.prepare('INSERT OR IGNORE INTO signups (email) VALUES (?)').run(email)
}
export async function countSignups() {
  return db.prepare('SELECT COUNT(*) AS n FROM signups').get().n
}
`

const DB_TS_A_V2 = `import Database from 'better-sqlite3'
const db = new Database('waitlist.db')
db.pragma('journal_mode = WAL')          // fix: allow concurrent readers during writes
db.exec('CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY)')

async function withRetry<T>(fn: () => T, tries = 5): Promise<T> {
  for (let i = 0; i < tries; i++) {
    try { return fn() } catch (e: any) {
      if (e.code !== 'SQLITE_BUSY' || i === tries - 1) throw e
      await new Promise((r) => setTimeout(r, 10 * (i + 1)))   // fix: backoff + retry
    }
  }
  throw new Error('unreachable')
}

export async function addSignup(email: string) {
  await withRetry(() => db.prepare('INSERT OR IGNORE INTO signups (email) VALUES (?)').run(email))
}
export async function countSignups() {
  return db.prepare('SELECT COUNT(*) AS n FROM signups').get().n
}
`

const LOAD_TEST_JS = `import http from 'node:http'
const USERS = Number(process.argv[3] ?? 1000)
let ok = 0, failed = 0
const latencies: number[] = []

async function fire(i: number) {
  const start = Date.now()
  await post('/signup', { email: \`user\${i}@example.com\` })
  latencies.push(Date.now() - start)
}

await Promise.all(Array.from({ length: USERS }, (_, i) => fire(i).then(() => ok++).catch(() => failed++)))
latencies.sort((a, b) => a - b)
console.log({ ok, failed, p95: latencies[Math.floor(latencies.length * 0.95)] })
`

const PKG_A = `{
  "name": "waitlist-stack-a",
  "dependencies": { "better-sqlite3": "^11.0.0" }
}
`

const SERVER_TS_B = `import { createServer } from 'node:http'
import { addSignup, countSignups } from './db'

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/signup') {
    const email = await readBody(req)
    await addSignup(email)
    res.writeHead(200).end(JSON.stringify({ ok: true, total: await countSignups() }))
    return
  }
  res.writeHead(404).end()
}).listen(3000)
`

const DB_TS_B = `import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 })
await pool.query('CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY)')

export async function addSignup(email: string) {
  await pool.query('INSERT INTO signups (email) VALUES ($1) ON CONFLICT DO NOTHING', [email])
}
export async function countSignups() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM signups')
  return rows[0].n
}
`

const PKG_B = `{
  "name": "waitlist-stack-b",
  "dependencies": { "pg": "^8.11.0" }
}
`

const SERVER_TS_C = `import { createServer } from 'node:http'
import { addSignup, countSignups } from './db'
import { sendConfirmation } from './email'

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/signup') {
    const email = await readBody(req)
    await addSignup(email)
    await sendConfirmation(email)
    res.writeHead(200).end(JSON.stringify({ ok: true, total: await countSignups() }))
    return
  }
  res.writeHead(404).end()
}).listen(3000)
`

const DB_TS_C_V1 = `import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
await pool.query('CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY)')

export async function addSignup(email: string) {
  await pool.query('INSERT INTO signups (email) VALUES ($1) ON CONFLICT DO NOTHING', [email])
}
export async function countSignups() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM signups')
  return rows[0].n
}
`

const DB_TS_C_V2 = `import { Pool } from 'pg'
// fix: pool connections instead of opening one per request
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
await pool.query('CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY)')

export async function addSignup(email: string) {
  await pool.query('INSERT INTO signups (email) VALUES ($1) ON CONFLICT DO NOTHING', [email])
}
export async function countSignupsUncached() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM signups')
  return rows[0].n
}
`

const CACHE_TS_V1 = `// no cache yet: every request recomputes the count from Postgres
import { countSignupsUncached } from './db'
export async function countSignups() {
  return countSignupsUncached()
}
`

const CACHE_TS_V2 = `import { Redis } from '@upstash/redis'
import { countSignupsUncached } from './db'
const redis = Redis.fromEnv()
const KEY = 'signup_count'

// fix: read-through cache, 5s TTL, invalidated on write
export async function countSignups() {
  const cached = await redis.get<number>(KEY)
  if (cached != null) return cached
  const n = await countSignupsUncached()
  await redis.set(KEY, n, { ex: 5 })
  return n
}
export async function bumpSignupCount() {
  await redis.incr(KEY)
}
`

const EMAIL_TS = `import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendConfirmation(email: string) {
  await resend.emails.send({
    from: 'waitlist@example.com',
    to: email,
    subject: "You're on the list",
    text: "We'll email you when we launch.",
  })
}
`

const PKG_C = `{
  "name": "waitlist-stack-c",
  "dependencies": { "pg": "^8.11.0", "@upstash/redis": "^1.31.0", "resend": "^3.4.0" }
}
`

let seq = 0
function at(ms: number): number {
  return ms
}

function hardwareSegment(startAt: number, deviceNeeds: string, item: BomItem): RunEvent[] {
  const oneTimeCostUsd = Math.round(item.qty * item.unitPriceUsd * 100) / 100
  return [
    { type: 'agent_message', text: `Reviewing hardware for ${deviceNeeds}. Adding ${item.qty} × ${item.name} from the demo catalog.`, at: startAt + 700 },
    { type: 'decision', requirement: 'hardware', chosen: item.name, alternatives: [], evidence: `Selected from the demo catalog: ${item.qty} × $${item.unitPriceUsd.toFixed(2)} = $${oneTimeCostUsd.toFixed(2)} one-time.`, at: startAt + 2300 },
    { type: 'file_written', stackId: 'C', path: 'hardware/bill-of-materials.json', content: JSON.stringify({ items: [item], oneTimeCostUsd }, null, 2), at: startAt + 3700 },
    { type: 'command', stackId: 'C', cmd: 'demo validate-hardware-plan', output: `Demo hardware plan validated: ${item.qty} × ${item.name}. No physical device or firmware was tested.`, exitCode: 0, at: startAt + 5500 },
    { type: 'agent_message', text: `Added ${item.name}: $${oneTimeCostUsd.toFixed(2)} one-time. Monthly services stay $27.40/month. First month total: $${(27.4 + oneTimeCostUsd).toFixed(2)} (example USD prices, excluding shipping and tax).`, at: startAt + 7000 },
    { type: 'bom_proposed', items: [item], oneTimeCostUsd, at: startAt + 7300 },
  ]
}

const PRE_APPROVAL_CORE: RunEvent[] = [
  { type: 'run_started', runId: DEMO_RUN_ID, brief: DEMO_BRIEF, at: at(0) },
  { type: 'agent_message', text: 'Reading the brief: a waitlist app with email signups that needs to survive 1,000 concurrent users, budget $30/mo.', at: at(800) },
  { type: 'log', level: 'info', message: 'Checking the Stripe Projects catalog for matching database, cache, hosting and email services...', at: at(1800) },

  // ---- Stack A: SQLite on CreateOS free host ----
  { type: 'stack_proposed', stack: { id: 'A', label: 'SQLite on CreateOS free host', services: [{ category: 'database', provider: 'SQLite', serviceId: 'createos/free', monthlyCost: 0, tier: 'free' }] }, reason: 'Cheapest possible option: SQLite needs no managed database and runs directly on the CreateOS free host.', at: at(3200) },
  { type: 'sandbox', action: 'created', sandboxId: SANDBOX_ID, detail: 'shape s-1vcpu-1gb, rootfs devbox:1', at: at(3400) },
  { type: 'sandbox', action: 'egress_set', sandboxId: SANDBOX_ID, detail: 'registry.npmjs.org:443', at: at(4200) },
  { type: 'agent_message', text: 'Writing server.ts, db.ts, the load test and package.json for Stack A...', at: at(5000) },
  { type: 'file_written', stackId: 'A', path: 'server.ts', content: SERVER_TS_A, at: at(5600) },
  { type: 'file_written', stackId: 'A', path: 'db.ts', content: DB_TS_A_V1, at: at(6400) },
  { type: 'file_written', stackId: 'A', path: 'load-test.js', content: LOAD_TEST_JS, at: at(7200) },
  { type: 'file_written', stackId: 'A', path: 'package.json', content: PKG_A, at: at(7800) },
  { type: 'command', stackId: 'A', cmd: 'npm install', output: 'added 4 packages in 1.8s', exitCode: 0, at: at(8600) },
  { type: 'command', stackId: 'A', cmd: 'npm test', output: 'FAIL  test/signup.test.ts\n  ✕ handles 50 concurrent signups\n  SQLITE_BUSY: database is locked', exitCode: 1, at: at(10200) },
  { type: 'log', level: 'warn', message: 'Test failed: concurrent writes are hitting SQLITE_BUSY.', at: at(10400) },
  { type: 'fix_attempt', stackId: 'A', attempt: 1, error: 'SQLITE_BUSY: database is locked', change: 'Enable WAL journal mode and add retry-with-backoff around writes in db.ts.', at: at(11000) },
  { type: 'file_written', stackId: 'A', path: 'db.ts', content: DB_TS_A_V2, at: at(12600) },
  { type: 'command', stackId: 'A', cmd: 'npm test', output: 'PASS  test/signup.test.ts\n  ✓ handles 50 concurrent signups', exitCode: 0, at: at(13400) },
  { type: 'agent_message', text: 'Tests pass. Running the load test: 1,000 concurrent signups against Stack A...', at: at(14200) },
  { type: 'command', stackId: 'A', cmd: 'node load-test.js --users 1000', output: 'ramping up to 1000 concurrent...', exitCode: 0, at: at(15200) },
  { type: 'load_test', stackId: 'A', result: { users: 1000, p95Ms: 2100, errorRate: 0.06, passed: false }, at: at(17200) },
  { type: 'agent_message', text: 'Stack A collapses under load before reaching 1,000 users: p95 2100ms, 6% errors, failing past ~800 concurrent.', at: at(17600) },
  { type: 'stack_result', stackId: 'A', status: 'failed', monthlyCost: 0, summary: "SQLite can't handle 1,000 concurrent writers even with WAL enabled. Fails at ~800 concurrent users.", at: at(18000) },

  // ---- Stack B: Render Postgres + Render web service ----
  { type: 'stack_proposed', stack: { id: 'B', label: 'Render Postgres + Render web service', services: [
      { category: 'database', provider: 'Render', serviceId: 'render/postgres', monthlyCost: 22, tier: 'starter' },
      { category: 'hosting', provider: 'Render', serviceId: 'render/web-service', monthlyCost: 26, tier: 'starter' },
    ] }, reason: 'Try a managed Postgres + web service pair built for concurrent writes.', at: at(18600) },
  { type: 'agent_message', text: 'Writing server.ts and db.ts for Stack B against Render Postgres...', at: at(19400) },
  { type: 'file_written', stackId: 'B', path: 'server.ts', content: SERVER_TS_B, at: at(20200) },
  { type: 'file_written', stackId: 'B', path: 'db.ts', content: DB_TS_B, at: at(20800) },
  { type: 'file_written', stackId: 'B', path: 'package.json', content: PKG_B, at: at(21400) },
  { type: 'command', stackId: 'B', cmd: 'npm install', output: 'added 6 packages in 2.1s', exitCode: 0, at: at(22200) },
  { type: 'command', stackId: 'B', cmd: 'npm test', output: 'PASS  test/signup.test.ts\n  ✓ handles 50 concurrent signups', exitCode: 0, at: at(23400) },
  { type: 'agent_message', text: 'Tests pass. Running the 1,000-user load test on Stack B...', at: at(24200) },
  { type: 'command', stackId: 'B', cmd: 'node load-test.js --users 1000', output: 'ramping up to 1000 concurrent...', exitCode: 0, at: at(25200) },
  { type: 'load_test', stackId: 'B', result: { users: 1000, p95Ms: 90, errorRate: 0.001, passed: true }, at: at(27000) },
  { type: 'agent_message', text: 'Stack B survives 1,000 users easily (p95 90ms), but Render Postgres + the web service together run $48/mo — over the $30/mo budget.', at: at(27400) },
  { type: 'stack_result', stackId: 'B', status: 'over_budget', monthlyCost: 48, summary: 'Passes the load test (p95 90ms, 0.1% errors) but $48/mo exceeds the $30/mo budget.', at: at(27800) },

  // ---- Stack C: Neon + Upstash + CreateOS beginner host + Resend ----
  { type: 'stack_proposed', stack: { id: 'C', label: 'Neon Postgres + Upstash Redis + CreateOS beginner host + Resend', services: [svcNeon, svcUpstash, svcCreateosBeginner, svcResend] }, reason: "Swap in Neon's free Postgres tier and a low-cost CreateOS host, with Upstash for caching — should land under budget.", at: at(28400) },
  { type: 'sandbox', action: 'egress_set', sandboxId: SANDBOX_ID, detail: '*.neon.tech:443, *.upstash.io:443, api.resend.com:443', at: at(29200) },
  { type: 'agent_message', text: 'Writing server.ts, db.ts, cache.ts, email.ts and package.json for Stack C...', at: at(30000) },
  { type: 'file_written', stackId: 'C', path: 'server.ts', content: SERVER_TS_C, at: at(30800) },
  { type: 'file_written', stackId: 'C', path: 'db.ts', content: DB_TS_C_V1, at: at(31400) },
  { type: 'file_written', stackId: 'C', path: 'cache.ts', content: CACHE_TS_V1, at: at(32000) },
  { type: 'file_written', stackId: 'C', path: 'email.ts', content: EMAIL_TS, at: at(32600) },
  { type: 'file_written', stackId: 'C', path: 'package.json', content: PKG_C, at: at(33200) },
  { type: 'command', stackId: 'C', cmd: 'npm install', output: 'added 11 packages in 2.6s', exitCode: 0, at: at(34000) },
  { type: 'command', stackId: 'C', cmd: 'npm test', output: 'PASS  test/signup.test.ts\n  ✓ handles 50 concurrent signups', exitCode: 0, at: at(35200) },
  { type: 'agent_message', text: 'Tests pass. Running the first 1,000-user load test on Stack C (no cache yet)...', at: at(36000) },
  { type: 'command', stackId: 'C', cmd: 'node load-test.js --users 1000', output: 'ramping up to 1000 concurrent...', exitCode: 0, at: at(37000) },
  { type: 'load_test', stackId: 'C', result: { users: 1000, p95Ms: 1400, errorRate: 0.02, passed: false }, at: at(38800) },
  { type: 'log', level: 'warn', message: 'p95 1400ms is too slow: every request recomputes the signup count straight from Postgres.', at: at(39200) },
  { type: 'fix_attempt', stackId: 'C', attempt: 1, error: 'p95 1400ms under load: signup-count reads hit Postgres on every request, with a fresh connection each time.', change: 'Add an Upstash Redis read-through cache for the signup counter in cache.ts, and switch db.ts to pooled connections (max 10).', at: at(39600) },
  { type: 'file_written', stackId: 'C', path: 'cache.ts', content: CACHE_TS_V2, at: at(41200) },
  { type: 'file_written', stackId: 'C', path: 'db.ts', content: DB_TS_C_V2, at: at(41800) },
  { type: 'command', stackId: 'C', cmd: 'npm test', output: 'PASS  test/signup.test.ts\n  ✓ handles 50 concurrent signups', exitCode: 0, at: at(42600) },
  { type: 'agent_message', text: 'Re-running the 1,000-user load test on Stack C with the cache in place...', at: at(43400) },
  { type: 'command', stackId: 'C', cmd: 'node load-test.js --users 1000', output: 'ramping up to 1000 concurrent...', exitCode: 0, at: at(44400) },
  { type: 'load_test', stackId: 'C', result: { users: 1000, p95Ms: 140, errorRate: 0.001, passed: true }, at: at(46200) },
  { type: 'agent_message', text: 'Stack C passes: p95 140ms, 0.1% errors at 1,000 concurrent users, for $27.40/mo — under budget.', at: at(46600) },
  { type: 'stack_result', stackId: 'C', status: 'passed', monthlyCost: 27.4, summary: 'Neon Postgres + Upstash cache + CreateOS beginner host + Resend. Passes the load test at $27.40/mo.', at: at(47000) },

  // ---- Decisions ----
  { type: 'decision', requirement: 'database', chosen: 'Neon Postgres (neon/free)', alternatives: [
      { name: 'SQLite on CreateOS free host', why: 'Free, but fails under concurrent writes even with WAL — maxes out around 800 concurrent users.' },
      { name: 'Render Postgres', why: 'Passes the load test, but the managed instance alone pushes the stack to $48/mo.' },
    ], evidence: 'load test runs A2, B1, C2', at: at(47600) },
  { type: 'decision', requirement: 'cache', chosen: 'Upstash Redis (upstash/redis)', alternatives: [
      { name: 'No cache (direct Postgres reads)', why: 'p95 1400ms — every signup-count read hit Postgres cold.' },
    ], evidence: 'load test run C1 vs C2', at: at(48200) },
  { type: 'decision', requirement: 'hosting', chosen: 'CreateOS beginner host (createos/beginner-monthly)', alternatives: [
      { name: 'CreateOS free host', why: 'Fine for SQLite, but too limited once Stack A failed its load test.' },
      { name: 'Render web service', why: 'Reliable, but part of the $48/mo Stack B total.' },
    ], evidence: 'sandbox runs across Stack A/B/C', at: at(48800) },
  { type: 'decision', requirement: 'email', chosen: 'Resend (resend/free)', alternatives: [
      { name: 'No alternative tested', why: 'Free tier comfortably covers signup-confirmation volume for this brief; never the bottleneck in any load test.' },
    ], evidence: 'catalog price check', at: at(49400) },
]

const CORE_END_AT = 49400

/** Builds the full pre-approval timeline, optionally splicing in a ~10-15s hardware
 * segment (device decision, firmware, compile check, bill of materials) right after
 * the software decisions and before the sandbox pauses for approval. */
export function buildPreApprovalEvents(hardwareOn: boolean, deviceNeeds?: string, hardwareItem: BomItem = { name: 'STM32 NUCLEO-F446RE', qty: 1, unitPriceUsd: 28.19, supplier: 'Demo catalog' }): RunEvent[] {
  const events = [...PRE_APPROVAL_CORE]
  let tailStart = CORE_END_AT
  if (hardwareOn) {
    const hw = hardwareSegment(tailStart, deviceNeeds?.trim() || 'a device that posts signups from a kiosk', hardwareItem)
    events.push(...hw)
    tailStart = hw[hw.length - 1].at
  }
  const pausingAt = tailStart + 600
  const pausedAt = pausingAt + 400
  const approvalAt = pausedAt + 200
  events.push(
    { type: 'agent_message', text: 'Pausing the sandbox and waiting for your approval before buying anything.', at: pausingAt },
    { type: 'sandbox', action: 'paused', sandboxId: SANDBOX_ID, at: pausedAt },
    { type: 'awaiting_approval', stackId: 'C', monthlyCost: 27.4, budgetMonthly: 30, at: approvalAt },
  )
  return events
}

/** Software-only timeline, kept for anything that doesn't care about the hardware toggle. */
export const demoEventsPreApproval: RunEvent[] = buildPreApprovalEvents(false)

export const demoEventsPostApproval: RunEvent[] = [
  { type: 'sandbox', action: 'resumed', sandboxId: SANDBOX_ID, at: at(400) },
  { type: 'agent_message', text: 'Approved. Provisioning Stack C through Stripe Projects...', at: at(1000) },
  { type: 'provisioning', service: svcNeon, command: 'stripe projects add neon/free', status: 'started', at: at(1600) },
  { type: 'provisioning', service: svcNeon, command: 'stripe projects add neon/free', status: 'done', output: 'neon/free provisioned', at: at(2400) },
  { type: 'provisioning', service: svcUpstash, command: 'stripe projects add upstash/redis', status: 'started', at: at(3000) },
  { type: 'provisioning', service: svcUpstash, command: 'stripe projects add upstash/redis', status: 'done', output: 'upstash/redis provisioned', at: at(3800) },
  { type: 'provisioning', service: svcCreateosBeginner, command: 'stripe projects add createos/beginner-monthly', status: 'started', at: at(4400) },
  { type: 'provisioning', service: svcCreateosBeginner, command: 'stripe projects add createos/beginner-monthly', status: 'done', output: 'createos/beginner-monthly provisioned', at: at(5200) },
  { type: 'provisioning', service: svcResend, command: 'stripe projects add resend/free', status: 'started', at: at(5800) },
  { type: 'provisioning', service: svcResend, command: 'stripe projects add resend/free', status: 'done', output: 'resend/free provisioned', at: at(6600) },
  { type: 'agent_message', text: 'All services provisioned. Deploying Stack C and opening ingress on the CreateOS sandbox...', at: at(7200) },
  { type: 'log', level: 'ok', message: 'Ingress enabled on sandbox ' + SANDBOX_ID, at: at(8400) },
  { type: 'live', url: 'https://waitlist-7f3a.sb.createos.sh', at: at(9200) },
  { type: 'agent_message', text: "Live. The waitlist app is running at https://waitlist-7f3a.sb.createos.sh.", at: at(9600) },
  { type: 'run_finished', at: at(10000) },
]

export function totalDemoDurationMs(): number {
  const pre = demoEventsPreApproval[demoEventsPreApproval.length - 1].at
  const post = demoEventsPostApproval[demoEventsPostApproval.length - 1].at
  return pre + post
}
