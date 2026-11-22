import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { TopBar } from './components/TopBar'
import { BriefScreen } from './screens/BriefScreen'
import { BuildScreen } from './screens/BuildScreen'
import { runReducer, initialRunState, type Phase, type RunState } from './state/reducer'
import { useDemoPlayer } from './demo/useDemoPlayer'
import { useLiveRun, type StartPayload } from './live/useLiveRun'
import { fetchLiveReady } from './live/client'
import { resolveInitialMode, persistMode, resolveInitialHardware } from './mode'
import type { Mode, RunEvent } from '../shared/types'

type Action = RunEvent | { type: 'RESET' } | { type: 'SET_PHASE'; phase: Phase }

function appReducer(state: RunState, action: Action): RunState {
  if (action.type === 'RESET') return initialRunState
  if (action.type === 'SET_PHASE') return { ...state, phase: action.phase }
  return runReducer(state, action)
}

export default function AppShell({ defaultMode }: { defaultMode?: Mode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [requestedMode, setRequestedMode] = useState<Mode>(() => searchParams.has('mode') ? resolveInitialMode(window.location.search) : defaultMode ?? resolveInitialMode(window.location.search))
  const [liveAvailable, setLiveAvailable] = useState(false)
  const mode: Mode = liveAvailable && requestedMode === 'live' ? 'live' : 'demo'
  const [initialHardware] = useState<boolean>(() => resolveInitialHardware(window.location.search))
  const [initialRunId] = useState(() => searchParams.get('run'))
  const [screen, setScreen] = useState<'brief' | 'build'>('brief')
  const screenRef = useRef(screen)
  screenRef.current = screen
  const opensLiveRunRef = useRef(!!initialRunId && requestedMode === 'live')
  const [state, dispatchRaw] = useReducer(appReducer, initialRunState)

  useEffect(() => {
    let disposed = false
    void fetchLiveReady().then(ready => {
      if (disposed || !ready) return
      if (screenRef.current !== 'brief') setRequestedMode('demo')
      else if (opensLiveRunRef.current) setScreen('build')
      setLiveAvailable(true)
    })
    return () => { disposed = true }
  }, [])

  const dispatch = useCallback((e: RunEvent) => dispatchRaw(e), [])
  const setPhase = useCallback((phase: Phase) => dispatchRaw({ type: 'SET_PHASE', phase }), [])
  const resetState = useCallback(() => dispatchRaw({ type: 'RESET' }), [])

  useEffect(() => {
    const current = searchParams.get('mode')
    if (current !== mode) {
      const next = new URLSearchParams(searchParams)
      next.set('mode', mode)
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const demoPlayer = useDemoPlayer({ dispatch, resetState })
  const liveRun = useLiveRun({ dispatch, setPhase, resetState, initialRunId: mode === 'live' ? initialRunId : null })

  const setMode = (nextMode: Mode) => {
    if (nextMode === mode) return
    demoPlayer.stop()
    liveRun.stop()
    resetState()
    setSearchParams({ mode: nextMode }, { replace: true })
    setScreen('brief')
    setRequestedMode(nextMode)
    persistMode(nextMode)
  }

  useEffect(() => {
    if (!liveRun.runId || mode !== 'live') return
    setSearchParams(params => { const next = new URLSearchParams(params); next.set('run', liveRun.runId!); return next }, { replace: true })
  }, [liveRun.runId, mode, setSearchParams])

  const handleStart = async (payload: StartPayload) => {
    if (mode === 'demo') {
      setScreen('build')
      demoPlayer.start({ hardwareOn: payload.hardwareOn, deviceNeeds: payload.deviceNeeds, hardwareItem: payload.hardwareItem })
      return
    }
    if (await liveRun.begin(payload)) setScreen('build')
  }

  const handleApprove = () => {
    if (mode === 'demo') demoPlayer.approve()
    else liveRun.approve()
  }

  const handleNewRun = () => {
    demoPlayer.stop()
    liveRun.stop()
    resetState()
    setSearchParams({ mode }, { replace: true })
    setScreen('brief')
  }

  const fixtureRun = mode === 'live' && liveRun.snapshotMode === 'fixture'

  return (
    <TooltipProvider>
      <div className="flex h-screen min-h-0 flex-col bg-bg">
        <TopBar
          mode={mode}
          onModeChange={setMode}
          liveAvailable={liveAvailable}
          fixtureRun={fixtureRun}
          onNewRun={handleNewRun}
        />

        {mode === 'live' && screen === 'build' && liveRun.startError && (
          <div role="alert" className="border-b border-bad/30 bg-bad/10 px-5 py-3 text-sm">{liveRun.startError}</div>
        )}
        {screen === 'brief' ? (
          <BriefScreen mode={mode} onStart={handleStart} starting={liveRun.starting} startError={liveRun.startError} initialHardware={initialHardware} />
        ) : (
          <BuildScreen
            mode={mode}
            state={state}
            onApprove={handleApprove}
            approving={mode === 'live' && liveRun.approving}
            demoControls={
              mode === 'demo'
                ? {
                    stage: demoPlayer.stage,
                    speed: demoPlayer.speed,
                    setSpeed: demoPlayer.setSpeed,
                    togglePause: demoPlayer.togglePause,
                    restart: demoPlayer.restart,
                    skipToApproval: demoPlayer.skipToApproval,
                  }
                : undefined
            }
            liveControls={mode === 'live' ? { cancel: liveRun.cancel, canCancel: !!liveRun.runId && state.phase !== 'finished' } : undefined}
          />
        )}
      </div>
      <Toaster />
    </TooltipProvider>
  )
}
