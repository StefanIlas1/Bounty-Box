import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Logo } from '../../shared/Logo'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Mode } from '../../shared/types'

interface TopBarProps {
  mode: Mode
  onModeChange: (m: Mode) => void
  reachable: boolean | null
  fixtureRun: boolean
  simulated: boolean
  onNewRun: () => void
}

export function TopBar({ mode, onModeChange, reachable, fixtureRun, simulated, onNewRun }: TopBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-3">
      <Link to="/" className="shrink-0">
        <Logo size={20} />
      </Link>

      <div className="flex flex-1 items-center justify-center gap-3">
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && onModeChange(v as Mode)} size="sm">
          <ToggleGroupItem value="demo">Demo</ToggleGroupItem>
          <ToggleGroupItem value="live">Live</ToggleGroupItem>
        </ToggleGroup>
        {mode === 'demo' && <Badge variant="outline" className="border-gold/40 text-gold">Scripted demo · simulated purchases and benchmarks</Badge>}
        {fixtureRun && <Badge variant="outline" className="border-gold/40 text-gold">Fixture run (backend test data)</Badge>}
        {simulated && <Badge variant="outline" className="border-bad/40 text-bad">Simulated · catalog prices</Badge>}
      </div>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/">Back to site</Link></Button>
        {mode === 'live' && reachable === false && (
          <Button asChild size="sm" variant="outline" className="border-gold/50 text-gold hover:bg-gold/10">
            <Link to="/waitlist">Join the waitlist</Link>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onNewRun} className="gap-1.5">
          <Plus className="size-3.5" /> New run
        </Button>
      </div>
    </div>
  )
}
