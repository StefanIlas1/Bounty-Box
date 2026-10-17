/** Shared boundary owned by agent-1. Request changes through the local board. */
export type RunStatus =
  | "queued" | "planning" | "generating" | "testing" | "repairing"
  | "awaiting_approval" | "provisioning" | "deployed" | "failed" | "cancelled";

export interface Brief {
  description: string;
  monthlyBudgetUsd: number;
  targetUsers: number;
  load: { concurrency: number; durationSeconds: number; maxP95Ms: number; maxErrorRate: number };
}

export interface CandidateStack {
  id: string;
  name: string;
  description: string;
  services: Array<{ id: string; name: string; role: "database" | "host" | "cache"; monthlyCostUsd: number }>;
  estimatedMonthlyCostUsd: number;
  costAssumptions: string[];
  pricingSources: string[];
  partner: boolean;
  mode: "live" | "fixture";
  requiredEnvNames: string[];
}

export interface GeneratedApp {
  files: Array<{ path: string; content: string }>;
  start: { command: string; args: string[]; port: number };
  loadTest: { command: string; args: string[] };
  requiredEnvNames: string[];
  revision: number;
}

export interface TestResult {
  passed: boolean;
  requests: number;
  throughputRps: number;
  p95Ms: number;
  errorRate: number;
  durationSeconds: number;
  logs: string[];
  failureReason?: string;
  mode: "live" | "fixture";
  previewUrl?: string;
}

export interface RunEvent {
  id: number;
  at: string;
  stage: RunStatus;
  message: string;
}

export interface Attempt {
  number: number;
  stack: CandidateStack;
  revision: number;
  result?: TestResult;
  decision?: string;
}

export interface Proposal {
  id: string;
  stack: CandidateStack;
  result: TestResult;
  estimatedMonthlyCostUsd: number;
}

export interface RunSnapshot {
  id: string;
  mode: "live" | "fixture";
  status: RunStatus;
  brief: Brief;
  candidates: CandidateStack[];
  attempts: Attempt[];
  events: RunEvent[];
  proposal?: Proposal;
  deployedUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SandboxRunner {
  /** Serial execution is enforced by the coordinator. Clean up on all exits. */
  run(input: { app: GeneratedApp; stack: CandidateStack; brief: Brief; signal?: AbortSignal }): Promise<TestResult>;
}

export interface Catalog {
  listCandidates(brief: Brief): Promise<CandidateStack[]>;
}

export interface Provisioner {
  /** Only called after approval matching the current proposal ID. */
  provision(input: { runId: string; proposal: Proposal; app: GeneratedApp; signal?: AbortSignal }): Promise<{ deployedUrl: string; serviceIds: string[] }>;
}

export interface Generator {
  generate(input: { brief: Brief; stack: CandidateStack; previous?: GeneratedApp; feedback?: TestResult; signal?: AbortSignal }): Promise<GeneratedApp>;
}

// HTTP API owned by agent-1:
// POST /api/runs { brief: Brief, mode: 'live' | 'fixture' } -> 202 RunSnapshot
// GET /api/runs/:id -> RunSnapshot
// POST /api/runs/:id/approve { proposalId: string } -> RunSnapshot
// POST /api/runs/:id/cancel -> RunSnapshot
// All errors: { error: string }. UI may poll active runs every 2 seconds.
