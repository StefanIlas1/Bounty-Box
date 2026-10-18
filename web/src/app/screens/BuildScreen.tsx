import { useEffect, useRef, useState } from 'react'
import { Code2, Terminal as TerminalIcon, Columns3, ListChecks, ArrowRight, ArrowDown, Eye } from 'lucide-react'
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
      return 'comparisons'
    case 'file_written':
    case 'fix_attempt':
      return 'code'
    case 'command':
    case 'load_test':
      return 'terminal'
    case 'bom_proposed':
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

const TAB_LABEL: Record<TabKey, string> = { code: 'Code', terminal: 'Terminal', comparisons: 'Comparisons', decisions: 'Decisions' }

// Plain-language pointer to where the interesting thing is happening right now.
function guide(state: RunState): { text: string; tab?: TabKey; panel?: 'sandbox' | 'cart' | 'live' } {
  switch (state.phase) {
    case 'idle':
    case 'planning':
      return { text: 'The agent is reading your brief and proposing stacks. Its reasoning streams in the left panel.', tab: 'decisions' }
    case 'writing':
      return { text: 'Your application is being generated. Comparisons shows the selected stack and estimate; Terminal shows live status. Source files arrive when generation completes.', tab: 'code' }
    case 'testing':
      return { text: 'The code is running inside a CreateOS sandbox. Terminal shows the commands; the Sandbox card shows the box itself.', tab: 'terminal', panel: 'sandbox' }
    case 'fixing':
      return { text: 'A test failed, so the agent is fixing its own code. Compare the error and the patch in Code.', tab: 'code' }
    case 'awaiting_approval':
      return { text: 'The supported stack passed its recorded checks. Review the results, then approve the tested application using existing credits.', tab: 'comparisons', panel: 'cart' }
    case 'buying':
      return { text: 'The approved application is being verified for deployment. The public link appears after verification.', panel: 'cart' }
    case 'live':
    case 'finished':
      return { text: 'Done. Open the live URL on the right, or review why each choice was made in Decisions.', tab: 'decisions', panel: 'live' }
    default:
      return { text: 'Something went wrong. Terminal has the details.', tab: 'terminal' }
  }
}

const PANEL_ID = { sandbox: 'panel-sandbox', cart: 'panel-cart', live: 'panel-live' } as const

interface BuildScreenProps {
  mode: Mode
  state: RunState
  onApprove: () => void
  recorded?: boolean
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

export function BuildScreen({ mode, state, onApprove, approving, demoControls, liveControls, recorded }: BuildScreenProps) {
  const [tab, setTab] = useState<TabKey>(mode === 'live' ? 'comparisons' : 'code')
  const [generationStarted, setGenerationStarted] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (state.phase !== 'writing') { setGenerationStarted(null); setElapsed(0); return }
    const start = Date.now(); setGenerationStarted(start)
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [state.phase])
  const manualRef = useRef(false)
  const prevRunRef = useRef<string | null>(null)

  useEffect(() => {
    if (state.runId !== prevRunRef.current) {
      manualRef.current = false
      prevRunRef.current = state.runId
      setTab(mode === 'live' ? 'comparisons' : 'code')
    }
  }, [state.runId, mode])

  useEffect(() => {
    if (manualRef.current) return
    const suggestion = suggestTab(state)
    if (suggestion) setTab(suggestion)
  }, [state.lastEvent])

  const pick = (t: TabKey) => {
    manualRef.current = true
    setTab(t)
  }

  const g = guide(state)
  const flashPanel = (key: keyof typeof PANEL_ID) => {
    const el = document.getElementById(PANEL_ID[key])
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (key === 'live') el.focus({ preventScroll: true })
    el.classList.remove('bb-flash')
    void el.offsetWidth
    el.classList.add('bb-flash')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <div role="status" aria-live="polite" className="mx-4 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-blue/40 bg-blue/10 px-4 py-2.5 text-sm text-ink">
      <Eye className="size-4 shrink-0 text-blue-soft" aria-hidden="true" />
      <span className="min-w-0 flex-1">{g.text}</span>
      {mode === 'live' && generationStarted !== null && <span className="rounded bg-navy px-3 py-1 font-mono text-xs">Generating · {elapsed}s elapsed</span>}
      {g.tab && g.tab !== tab && (
        <button type="button" onClick={() => pick(g.tab!)} className="inline-flex items-center gap-1 rounded border border-blue/50 px-2.5 py-1 text-xs font-medium text-blue-soft transition-colors hover:bg-blue/20 focus-visible:outline-2 focus-visible:outline-blue">
          Open {TAB_LABEL[g.tab]} <ArrowRight className="size-3" aria-hidden="true" />
        </button>
      )}
      {g.panel && (
        <button type="button" onClick={() => flashPanel(g.panel!)} className="inline-flex items-center gap-1 rounded border border-gold/50 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-gold">
          Show {g.panel === 'sandbox' ? 'sandbox' : g.panel === 'cart' ? 'cart' : 'live URL'} <ArrowRight className="size-3" aria-hidden="true" />
        </button>
      )}
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_340px] gap-4 p-4">
      <div className="min-h-0 min-w-0">
        <AgentPanel mode={mode} state={state} demo={demoControls} live={liveControls} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col rounded bg-surface p-3">
        <Tabs value={tab} onValueChange={(v) => pick(v as TabKey)} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="code" className="gap-1.5"><Code2 className="size-3.5" /> Code{g.tab === "code" && tab !== "code" && <span className="bb-ping ml-0.5 size-1.5 rounded-full bg-blue-soft" aria-label="activity here" />}</TabsTrigger>
            <TabsTrigger value="terminal" className="gap-1.5"><TerminalIcon className="size-3.5" /> Terminal{g.tab === "terminal" && tab !== "terminal" && <span className="bb-ping ml-0.5 size-1.5 rounded-full bg-blue-soft" aria-label="activity here" />}</TabsTrigger>
            <TabsTrigger value="comparisons" className="gap-1.5"><Columns3 className="size-3.5" /> Comparisons{g.tab === "comparisons" && tab !== "comparisons" && <span className="bb-ping ml-0.5 size-1.5 rounded-full bg-blue-soft" aria-label="activity here" />}</TabsTrigger>
            <TabsTrigger value="decisions" className="gap-1.5"><ListChecks className="size-3.5" /> Decisions{g.tab === "decisions" && tab !== "decisions" && <span className="bb-ping ml-0.5 size-1.5 rounded-full bg-blue-soft" aria-label="activity here" />}</TabsTrigger>
          </TabsList>
          <TabsContent value="code" className="mt-3 min-h-0 min-w-0 flex-1"><CodeTab state={state} mode={mode} /></TabsContent>
          <TabsContent value="terminal" className="mt-3 min-h-0 min-w-0 flex-1"><TerminalTab state={state} /></TabsContent>
          <TabsContent value="comparisons" className="mt-3 min-h-0 min-w-0 flex-1"><ComparisonsTab state={state} mode={mode} /></TabsContent>
          <TabsContent value="decisions" className="mt-3 min-h-0 min-w-0 flex-1"><DecisionsTab state={state} /></TabsContent>
        </Tabs>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto pb-16 pr-0.5 [&>*]:shrink-0">
        <div id="panel-sandbox" className="rounded">{recorded ? <div className="rounded bg-surface p-4 text-sm"><h2 className="font-semibold">Verified sandbox run</h2><p className="mt-2 text-muted">Executed in CreateOS with Neon Postgres. Both trial sandboxes were destroyed after testing.</p><p className="mt-2">29 requests · 384 ms p95 · 0 errors</p><p className="mt-2 text-muted">2 concurrent requests for 5.34 seconds. Target users in the table are a planning input, not verified capacity.</p><p className="mt-2 text-muted">Recorded October 17, 2026. Approval and permanent deployment are not available in this replay.</p></div> : <SandboxCard state={state} />}</div>
        <div id="panel-cart" className="flex flex-col gap-3 rounded">
          <CartCard state={state} onApprove={onApprove} approving={approving} recorded={recorded} />
          <BomCard state={state} />
          <ProvisioningCard state={state} />
        </div>
        <div id="panel-live" tabIndex={-1} className="rounded focus-visible:outline-2 focus-visible:outline-gold"><LiveUrlCard state={state} scripted={mode === 'demo'} /></div>
      </div>
    </div>
    {state.liveUrl && <button type="button" onClick={() => flashPanel('live')} aria-label="Link — show live URL at bottom" title="Show the link at the bottom of the side panel" className="fixed bottom-4 right-5 z-50 flex items-center gap-2 rounded-full border border-gold/60 bg-gold px-4 py-2 text-sm font-semibold text-on-gold shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
      Link <ArrowDown className="size-4" aria-hidden="true" />
    </button>}
    </div>
  )
}
