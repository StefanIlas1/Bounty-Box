import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Logo } from '../../shared/Logo'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
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
        {mode === 'demo' && <Badge variant="outline" className="border-gold/40 text-gold">Demo · scripted example run</Badge>}
        {fixtureRun && <Badge variant="outline" className="border-gold/40 text-gold">Fixture run (backend test data)</Badge>}
        {simulated && <Badge variant="outline" className="border-bad/40 text-bad">Simulated · catalog prices</Badge>}
      </div>

      <div className="flex items-center gap-2">
        {mode === 'live' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn('gap-1 font-sans', reachable === null ? 'border-line text-muted' : reachable ? 'border-blue/30 text-blue' : 'border-bad/30 text-bad')}
              >
                <span className={cn('size-1.5 rounded-full', reachable === null ? 'bg-muted' : reachable ? 'bg-blue' : 'bg-bad')} />
                Backend: 127.0.0.1:3000 via proxy
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{reachable === null ? 'checking…' : reachable ? 'reachable' : 'unreachable'}</TooltipContent>
          </Tooltip>
        )}
        <Button size="sm" variant="outline" onClick={onNewRun} className="gap-1.5">
          <Plus className="size-3.5" /> New run
        </Button>
      </div>
    </div>
  )
}
