import { useCallback, useEffect, useReducer, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { TopBar } from './components/TopBar'
import { BriefScreen } from './screens/BriefScreen'
import { BuildScreen } from './screens/BuildScreen'
import { runReducer, initialRunState, type Phase, type RunState } from './state/reducer'
import { useDemoPlayer } from './demo/useDemoPlayer'
import { useLiveRun, type StartPayload } from './live/useLiveRun'
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
  const [mode, setModeState] = useState<Mode>(() => searchParams.has('mode') ? resolveInitialMode(window.location.search) : defaultMode ?? resolveInitialMode(window.location.search))
  const [initialHardware] = useState<boolean>(() => resolveInitialHardware(window.location.search))
  const [initialRunId] = useState(() => searchParams.get('run'))
  const [screen, setScreen] = useState<'brief' | 'build'>(initialRunId ? 'build' : 'brief')
  const [state, dispatchRaw] = useReducer(appReducer, initialRunState)

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

  const setMode = (m: Mode) => {
    setModeState(m)
    persistMode(m)
  }

  const demoPlayer = useDemoPlayer({ dispatch, resetState })
  const liveRun = useLiveRun({ dispatch, setPhase, resetState, initialRunId })

  useEffect(() => {
    if (!liveRun.runId || mode !== 'live') return
    setSearchParams(params => { const next = new URLSearchParams(params); next.set('run', liveRun.runId!); return next }, { replace: true })
  }, [liveRun.runId, mode, setSearchParams])

  const handleStart = (payload: StartPayload) => {
    setScreen('build')
    if (mode === 'demo') demoPlayer.start({ hardwareOn: payload.hardwareOn, deviceNeeds: payload.deviceNeeds })
    else liveRun.begin(payload)
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

  const unreachableBanner = mode === 'live' && liveRun.reachable === false && !liveRun.simulated
  const fixtureRun = mode === 'live' && liveRun.snapshotMode === 'fixture'

  return (
    <TooltipProvider>
      <div className="flex h-screen min-h-0 flex-col bg-bg">
        <TopBar
          mode={mode}
          onModeChange={setMode}
          reachable={liveRun.reachable}
          fixtureRun={fixtureRun}
          simulated={mode === 'live' && liveRun.simulated}
          onNewRun={handleNewRun}
        />

        {unreachableBanner && (
          <div className="flex items-center gap-3 border-b border-bad/30 bg-bad/10 px-5 py-2.5 text-sm text-ink">
            <AlertTriangle className="size-4 shrink-0 text-bad" />
            <span className="flex-1">
              Backend not reachable at <span className="font-mono text-xs">127.0.0.1:3000</span> (via the dev proxy). Start it, or switch to
              Demo.
            </span>
            <Button size="sm" variant="outline" onClick={() => setMode('demo')}>Switch to Demo</Button>
          </div>
        )}

        {mode === 'live' && screen === 'build' && liveRun.startError && (
          <div role="alert" className="border-b border-bad/30 bg-bad/10 px-5 py-3 text-sm">{liveRun.startError} No simulated results are substituted.</div>
        )}
        {screen === 'brief' ? (
          <BriefScreen mode={mode} onStart={handleStart} starting={liveRun.starting} startError={liveRun.startError} initialHardware={initialHardware} />
        ) : (
          <BuildScreen
            mode={mode}
            state={state}
            onApprove={handleApprove}
            approving={false}
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
