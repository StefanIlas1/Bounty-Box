export type BackendRunStatus =
  | 'queued' | 'planning' | 'generating' | 'testing' | 'repairing'
  | 'awaiting_approval' | 'provisioning' | 'deployed' | 'failed' | 'cancelled'

export interface BackendBrief {
  description: string
  monthlyBudgetUsd: number
  targetUsers: number
  load: { concurrency: number; durationSeconds: number; maxP95Ms: number; maxErrorRate: number }
}

export interface BackendCandidateStack {
  id: string
  name: string
  description: string
  services: Array<{ id: string; name: string; role: 'database' | 'host' | 'cache'; monthlyCostUsd: number }>
  estimatedMonthlyCostUsd: number
  costAssumptions: string[]
  pricingSources: string[]
  partner: boolean
  mode: 'live' | 'fixture'
  requiredEnvNames: string[]
}

export interface BackendGeneratedApp {
  files: Array<{ path: string; content: string }>
  start: { command: string; args: string[]; port: number }
  loadTest: { command: string; args: string[] }
  requiredEnvNames: string[]
  revision: number
}

export interface BackendTestResult {
  passed: boolean
  requests: number
  throughputRps: number
  p95Ms: number
  errorRate: number
  durationSeconds: number
  logs: string[]
  failureReason?: string
  mode: 'live' | 'fixture'
  previewUrl?: string
}

export interface BackendRunEvent {
  kind?: 'command'
  command?: string
  output?: string
  exitCode?: number
  stackId?: string
  id: number
  at: string
  stage: BackendRunStatus
  message: string
}

export interface BackendAttempt {
  number: number
  stack: BackendCandidateStack
  revision: number
  result?: BackendTestResult
  decision?: string
}

export interface BackendProposal {
  id: string
  stack: BackendCandidateStack
  result: BackendTestResult
  estimatedMonthlyCostUsd: number
}

export interface RunSnapshot {
  id: string
  mode: 'live' | 'fixture'
  status: BackendRunStatus
  brief: BackendBrief
  candidates: BackendCandidateStack[]
  attempts: BackendAttempt[]
  events: BackendRunEvent[]
  proposal?: BackendProposal
  deployedUrl?: string
  error?: string
  createdAt: string
  updatedAt: string
}

