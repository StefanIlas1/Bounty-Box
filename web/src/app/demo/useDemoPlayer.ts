import { useCallback, useRef, useState } from 'react'
import type { RunEvent } from '../../shared/types'
import { buildPreApprovalEvents, demoEventsPostApproval } from './script'

export type DemoStage = 'idle' | 'playing' | 'paused' | 'awaiting_approval' | 'finished'
export type DemoSpeed = 1 | 2 | 4

export interface DemoStartOptions {
  hardwareOn?: boolean
  deviceNeeds?: string
}

interface UseDemoPlayerOpts {
  dispatch: (event: RunEvent) => void
  resetState: () => void
}

export function useDemoPlayer({ dispatch, resetState }: UseDemoPlayerOpts) {
  const [stage, setStage] = useState<DemoStage>('idle')
  const [speed, setSpeedState] = useState<DemoSpeed>(1)

  const speedRef = useRef<DemoSpeed>(1)
  const lastOptionsRef = useRef<DemoStartOptions>({})
  const queueRef = useRef<RunEvent[]>(buildPreApprovalEvents(false))
  const indexRef = useRef(0)
  const lastAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waitStartRef = useRef(0)
  const waitPlannedMsRef = useRef(0)
  const pendingRemainingRef = useRef<number | null>(null)
  const pausedRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const fire = useCallback(() => {
    const queue = queueRef.current
    const event = queue[indexRef.current]
    if (!event) return
    dispatch(event)
    lastAtRef.current = event.at
    indexRef.current += 1
    if (event.type === 'awaiting_approval') {
      setStage('awaiting_approval')
      return
    }
    if (indexRef.current >= queue.length) {
      setStage('finished')
      return
    }
    step()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])

  function step() {
    clearTimer()
    const queue = queueRef.current
    if (pausedRef.current || indexRef.current >= queue.length) return
    const event = queue[indexRef.current]
    const deltaAt = Math.max(0, event.at - lastAtRef.current)
    const realMs = deltaAt / speedRef.current
    waitStartRef.current = Date.now()
    waitPlannedMsRef.current = realMs
    timerRef.current = setTimeout(fire, realMs)
  }

  const start = useCallback((options?: DemoStartOptions) => {
    lastOptionsRef.current = options ?? {}
    resetState()
    clearTimer()
    pausedRef.current = false
    pendingRemainingRef.current = null
    queueRef.current = buildPreApprovalEvents(!!options?.hardwareOn, options?.deviceNeeds)
    indexRef.current = 0
    lastAtRef.current = 0
    setStage('playing')
    step()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetState])

  const pause = useCallback(() => {
    if (pausedRef.current) return
    if (timerRef.current) {
      const elapsed = Date.now() - waitStartRef.current
      pendingRemainingRef.current = Math.max(0, waitPlannedMsRef.current - elapsed)
    }
    clearTimer()
    pausedRef.current = true
    setStage('paused')
  }, [])

  const resume = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    setStage('playing')
    if (pendingRemainingRef.current != null) {
      const remaining = pendingRemainingRef.current
      pendingRemainingRef.current = null
      waitStartRef.current = Date.now()
      waitPlannedMsRef.current = remaining
      timerRef.current = setTimeout(fire, remaining)
    } else {
      step()
    }
  }, [fire])

  const togglePause = useCallback(() => {
    if (pausedRef.current) resume()
    else pause()
  }, [pause, resume])

  const setSpeed = useCallback((s: DemoSpeed) => {
    speedRef.current = s
    setSpeedState(s)
    // If mid-wait and playing, restart the current wait at the new speed (small, acceptable snap).
    if (timerRef.current && !pausedRef.current) {
      clearTimer()
      step()
    }
  }, [])

  const restart = useCallback(() => {
    resetState()
    clearTimer()
    pausedRef.current = false
    pendingRemainingRef.current = null
    queueRef.current = buildPreApprovalEvents(!!lastOptionsRef.current.hardwareOn, lastOptionsRef.current.deviceNeeds)
    indexRef.current = 0
    lastAtRef.current = 0
    setStage('playing')
    step()
  }, [resetState])

  const skipToApproval = useCallback(() => {
    clearTimer()
    pausedRef.current = false
    pendingRemainingRef.current = null
    const queue = queueRef.current
    while (indexRef.current < queue.length) {
      const event = queue[indexRef.current]
      dispatch(event)
      lastAtRef.current = event.at
      indexRef.current += 1
      if (event.type === 'awaiting_approval') break
    }
    setStage('awaiting_approval')
  }, [dispatch])

  const approve = useCallback(() => {
    clearTimer()
    pausedRef.current = false
    pendingRemainingRef.current = null
    queueRef.current = demoEventsPostApproval
    indexRef.current = 0
    lastAtRef.current = 0
    setStage('playing')
    step()
  }, [])

  const stop = useCallback(() => {
    clearTimer()
    pausedRef.current = false
    pendingRemainingRef.current = null
    setStage('idle')
  }, [])

  return { stage, speed, setSpeed, start, pause, resume, togglePause, restart, skipToApproval, approve, stop }
}
