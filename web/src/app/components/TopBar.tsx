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
  liveAvailable: boolean
  fixtureRun: boolean
  onNewRun: () => void
}

export function TopBar({ mode, onModeChange, liveAvailable, fixtureRun, onNewRun }: TopBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface px-3 py-3 sm:px-5">
      <Link to="/" className="shrink-0">
        <Logo size={20} />
      </Link>

      <div className="order-last flex w-full min-w-0 flex-wrap items-center justify-center gap-2 sm:order-none sm:w-auto sm:flex-1 sm:gap-3 empty:hidden">
        {liveAvailable && (
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && onModeChange(v as Mode)} size="sm">
            <ToggleGroupItem value="demo">Demo</ToggleGroupItem>
            <ToggleGroupItem value="live">Live</ToggleGroupItem>
          </ToggleGroup>
        )}
        {mode === 'demo' && <Badge variant="outline" className="max-w-full border-gold/40 text-gold"><span className="sm:hidden">Scripted demo</span><span className="hidden sm:inline">Scripted demo · simulated purchases and benchmarks</span></Badge>}
        {fixtureRun && <Badge variant="outline" className="max-w-full border-gold/40 text-gold">Fixture run (backend test data)</Badge>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/">Back to site</Link></Button>
        <Button size="sm" variant="outline" onClick={onNewRun} className="gap-1.5">
          <Plus className="size-3.5" /> New run
        </Button>
      </div>
    </div>
  )
}
