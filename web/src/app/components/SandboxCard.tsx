import { Server, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RunState } from '../state/reducer'

const STATE_LABEL: Record<string, string> = {
  created: 'Created',
  paused: 'Paused',
  resumed: 'Resumed',
  destroyed: 'Destroyed',
}

export function SandboxCard({ state }: { state: RunState }) {
  const sandbox = state.sandbox

  return (
    <Card className="border-line bg-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="size-4 text-blue" /> Sandbox
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!sandbox ? (
          <p className="text-muted">No sandbox yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">{sandbox.id}</span>
              <Badge
                variant="outline"
                className={cn(
                  'font-sans capitalize',
                  sandbox.state === 'paused' ? 'border-gold/40 text-gold' : 'border-blue/30 text-blue',
                )}
              >
                {STATE_LABEL[sandbox.state] ?? sandbox.state}
              </Badge>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted">
              <span>shape <span className="font-mono text-ink">s-1vcpu-1gb</span></span>
              <span>rootfs <span className="font-mono text-ink">devbox:1</span></span>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
                <Lock className="size-3" /> Egress allowlist
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sandbox.egress.length === 0 && <span className="text-xs text-muted">open (no allowlist set)</span>}
                {sandbox.egress.flatMap((e) => e.split(',').map((x) => x.trim()).filter(Boolean)).map((e) => (
                  <Badge key={e} variant="outline" className="h-auto max-w-full whitespace-normal break-all border-line font-mono text-[11px] text-ink">
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
