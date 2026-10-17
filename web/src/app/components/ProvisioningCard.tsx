import { ListChecks, Check, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RunState } from '../state/reducer'

export function ProvisioningCard({ state }: { state: RunState }) {
  if (state.provisioning.length === 0) return null

  return (
    <Card className="border-line bg-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <ListChecks className="size-4 text-blue" /> Provisioning
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {state.provisioning.map((p) => (
          <div key={p.service.serviceId} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {p.status === 'done' && <Check className="size-3.5 shrink-0 text-blue" />}
              {p.status === 'started' && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted" />}
              {p.status === 'failed' && <AlertTriangle className="size-3.5 shrink-0 text-bad" />}
              <span className={cn('font-mono text-xs', p.status === 'done' ? 'text-ink' : 'text-muted')}>{p.command}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
