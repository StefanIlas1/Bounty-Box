// Diffs successive backend RunSnapshots into our own RunEvent stream, so Live mode drives
// the exact same reducer (web/src/app/state/reducer.ts) that the in-browser Demo script does.
import { safeApiError } from './client'
import type { Brief, RunEvent, Service, Stack } from '../../shared/types'
import type { Phase } from '../state/reducer'
import type { BackendBrief, BackendCandidateStack, RunSnapshot } from '../../shared/backend'

export const STAGE_TO_PHASE: Record<RunSnapshot['status'], Phase> = {
  queued: 'planning',
  planning: 'planning',
  generating: 'writing',
  testing: 'testing',
  repairing: 'fixing',
  awaiting_approval: 'awaiting_approval',
  provisioning: 'buying',
  deployed: 'live',
  failed: 'error',
  cancelled: 'error',
}

export function backendBriefToUiBrief(b: BackendBrief): Brief {
  return { prompt: b.description, budgetMonthly: b.monthlyBudgetUsd, targetUsers: b.targetUsers }
}

function roleToCategory(role: BackendCandidateStack['services'][number]['role']): Service['category'] {
  if (role === 'host') return 'hosting'
  return role
}

function candidateToStack(c: BackendCandidateStack): Stack {
  return {
    id: c.id,
    label: c.name,
    services: c.services.map((s) => ({
      category: roleToCategory(s.role),
      provider: s.name,
      serviceId: s.id,
      monthlyCost: s.monthlyCostUsd,
      tier: c.partner ? 'partner' : undefined,
    })),
  }
}

let seq = 0
function nextAt(): number {
  seq += 1
  return seq
}

/** Empty snapshot slices used as the "previous" baseline for the very first poll. */
const EMPTY: Pick<RunSnapshot, 'events' | 'candidates' | 'attempts'> = { events: [], candidates: [], attempts: [] }

export function diffSnapshot(prev: RunSnapshot | null, next: RunSnapshot): RunEvent[] {
  const base = prev ?? (EMPTY as RunSnapshot)
  const out: RunEvent[] = []

  // 2. New candidate stacks -> stack_proposed.
  const seenCandidates = new Set(base.candidates.map((c) => c.id))
  for (const c of next.candidates) {
    if (seenCandidates.has(c.id)) continue
    out.push({ type: 'stack_proposed', stack: candidateToStack(c), reason: c.description, at: nextAt() })
  }

  // 1. New backend narration events -> agent_message (stage also drives phase, handled separately).
  for (const e of next.events.slice(base.events.length)) {
    if (e.kind === 'command' && e.command && typeof e.exitCode === 'number' && (e.stackId || next.candidates[0]?.id)) {
      out.push({ type: 'command', stackId: e.stackId ?? next.candidates[0].id, cmd: safeApiError(new Error(e.command)), output: safeApiError(new Error(e.output ?? '')), exitCode: e.exitCode, at: nextAt() })
    } else {
      out.push({ type: 'agent_message', text: safeApiError(new Error(e.message)), at: nextAt() })
    }
  }

  // 3. Attempts: new ones (possibly a fix_attempt) and newly-arrived results/decisions.
  for (const attempt of next.attempts) {
    const prevAttempt = base.attempts.find((a) => a.number === attempt.number)

    if (!prevAttempt && attempt.revision > 1) {
      const priorForStack = base.attempts
        .filter((a) => a.stack.id === attempt.stack.id && a.revision < attempt.revision)
        .sort((a, b) => b.revision - a.revision)[0]
      out.push({
        type: 'fix_attempt',
        stackId: attempt.stack.id,
        attempt: attempt.revision,
        error: priorForStack?.result?.failureReason ?? 'Previous attempt did not meet the test criteria.',
        change: attempt.decision ?? 'Revised the generated code based on test feedback.',
        at: nextAt(),
      })
    }

    if (attempt.result && !prevAttempt?.result) {
      const r = attempt.result
      out.push({
        type: 'command',
        stackId: attempt.stack.id,
        cmd: 'independent verification',
        output: r.logs.map(log => safeApiError(new Error(log))).join('\n') || 'No execution logs were returned.',
        exitCode: r.passed ? 0 : 1,
        at: nextAt(),
      })
      out.push({
        type: 'load_test',
        stackId: attempt.stack.id,
        result: { users: next.brief.load.concurrency, p95Ms: r.p95Ms, errorRate: r.errorRate, passed: r.passed },
        at: nextAt(),
      })
      if (r.previewUrl) {
        out.push({ type: 'log', level: 'info', message: `Sandbox preview: ${r.previewUrl}`, at: nextAt() })
      }
      const overBudget = attempt.stack.estimatedMonthlyCostUsd > next.brief.monthlyBudgetUsd
      out.push({
        type: 'stack_result',
        stackId: attempt.stack.id,
        status: !r.passed ? 'failed' : overBudget ? 'over_budget' : 'passed',
        monthlyCost: attempt.stack.estimatedMonthlyCostUsd,
        summary: r.failureReason ?? `${r.requests} measured requests over ${r.durationSeconds.toFixed(2)}s at ${next.brief.load.concurrency} concurrent requests.`,
        at: nextAt(),
      })
    }

    if (attempt.decision && !prevAttempt?.decision) {
      out.push({
        type: 'decision',
        requirement: 'stack selection',
        chosen: attempt.stack.name,
        alternatives: [],
        evidence: attempt.decision,
        at: nextAt(),
      })
    }
  }

  // 4. Proposal -> awaiting_approval (sandbox paused, waiting on the user).
  if (next.proposal && next.proposal.id !== prev?.proposal?.id) {
    out.push({
      type: 'awaiting_approval',
      stackId: next.proposal.stack.id,
      monthlyCost: next.proposal.estimatedMonthlyCostUsd,
      budgetMonthly: next.brief.monthlyBudgetUsd,
      at: nextAt(),
    })
  }

  // 5. Deployed URL -> live, then run_finished.
  if (next.deployedUrl && next.deployedUrl !== prev?.deployedUrl) {
    out.push({ type: 'live', url: next.deployedUrl, at: nextAt() })
    out.push({ type: 'run_finished', at: nextAt() })
  }

  // 6. Error / cancellation.
  if (next.error && next.error !== prev?.error) {
    out.push({ type: 'error', message: safeApiError(new Error(next.error)), at: nextAt() })
  } else if (next.status === 'cancelled' && prev?.status !== 'cancelled') {
    out.push({ type: 'error', message: 'Run cancelled.', at: nextAt() })
  }

  return out
}
