// Single reducer that both Demo and Live modes feed with the same RunEvent stream.
import type { Brief, BomItem, RunEvent, Service, Stack, LoadResult } from '../../shared/types'

export type Phase =
  | 'idle'
  | 'planning'
  | 'writing'
  | 'testing'
  | 'fixing'
  | 'awaiting_approval'
  | 'buying'
  | 'live'
  | 'finished'
  | 'error'

export interface FileEntry {
  path: string
  content: string
  at: number
}

export interface CommandEntry {
  cmd: string
  output: string
  exitCode: number
  at: number
}

export interface FixEntry {
  attempt: number
  error: string
  change: string
  at: number
  resolved: boolean
}

export interface StackState {
  stack: Stack
  reason: string
  files: FileEntry[]
  commands: CommandEntry[]
  fixAttempts: FixEntry[]
  loadResults: LoadResult[]
  status?: 'passed' | 'failed' | 'over_budget'
  monthlyCost?: number
  summary?: string
}

export interface TranscriptEntry {
  id: string
  at: number
  kind: 'agent_message' | 'log' | 'fix_attempt'
  text?: string
  level?: 'info' | 'ok' | 'warn'
  fix?: { stackId: string; attempt: number; error: string; change: string; resolved: boolean }
}

export interface DecisionEntry {
  requirement: string
  chosen: string
  alternatives: { name: string; why: string }[]
  evidence: string
  at: number
}

export interface ProvisioningEntry {
  service: Service
  command: string
  status: 'started' | 'done' | 'failed'
  output?: string
}

export interface SandboxState {
  id: string
  shape?: string
  rootfs?: string
  state: 'created' | 'paused' | 'resumed' | 'destroyed'
  egress: string[]
}

export interface RunState {
  runId: string | null
  brief: Brief | null
  phase: Phase
  sandbox: SandboxState | null
  stackOrder: string[]
  stacks: Record<string, StackState>
  currentStackId: string | null
  transcript: TranscriptEntry[]
  decisions: DecisionEntry[]
  awaitingApproval: { stackId: string; monthlyCost: number; budgetMonthly: number } | null
  provisioning: ProvisioningEntry[]
  liveUrl: string | null
  error: string | null
  finished: boolean
  lastEvent: RunEvent | null
  bom: BomItem[] | null
  bomOneTimeCostUsd: number
}

export const initialRunState: RunState = {
  runId: null,
  brief: null,
  phase: 'idle',
  sandbox: null,
  stackOrder: [],
  stacks: {},
  currentStackId: null,
  transcript: [],
  decisions: [],
  awaitingApproval: null,
  provisioning: [],
  liveUrl: null,
  error: null,
  finished: false,
  lastEvent: null,
  bom: null,
  bomOneTimeCostUsd: 0,
}

let transcriptSeq = 0

function isTestLikeCommand(cmd: string): boolean {
  return /test|load-test/i.test(cmd)
}

export function runReducer(state: RunState, event: RunEvent): RunState {
  const next: RunState = { ...state, lastEvent: event }

  switch (event.type) {
    case 'run_started':
      return {
        ...initialRunState,
        runId: event.runId,
        brief: event.brief,
        phase: 'planning',
        lastEvent: event,
      }

    case 'log':
      return {
        ...next,
        transcript: [
          ...next.transcript,
          { id: `t${transcriptSeq++}`, at: event.at, kind: 'log', text: event.message, level: event.level },
        ],
      }

    case 'agent_message':
      return {
        ...next,
        transcript: [...next.transcript, { id: `t${transcriptSeq++}`, at: event.at, kind: 'agent_message', text: event.text }],
      }

    case 'sandbox': {
      const prev = next.sandbox
      const egress = prev?.egress ?? []
      const sandbox: SandboxState = {
        id: event.sandboxId,
        shape: prev?.shape,
        rootfs: prev?.rootfs,
        state: event.action === 'egress_set' ? prev?.state ?? 'created' : (event.action as SandboxState['state']),
        egress: event.action === 'egress_set' && event.detail ? [...egress, event.detail] : egress,
      }
      return { ...next, sandbox, phase: event.action === 'resumed' ? 'buying' : next.phase }
    }

    case 'stack_proposed': {
      const stackState: StackState = {
        stack: event.stack,
        reason: event.reason,
        files: [],
        commands: [],
        fixAttempts: [],
        loadResults: [],
      }
      return {
        ...next,
        phase: 'planning',
        currentStackId: event.stack.id,
        stackOrder: next.stackOrder.includes(event.stack.id) ? next.stackOrder : [...next.stackOrder, event.stack.id],
        stacks: { ...next.stacks, [event.stack.id]: stackState },
      }
    }

    case 'file_written': {
      const s = next.stacks[event.stackId]
      if (!s) return next
      const existingIdx = s.files.findIndex((f) => f.path === event.path)
      const files = [...s.files]
      const entry: FileEntry = { path: event.path, content: event.content, at: event.at }
      if (existingIdx >= 0) files[existingIdx] = entry
      else files.push(entry)
      return {
        ...next,
        phase: 'writing',
        stacks: { ...next.stacks, [event.stackId]: { ...s, files } },
      }
    }

    case 'command': {
      const s = next.stacks[event.stackId]
      if (!s) return next
      const commands = [...s.commands, { cmd: event.cmd, output: event.output, exitCode: event.exitCode, at: event.at }]
      let transcript = next.transcript
      if (event.exitCode === 0) {
        // Resolve the most recent unresolved fix_attempt for this stack -> turns the card green.
        const idx = [...transcript].reverse().findIndex((t) => t.kind === 'fix_attempt' && t.fix?.stackId === event.stackId && !t.fix.resolved)
        if (idx >= 0) {
          const realIdx = transcript.length - 1 - idx
          const entry = transcript[realIdx]
          transcript = [...transcript]
          transcript[realIdx] = { ...entry, fix: { ...entry.fix!, resolved: true } }
        }
      }
      return {
        ...next,
        phase: isTestLikeCommand(event.cmd) ? 'testing' : next.phase,
        stacks: { ...next.stacks, [event.stackId]: { ...s, commands } },
        transcript,
      }
    }

    case 'fix_attempt': {
      const s = next.stacks[event.stackId]
      if (!s) return next
      const fixAttempts = [...s.fixAttempts, { attempt: event.attempt, error: event.error, change: event.change, at: event.at, resolved: false }]
      return {
        ...next,
        phase: 'fixing',
        stacks: { ...next.stacks, [event.stackId]: { ...s, fixAttempts } },
        transcript: [
          ...next.transcript,
          {
            id: `t${transcriptSeq++}`,
            at: event.at,
            kind: 'fix_attempt',
            fix: { stackId: event.stackId, attempt: event.attempt, error: event.error, change: event.change, resolved: false },
          },
        ],
      }
    }

    case 'load_test': {
      const s = next.stacks[event.stackId]
      if (!s) return next
      return {
        ...next,
        phase: 'testing',
        stacks: { ...next.stacks, [event.stackId]: { ...s, loadResults: [...s.loadResults, event.result] } },
      }
    }

    case 'decision':
      return {
        ...next,
        decisions: [...next.decisions, { requirement: event.requirement, chosen: event.chosen, alternatives: event.alternatives, evidence: event.evidence, at: event.at }],
      }

    case 'stack_result': {
      const s = next.stacks[event.stackId]
      if (!s) return next
      return {
        ...next,
        stacks: { ...next.stacks, [event.stackId]: { ...s, status: event.status, monthlyCost: event.monthlyCost, summary: event.summary } },
      }
    }

    case 'awaiting_approval':
      return {
        ...next,
        phase: 'awaiting_approval',
        awaitingApproval: { stackId: event.stackId, monthlyCost: event.monthlyCost, budgetMonthly: event.budgetMonthly },
      }

    case 'provisioning': {
      const idx = next.provisioning.findIndex((p) => p.service.serviceId === event.service.serviceId)
      const entry: ProvisioningEntry = { service: event.service, command: event.command, status: event.status, output: event.output }
      const provisioning = [...next.provisioning]
      if (idx >= 0) provisioning[idx] = entry
      else provisioning.push(entry)
      return { ...next, phase: 'buying', provisioning }
    }

    case 'live':
      return { ...next, phase: 'live', liveUrl: event.url }

    case 'error':
      return { ...next, phase: 'error', error: event.message }

    case 'run_finished':
      return { ...next, phase: 'finished', finished: true }

    case 'bom_proposed':
      return { ...next, bom: event.items, bomOneTimeCostUsd: event.oneTimeCostUsd }

    default:
      return next
  }
}
