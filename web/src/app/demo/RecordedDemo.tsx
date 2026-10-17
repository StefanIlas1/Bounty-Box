import { Link } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Logo } from '../../shared/Logo'
import type { RunSnapshot } from '../../shared/backend'
import { initialRunState, runReducer } from '../state/reducer'
import { backendBriefToUiBrief, diffSnapshot } from '../live/snapshotAdapter'
import { BuildScreen } from '../screens/BuildScreen'
import recording from './verified-run.json'

const snapshot = recording.snapshot as RunSnapshot
let state = runReducer(initialRunState, { type: 'run_started', runId: snapshot.id, brief: backendBriefToUiBrief(snapshot.brief), at: 0 })
for (const event of diffSnapshot(null, snapshot)) state = runReducer(state, event)
for (const file of recording.files) state = runReducer(state, { type: 'file_written', stackId: snapshot.candidates[0].id, path: file.path, content: file.content, at: 0 })
// Preserve the final comparison view after adding the saved source files.
state = runReducer(state, { type: 'awaiting_approval', stackId: snapshot.candidates[0].id, monthlyCost: 0, budgetMonthly: snapshot.brief.monthlyBudgetUsd, at: 0 })

export default function RecordedDemo() {
  return <TooltipProvider>
    <div className="flex h-screen min-h-0 flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-3">
        <Link to="/"><Logo size={20} /></Link>
        <span className="rounded border border-gold/40 px-3 py-1 text-sm text-gold">Recorded real run · Demo</span>
        <Link to="/" className="text-sm text-muted">Back to home</Link>
      </header>
      <p className="border-b border-line px-5 py-2 text-sm text-muted">Explore the saved code, test logs and results. Revision 1 failed; the agent generated revision 2, which passed. Viewing this recording makes no model or sandbox calls.</p>
      <BuildScreen mode="live" state={state} onApprove={() => {}} recorded />
    </div>
  </TooltipProvider>
}
