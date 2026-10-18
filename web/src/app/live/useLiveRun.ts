import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunEvent, BomItem } from '../../shared/types'
import type { RunSnapshot } from '../../shared/backend'
import type { Phase } from '../state/reducer'
import { advanceRun, approveRun, cancelRun, createRun, getRun, getRunArtifact, safeApiError, probeBackendReachable } from './client'
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
  hardwareItem?: BomItem
  hardwareOn?: boolean
  deviceNeeds?: string
}

const POLL_MS = 2000
const SETTLED = new Set(['awaiting_approval', 'deployed', 'failed', 'cancelled'])
interface UseLiveRunOpts {
  dispatch: (event: RunEvent) => void
  setPhase: (phase: Phase) => void
  resetState: () => void
  initialRunId?: string | null
}

export function useLiveRun({ dispatch, setPhase, resetState, initialRunId }: UseLiveRunOpts) {
  const [reachable, setReachable] = useState<boolean | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [snapshotMode, setSnapshotMode] = useState<RunSnapshot['mode'] | null>(null)
  const [starting, setStarting] = useState(false)
  const [approving, setApproving] = useState(false)
  const approvalRef = useRef(false)
  const artifactsRef = useRef(new Set<string>())
  const artifactRevisionRef = useRef(new Map<string, number>())
  const [startError, setStartError] = useState<string | null>(null)
  const snapshotRef = useRef<RunSnapshot | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runIdRef = useRef<string | null>(null)
  const epochRef = useRef(0)
  const advanceRef = useRef<{ id: string; epoch: number } | null>(null)

  const advance = useCallback((snap: RunSnapshot) => {
    if (SETTLED.has(snap.status) || snap.mode !== 'live' || advanceRef.current) return
    const task = { id: snap.id, epoch: epochRef.current }
    advanceRef.current = task
    void advanceRun(snap.id).catch(error => {
      if (task.epoch === epochRef.current) setStartError(safeApiError(error))
    }).finally(() => { if (advanceRef.current === task) advanceRef.current = null })
  }, [])

  useEffect(() => {
    let disposed = false
    const probe = async () => { const ok = await probeBackendReachable(); if (!disposed) setReachable(ok) }
    void probe()
    const id = setInterval(probe, 10_000)
    return () => { disposed = true; clearInterval(id) }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  const applySnapshot = useCallback((snap: RunSnapshot) => {
    if (!snapshotRef.current) {
      dispatch({ type: 'run_started', runId: snap.id, brief: backendBriefToUiBrief(snap.brief), at: 0 })
    }
    for (const event of diffSnapshot(snapshotRef.current, snap)) dispatch(event)
    setPhase(STAGE_TO_PHASE[snap.status])
    setSnapshotMode(snap.mode)
    snapshotRef.current = snap
    setStartError(snap.error ? safeApiError(new Error(snap.error)) : null)
    const epoch = epochRef.current
    for (const attempt of snap.attempts) {
      const key = `${snap.id}:${attempt.number}`
      if (artifactsRef.current.has(key)) continue
      artifactsRef.current.add(key)
      void getRunArtifact(snap.id, attempt.number).then(({ app }) => {
        if (epoch !== epochRef.current || app.revision < (artifactRevisionRef.current.get(attempt.stack.id) ?? 0)) return
        artifactRevisionRef.current.set(attempt.stack.id, app.revision)
        for (const file of app.files) dispatch({ type: 'file_written', stackId: attempt.stack.id, path: file.path, content: file.content, at: Date.now(), preservePhase: true })
      }).catch(() => {
        artifactsRef.current.delete(key)
      })
    }
  }, [dispatch, setPhase])

  const poll = useCallback(async () => {
    const id = runIdRef.current
    const epoch = epochRef.current
    if (!id) return
    try {
      const snap = await getRun(id)
      if (epoch !== epochRef.current) return
      applySnapshot(snap)
      if (SETTLED.has(snap.status)) stopPolling()
      else advance(snap)
    } catch (error) {
      if (epoch === epochRef.current) setStartError(safeApiError(error))
    }
  }, [advance, applySnapshot, stopPolling])

  const watch = useCallback((snap: RunSnapshot) => {
    stopPolling()
    runIdRef.current = snap.id
    setRunId(snap.id)
    applySnapshot(snap)
    if (!SETTLED.has(snap.status)) {
      pollRef.current = setInterval(poll, POLL_MS)
      advance(snap)
    }
  }, [advance, applySnapshot, poll, stopPolling])

  const stop = useCallback(() => {
    epochRef.current += 1
    stopPolling()
    advanceRef.current = null
    runIdRef.current = null
    snapshotRef.current = null
    setRunId(null)
    setStarting(false)
    setApproving(false)
    approvalRef.current = false
    artifactsRef.current.clear()
    artifactRevisionRef.current.clear()
    setSnapshotMode(null)
    setStartError(null)
  }, [stopPolling])

  useEffect(() => {
    if (!initialRunId) return
    const epoch = ++epochRef.current
    void getRun(initialRunId).then(snap => {
      if (epoch === epochRef.current) watch(snap)
    }).catch(error => {
      if (epoch === epochRef.current) setStartError(safeApiError(error))
    })
    return () => { epochRef.current += 1; stopPolling() }
  }, [initialRunId, watch, stopPolling])

  const begin = useCallback(async (payload: StartPayload) => {
    stop()
    resetState()
    setStarting(true)
    const epoch = epochRef.current
    try {
      const snap = await createRun({
        description: payload.description,
        monthlyBudgetUsd: payload.budgetMonthly,
        targetUsers: payload.targetUsers,
        load: { concurrency: payload.concurrency, durationSeconds: payload.durationSeconds, maxP95Ms: payload.maxP95Ms, maxErrorRate: payload.maxErrorRate },
      }, payload.useFixtures ? 'fixture' : 'live')
      if (epoch === epochRef.current) watch(snap)
    } catch (error) {
      if (epoch === epochRef.current) setStartError(safeApiError(error))
    } finally {
      if (epoch === epochRef.current) setStarting(false)
    }
  }, [resetState, stop, watch])

  const approve = useCallback(async () => {
    const snap = snapshotRef.current
    if (!snap?.proposal || approvalRef.current) return
    const epoch = epochRef.current
    approvalRef.current = true
    setApproving(true)
    setStartError(null)
    try {
      const approved = await approveRun(snap.id, snap.proposal.id)
      if (epoch === epochRef.current) watch(approved)
    } catch (error) {
      if (epoch === epochRef.current) setStartError(safeApiError(error))
    } finally {
      if (epoch === epochRef.current) { approvalRef.current = false; setApproving(false) }
    }
  }, [watch])

  const cancel = useCallback(async () => {
    const id = runIdRef.current
    if (!id) return
    const epoch = epochRef.current
    try {
      const cancelled = await cancelRun(id)
      if (epoch === epochRef.current) watch(cancelled)
    } catch (error) { if (epoch === epochRef.current) setStartError(safeApiError(error)) }
  }, [watch])

  useEffect(() => () => { epochRef.current += 1; stopPolling() }, [stopPolling])
  return { reachable, runId, snapshotMode, simulated: false, starting, approving, startError, begin, approve, cancel, stop }
}
