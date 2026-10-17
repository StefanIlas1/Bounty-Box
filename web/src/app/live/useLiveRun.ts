import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunEvent } from '../../shared/types'
import type { RunSnapshot } from '../../shared/backend'
import type { Phase } from '../state/reducer'
import { approveRun, cancelRun, createRun, getRun, probeBackendReachable } from './client'
import { diffSnapshot, STAGE_TO_PHASE, backendBriefToUiBrief } from './snapshotAdapter'

export interface StartPayload {
  description: string
  budgetMonthly: number
  targetUsers: number
  concurrency: number
  durationSeconds: number
  maxP95Ms: number
  maxErrorRate: number
  useFixtures: boolean
  // Hardware planning is demo-only for now (no backend contract support yet); kept on the
  // payload so the Brief screen has one shape regardless of mode, but useLiveRun.begin()
  // never puts these on the wire.
  hardwareOn?: boolean
  deviceNeeds?: string
}

const POLL_MS = 2000
const TERMINAL = new Set(['deployed', 'failed', 'cancelled'])

interface UseLiveRunOpts {
  dispatch: (event: RunEvent) => void
  setPhase: (phase: Phase) => void
  resetState: () => void
}

export function useLiveRun({ dispatch, setPhase, resetState }: UseLiveRunOpts) {
  const [reachable, setReachable] = useState<boolean | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [snapshotMode, setSnapshotMode] = useState<RunSnapshot['mode'] | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const snapshotRef = useRef<RunSnapshot | null>(null)
  const proposalIdRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runIdRef = useRef<string | null>(null)

  const probe = useCallback(async () => {
    setReachable(await probeBackendReachable())
  }, [])

  useEffect(() => {
    probe()
    const id = setInterval(probe, 10_000)
    return () => clearInterval(id)
  }, [probe])

  const applySnapshot = useCallback(
    (snap: RunSnapshot) => {
      const prev = snapshotRef.current
      const events = diffSnapshot(prev, snap)
      for (const e of events) dispatch(e)
      setPhase(STAGE_TO_PHASE[snap.status])
      if (snap.proposal) proposalIdRef.current = snap.proposal.id
      setSnapshotMode(snap.mode)
      snapshotRef.current = snap
    },
    [dispatch, setPhase],
  )

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const poll = useCallback(async () => {
    const id = runIdRef.current
    if (!id) return
    try {
      const snap = await getRun(id)
      applySnapshot(snap)
      if (TERMINAL.has(snap.status)) stopPolling()
    } catch {
      // transient poll failure; keep trying until the next interval tick
    }
  }, [applySnapshot, stopPolling])

  const begin = useCallback(
    async (payload: StartPayload) => {
      setStarting(true)
      setStartError(null)
      resetState()
      snapshotRef.current = null
      proposalIdRef.current = null
      stopPolling()
      try {
        const brief = {
          description: payload.description,
          monthlyBudgetUsd: payload.budgetMonthly,
          targetUsers: payload.targetUsers,
          load: {
            concurrency: payload.concurrency,
            durationSeconds: payload.durationSeconds,
            maxP95Ms: payload.maxP95Ms,
            maxErrorRate: payload.maxErrorRate,
          },
        }
        const snap = await createRun(brief, payload.useFixtures ? 'fixture' : 'live')
        runIdRef.current = snap.id
        setRunId(snap.id)
        dispatch({ type: 'run_started', runId: snap.id, brief: backendBriefToUiBrief(brief), at: 0 })
        applySnapshot(snap)
        if (!TERMINAL.has(snap.status)) {
          pollRef.current = setInterval(poll, POLL_MS)
        }
      } catch (e) {
        setStartError(e instanceof Error ? e.message : 'Failed to start run.')
      } finally {
        setStarting(false)
      }
    },
    [applySnapshot, dispatch, poll, resetState, stopPolling],
  )

  const approve = useCallback(async () => {
    const id = runIdRef.current
    const proposalId = proposalIdRef.current
    if (!id || !proposalId) return
    try {
      const snap = await approveRun(id, proposalId)
      applySnapshot(snap)
      if (!TERMINAL.has(snap.status) && !pollRef.current) {
        pollRef.current = setInterval(poll, POLL_MS)
      }
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Approve failed.')
    }
  }, [applySnapshot, poll])

  const cancel = useCallback(async () => {
    const id = runIdRef.current
    if (!id) return
    try {
      const snap = await cancelRun(id)
      applySnapshot(snap)
    } catch {
      // ignore
    } finally {
      stopPolling()
    }
  }, [applySnapshot, stopPolling])

  const stop = useCallback(() => {
    stopPolling()
    runIdRef.current = null
    setRunId(null)
    snapshotRef.current = null
    proposalIdRef.current = null
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  return { reachable, runId, snapshotMode, starting, startError, begin, approve, cancel, stop }
}
