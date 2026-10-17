import { useEffect, useRef, useState } from 'react'
import { Code2, Terminal as TerminalIcon, Columns3, ListChecks } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentPanel } from '../components/AgentPanel'
import { CodeTab } from '../components/CodeTab'
import { TerminalTab } from '../components/TerminalTab'
import { ComparisonsTab } from '../components/ComparisonsTab'
import { DecisionsTab } from '../components/DecisionsTab'
import { SandboxCard } from '../components/SandboxCard'
import { CartCard } from '../components/CartCard'
import { BomCard } from '../components/BomCard'
import { ProvisioningCard } from '../components/ProvisioningCard'
import { LiveUrlCard } from '../components/LiveUrlCard'
import type { Mode } from '../../shared/types'
import type { RunState } from '../state/reducer'
import type { DemoSpeed, DemoStage } from '../demo/useDemoPlayer'

type TabKey = 'code' | 'terminal' | 'comparisons' | 'decisions'

function suggestTab(state: RunState): TabKey | null {
  const event = state.lastEvent
  if (!event) return null
  switch (event.type) {
    case 'stack_proposed':
    case 'file_written':
    case 'fix_attempt':
      return 'code'
    case 'command':
    case 'load_test':
      return 'terminal'
    case 'stack_result':
    case 'awaiting_approval':
    case 'provisioning':
    case 'live':
      return 'comparisons'
    case 'decision':
      return 'decisions'
    default:
      return null
  }
}

interface BuildScreenProps {
  mode: Mode
  state: RunState
  onApprove: () => void
  approving?: boolean
  demoControls?: {
    stage: DemoStage
    speed: DemoSpeed
    setSpeed: (s: DemoSpeed) => void
    togglePause: () => void
    restart: () => void
    skipToApproval: () => void
  }
  liveControls?: { cancel: () => void; canCancel: boolean }
}

export function BuildScreen({ mode, state, onApprove, approving, demoControls, liveControls }: BuildScreenProps) {
  const [tab, setTab] = useState<TabKey>('code')
  const manualRef = useRef(false)
  const prevRunRef = useRef<string | null>(null)

  useEffect(() => {
    if (state.runId !== prevRunRef.current) {
      manualRef.current = false
      prevRunRef.current = state.runId
      setTab('code')
    }
  }, [state.runId])

  useEffect(() => {
    if (manualRef.current) return
    const suggestion = suggestTab(state)
    if (suggestion) setTab(suggestion)
  }, [state.lastEvent])

  const pick = (t: TabKey) => {
    manualRef.current = true
    setTab(t)
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_340px] gap-4 p-4">
      <div className="min-h-0 min-w-0">
        <AgentPanel mode={mode} state={state} demo={demoControls} live={liveControls} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col rounded bg-surface p-3">
        <Tabs value={tab} onValueChange={(v) => pick(v as TabKey)} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="code" className="gap-1.5"><Code2 className="size-3.5" /> Code</TabsTrigger>
            <TabsTrigger value="terminal" className="gap-1.5"><TerminalIcon className="size-3.5" /> Terminal</TabsTrigger>
            <TabsTrigger value="comparisons" className="gap-1.5"><Columns3 className="size-3.5" /> Comparisons</TabsTrigger>
            <TabsTrigger value="decisions" className="gap-1.5"><ListChecks className="size-3.5" /> Decisions</TabsTrigger>
          </TabsList>
          <TabsContent value="code" className="mt-3 min-h-0 min-w-0 flex-1"><CodeTab state={state} mode={mode} /></TabsContent>
          <TabsContent value="terminal" className="mt-3 min-h-0 min-w-0 flex-1"><TerminalTab state={state} /></TabsContent>
          <TabsContent value="comparisons" className="mt-3 min-h-0 min-w-0 flex-1"><ComparisonsTab state={state} /></TabsContent>
          <TabsContent value="decisions" className="mt-3 min-h-0 min-w-0 flex-1"><DecisionsTab state={state} /></TabsContent>
        </Tabs>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto pr-0.5 [&>*]:shrink-0">
        <SandboxCard state={state} />
        <CartCard state={state} onApprove={onApprove} approving={approving} />
        <BomCard state={state} />
        <ProvisioningCard state={state} />
        <LiveUrlCard state={state} />
      </div>
    </div>
  )
}
