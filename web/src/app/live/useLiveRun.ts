import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Brief, RunEvent } from '../../shared/types'
import type { RunSnapshot } from '../../shared/backend'
import type { Phase } from '../state/reducer'
import { simulateRun } from '../../shared/simulateRun'
import { playQueue } from '../playback/playQueue'
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
const STALL_MS = 45_000
const FAILURE_KEYWORDS = ['sandbox', 'quota', 'stripe', 'createos', 'credential']

function looksLikeHardFailure(message?: string): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return FAILURE_KEYWORDS.some((k) => lower.includes(k))
}

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
  const [simulated, setSimulated] = useState(false)

  const snapshotRef = useRef<RunSnapshot | null>(null)
  const proposalIdRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runIdRef = useRef<string | null>(null)
  const reachableRef = useRef<boolean | null>(null)
  const lastBriefRef = useRef<Brief | null>(null)
  const lastProgressRef = useRef(Date.now())
  const pollFailuresRef = useRef(0)
  const simulatedRef = useRef(false)
  const simulatedPostRef = useRef<RunEvent[] | null>(null)
  const cancelPlaybackRef = useRef<(() => void) | null>(null)

  const probe = useCallback(async () => {
    const ok = await probeBackendReachable()
    reachableRef.current = ok
    setReachable(ok)
  }, [])

  useEffect(() => {
    probe()
    const id = setInterval(probe, 10_000)
    return () => clearInterval(id)
  }, [probe])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const stopPlayback = useCallback(() => {
    cancelPlaybackRef.current?.()
    cancelPlaybackRef.current = null
  }, [])

  // Falls back to the in-browser simulated run so judges never see a dead end. Safe to call
  // more than once; only the first call does anything. Continues on top of whatever the UI
  // already shows (it never resets state itself).
  const runFallback = useCallback(
    (brief: Brief) => {
      if (simulatedRef.current) return
      simulatedRef.current = true
      setSimulated(true)
      stopPolling()
      stopWatchdog()
      stopPlayback()
      const { pre, post, runId: simRunId } = simulateRun(brief)
      if (!runIdRef.current) {
        runIdRef.current = simRunId
        setRunId(simRunId)
      }
      simulatedPostRef.current = post
      toast('Live services unavailable, continuing with a simulated build')
      // The simulator's own run_started would wipe the transcript already on screen; skip it.
      cancelPlaybackRef.current = playQueue(
        pre.filter((e) => e.type !== 'run_started'),
        dispatch,
        { stopAt: (e) => e.type === 'awaiting_approval' },
      ).cancel
    },
    [dispatch, stopPolling, stopWatchdog, stopPlayback],
  )

  const touchProgress = useCallback(() => {
    lastProgressRef.current = Date.now()
  }, [])

  const startWatchdog = useCallback(() => {
    stopWatchdog()
    touchProgress()
    watchdogRef.current = setInterval(() => {
      if (Date.now() - lastProgressRef.current > STALL_MS && lastBriefRef.current) {
        runFallback(lastBriefRef.current)
      }
    }, 5000)
  }, [stopWatchdog, touchProgress, runFallback])

  const applySnapshot = useCallback(
    (snap: RunSnapshot) => {
      const prev = snapshotRef.current
      const events = diffSnapshot(prev, snap)
      for (const e of events) dispatch(e)
      if (events.length > 0 || prev?.status !== snap.status) touchProgress()
      setPhase(STAGE_TO_PHASE[snap.status])
      if (snap.proposal) proposalIdRef.current = snap.proposal.id
      setSnapshotMode(snap.mode)
      snapshotRef.current = snap
    },
    [dispatch, setPhase, touchProgress],
  )

  const poll = useCallback(async () => {
    const id = runIdRef.current
    if (!id || simulatedRef.current) return
    try {
      const snap = await getRun(id)
      pollFailuresRef.current = 0
      applySnapshot(snap)
      if (snap.status === 'failed' && looksLikeHardFailure(snap.error) && lastBriefRef.current) {
        runFallback(lastBriefRef.current)
        return
      }
      if (TERMINAL.has(snap.status)) {
        stopPolling()
        stopWatchdog()
      }
    } catch {
      pollFailuresRef.current += 1
      if (pollFailuresRef.current >= 2 && lastBriefRef.current) {
        runFallback(lastBriefRef.current)
      }
    }
  }, [applySnapshot, stopPolling, stopWatchdog, runFallback])

  const begin = useCallback(
    async (payload: StartPayload) => {
      setStarting(true)
      setStartError(null)
      resetState()
      snapshotRef.current = null
      proposalIdRef.current = null
      runIdRef.current = null
      setRunId(null)
      simulatedRef.current = false
      setSimulated(false)
      pollFailuresRef.current = 0
      stopPolling()
      stopWatchdog()
      stopPlayback()

      const uiBrief: Brief = { prompt: payload.description, budgetMonthly: payload.budgetMonthly, targetUsers: payload.targetUsers }
      lastBriefRef.current = uiBrief

      // Already known unreachable (the Brief-screen probe failed) -> skip the real call
      // entirely and go straight to the simulated fallback.
      if (reachableRef.current === false) {
        dispatch({ type: 'run_started', runId: 'pending', brief: uiBrief, at: 0 })
        runFallback(uiBrief)
        setStarting(false)
        return
      }

      try {
        const backendBrief = {
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
        const snap = await createRun(backendBrief, payload.useFixtures ? 'fixture' : 'live')
        runIdRef.current = snap.id
        setRunId(snap.id)
        dispatch({ type: 'run_started', runId: snap.id, brief: backendBriefToUiBrief(backendBrief), at: 0 })
        touchProgress()
        applySnapshot(snap)
        if (snap.status === 'failed' && looksLikeHardFailure(snap.error)) {
          runFallback(uiBrief)
        } else if (!TERMINAL.has(snap.status)) {
          pollRef.current = setInterval(poll, POLL_MS)
          startWatchdog()
        }
      } catch {
        // Unreachable, 429/503/5xx, or anything else that stops the real run from starting.
        dispatch({ type: 'run_started', runId: 'pending', brief: uiBrief, at: 0 })
        runFallback(uiBrief)
      } finally {
        setStarting(false)
      }
    },
    [applySnapshot, dispatch, poll, resetState, runFallback, startWatchdog, stopPlayback, stopPolling, stopWatchdog, touchProgress],
  )

  const approve = useCallback(async () => {
    if (simulatedRef.current) {
      const post = simulatedPostRef.current
      if (!post) return
      stopPlayback()
      cancelPlaybackRef.current = playQueue(post, dispatch).cancel
      return
    }
    const id = runIdRef.current
    const proposalId = proposalIdRef.current
    if (!id || !proposalId) return
    try {
      const snap = await approveRun(id, proposalId)
      applySnapshot(snap)
      if (!TERMINAL.has(snap.status) && !pollRef.current) {
        pollRef.current = setInterval(poll, POLL_MS)
        startWatchdog()
      }
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Approve failed.')
    }
  }, [applySnapshot, dispatch, poll, startWatchdog, stopPlayback])

  const cancel = useCallback(async () => {
    stopWatchdog()
    if (simulatedRef.current) {
      stopPlayback()
      return
    }
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
  }, [applySnapshot, stopPolling, stopWatchdog, stopPlayback])

  const stop = useCallback(() => {
    stopPolling()
    stopWatchdog()
    stopPlayback()
    runIdRef.current = null
    setRunId(null)
    snapshotRef.current = null
    proposalIdRef.current = null
    simulatedRef.current = false
    setSimulated(false)
  }, [stopPolling, stopWatchdog, stopPlayback])

  useEffect(
    () => () => {
      stopPolling()
      stopWatchdog()
      stopPlayback()
    },
    [stopPolling, stopWatchdog, stopPlayback],
  )

  return { reachable, runId, snapshotMode, simulated, starting, startError, begin, approve, cancel, stop }
}
