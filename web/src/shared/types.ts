// Shared run/event types. Mirrors docs/api-contract.md: the backend (live mode)
// and the scripted demo (demo mode) both emit exactly these events.

export type Mode = 'demo' | 'live'

export interface Brief {
  prompt: string          // "A waitlist app with email signups"
  budgetMonthly: number   // USD per month, e.g. 30
  targetUsers: number     // concurrent users the load test must survive, e.g. 1000
}

export interface Service {
  category: 'database' | 'cache' | 'hosting' | 'auth' | 'email' | 'storage' | 'queue' | 'search' | 'other'
  provider: string        // "Neon"
  serviceId: string       // Stripe Projects id, e.g. "neon/free"
  monthlyCost: number     // what the USER pays, USD. Never a partner's discounted rate.
  tier?: string           // "free", "launch"
}

export interface Stack {
  id: string              // "A", "B", "C"
  label: string           // "Postgres + edge host"
  services: Service[]
}

export interface LoadResult {
  users: number
  p95Ms: number
  errorRate: number       // 0..1
  passed: boolean
}

export interface BomItem {
  name: string            // "ESP32-S3 dev board"
  qty: number
  unitPriceUsd: number    // example price, labelled "Example prices" in the UI
  supplier: string        // "DigiKey", "Adafruit", "SparkFun"
}

export type RunEvent =
  | { type: 'run_started'; runId: string; brief: Brief; at: number }
  | { type: 'log'; level: 'info' | 'ok' | 'warn'; message: string; at: number }
  | { type: 'agent_message'; text: string; at: number }                       // narrative line from the agent
  | { type: 'sandbox'; action: 'created' | 'egress_set' | 'paused' | 'resumed' | 'destroyed'; sandboxId: string; detail?: string; at: number }
  | { type: 'stack_proposed'; stack: Stack; reason: string; at: number }
  | { type: 'file_written'; stackId: string; path: string; content: string; at: number }
  | { type: 'command'; stackId: string; cmd: string; output: string; exitCode: number; at: number }
  | { type: 'fix_attempt'; stackId: string; attempt: number; error: string; change: string; at: number }  // self-fix loop
  | { type: 'load_test'; stackId: string; result: LoadResult; at: number }
  | { type: 'decision'; requirement: string; chosen: string; alternatives: { name: string; why: string }[]; evidence: string; at: number }
  | { type: 'stack_result'; stackId: string; status: 'passed' | 'failed' | 'over_budget'; monthlyCost: number; summary: string; at: number }
  | { type: 'awaiting_approval'; stackId: string; monthlyCost: number; budgetMonthly: number; at: number }
  | { type: 'provisioning'; service: Service; command: string; status: 'started' | 'done' | 'failed'; output?: string; at: number }
  | { type: 'live'; url: string; at: number }
  | { type: 'error'; message: string; at: number }
  | { type: 'run_finished'; at: number }
  | { type: 'bom_proposed'; items: BomItem[]; oneTimeCostUsd: number; at: number }  // hardware bill of materials (optional segment)
