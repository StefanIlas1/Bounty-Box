import { Badge } from '@/components/ui/badge'
import { Check, AlertTriangle, Wallet, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PillStatus = 'passed' | 'failed' | 'over_budget' | 'pending'

const CONFIG: Record<PillStatus, { label: string; icon: typeof Check; className: string }> = {
  passed: { label: 'Passed', icon: Check, className: 'bg-blue/15 text-blue border-blue/30' },
  failed: { label: 'Failed', icon: AlertTriangle, className: 'bg-bad/15 text-bad border-bad/30' },
  over_budget: { label: 'Over budget', icon: Wallet, className: 'bg-bad/15 text-bad border-bad/30' },
  pending: { label: 'Running', icon: Loader2, className: 'bg-muted text-muted-foreground border-border' },
}

export function StatusPill({ status, className }: { status: PillStatus; className?: string }) {
  const cfg = CONFIG[status]
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className={cn('gap-1 font-sans', cfg.className, className)}>
      <Icon className={cn('size-3', status === 'pending' && 'animate-spin')} />
      {cfg.label}
    </Badge>
  )
}
