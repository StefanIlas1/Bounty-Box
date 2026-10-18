import type { BackendBrief, BackendGeneratedApp, RunSnapshot } from '../../shared/backend'

export function safeApiError(error: unknown): string {
  const text = error instanceof Error ? error.message : 'Request failed. Please try again.'
  return text.replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/gi, '[service URL]').replace(/(?:Bearer\s+|(?:sk|skp|re)_[A-Za-z0-9_-]*|sk-)[A-Za-z0-9_.-]+/g, '[redacted]').slice(0, 500)
}

async function parseJsonOrThrow(res: Response): Promise<any> {
  let body: any = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) {
    const message = typeof body?.error === 'string' ? body.error : `Request failed (HTTP ${res.status}).`
    throw new Error(safeApiError(new Error(message)))
  }
  return body
}

export async function createRun(brief: BackendBrief, mode: 'live' | 'fixture'): Promise<RunSnapshot> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, mode }),
  })
  return parseJsonOrThrow(res)
}

export async function getRun(runId: string): Promise<RunSnapshot> {
  const res = await fetch(`/api/runs/${runId}`)
  return parseJsonOrThrow(res)
}

export async function getRunArtifact(runId: string, attempt: number): Promise<{ digest: string; app: BackendGeneratedApp }> {
  return parseJsonOrThrow(await fetch(`/api/runs/${encodeURIComponent(runId)}/artifacts/${attempt}`))
}

export async function approveRun(runId: string, proposalId: string): Promise<RunSnapshot> {
  const res = await fetch(`/api/runs/${runId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposalId }),
  })
  return parseJsonOrThrow(res)
}

export async function cancelRun(runId: string): Promise<RunSnapshot> {
  const res = await fetch(`/api/runs/${runId}/cancel`, { method: 'POST' })
  return parseJsonOrThrow(res)
}

/** No /api/health in this contract. Reachability is probed with a harmless lookup of a
 * run that doesn't exist: a 404 with `{ error }` JSON means the backend process answered
 * (reachable). A thrown fetch, or a non-JSON body (e.g. the dev proxy's own 502 text/plain
 * page when 127.0.0.1:3000 isn't listening), means it did not (unreachable). */
export async function probeBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch('/api/runs/does-not-exist')
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return false
    const body = await res.json()
    return typeof body?.error === 'string' || res.status === 404
  } catch {
    return false
  }
}

export async function advanceRun(runId: string): Promise<unknown> {
  return parseJsonOrThrow(await fetch(`/api/runs/${encodeURIComponent(runId)}/advance`, { method: 'POST' }))
}
