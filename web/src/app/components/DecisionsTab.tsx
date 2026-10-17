import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RunState } from '../state/reducer'

export function DecisionsTab({ state }: { state: RunState }) {
  if (state.decisions.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">No decisions made yet.</div>
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3">
        {state.decisions.map((d) => (
          <Card key={d.requirement} className="border-line bg-surface-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base capitalize">
                {d.requirement}
                <Badge variant="outline" className="border-blue/30 text-blue">
                  {d.chosen}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {d.alternatives.map((alt) => (
                <div key={alt.name} className="flex flex-col gap-0.5 rounded bg-surface px-2.5 py-1.5">
                  <span className="font-medium text-muted">{alt.name}</span>
                  <span className="text-xs text-muted">{alt.why}</span>
                </div>
              ))}
              <p className="mt-1 font-mono text-xs text-muted">evidence: {d.evidence}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}
