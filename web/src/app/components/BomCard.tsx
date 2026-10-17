import { Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RunState } from '../state/reducer'

export function BomCard({ state }: { state: RunState }) {
  if (!state.bom || state.bom.length === 0) return null

  return (
    <Card className="border-line bg-surface">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-display text-base">
          <span className="flex items-center gap-2">
            <Cpu className="size-4 text-gold" /> Bill of materials
          </span>
          <span className="text-[10px] font-normal text-muted">Example prices</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-sm">
        {state.bom.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-2 font-mono text-xs">
            <span className="truncate text-ink">
              {item.qty}× {item.name}
            </span>
            <span className="shrink-0 text-muted">
              ${item.unitPriceUsd.toFixed(2)} · {item.supplier}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-line pt-2">
          <span className="text-xs text-muted">Subtotal (one-time)</span>
          <span className="font-display text-base font-semibold text-ink">${state.bomOneTimeCostUsd.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
