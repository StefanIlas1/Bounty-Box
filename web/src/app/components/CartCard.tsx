import { ShoppingCart } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/ui/border-beam'
import { cn } from '@/lib/utils'
import type { RunState } from '../state/reducer'

export function CartCard({ state, onApprove, approving }: { state: RunState; onApprove: () => void; approving?: boolean }) {
  const stackId = state.awaitingApproval?.stackId ?? state.stackOrder.slice().reverse().find((id) => state.stacks[id]?.status === 'passed') ?? state.currentStackId
  const stack = stackId ? state.stacks[stackId] : null
  const budget = state.awaitingApproval?.budgetMonthly ?? state.brief?.budgetMonthly ?? 0
  const cost = state.awaitingApproval?.monthlyCost ?? stack?.monthlyCost ?? (stack ? stack.stack.services.reduce((sum, s) => sum + s.monthlyCost, 0) : 0)
  const pct = budget > 0 ? Math.min(100, (cost / budget) * 100) : 0
  const overBudget = budget > 0 && cost > budget
  const canApprove = state.phase === 'awaiting_approval' && !approving

  return (
    <Card className="relative border-line bg-surface">
      {canApprove && <BorderBeam size={60} duration={5} colorFrom="#e9b949" colorTo="#635bff" />}
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <ShoppingCart className="size-4 text-gold" /> Cart
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!stack ? (
          <p className="text-muted">Nothing selected yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {stack.stack.services.map((svc) => (
                <div key={svc.serviceId} className="flex items-center justify-between font-mono text-xs">
                  <span className="text-ink">{svc.serviceId}</span>
                  <span className="text-muted">{svc.monthlyCost === 0 ? 'free' : `$${svc.monthlyCost.toFixed(2)}/mo`}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-semibold text-ink">${cost.toFixed(2)}<span className="text-xs text-muted">/mo</span></span>
                <span className="text-xs text-muted">budget ${budget}/mo</span>
              </div>
              <Progress value={pct} className={cn(overBudget ? '[&>[data-slot=progress-indicator]]:bg-bad' : '[&>[data-slot=progress-indicator]]:bg-blue')} />
              <p className="text-[10px] text-muted">Budget tracks monthly cost only.</p>
            </div>
            {state.bomOneTimeCostUsd > 0 && (
              <div className="flex items-center justify-between rounded bg-surface-2 px-2.5 py-1.5 text-xs">
                <span className="text-muted">Hardware (one-time)</span>
                <span className="font-mono text-ink">${state.bomOneTimeCostUsd.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2">
        <Button onClick={onApprove} disabled={!canApprove} className="w-full bg-gold text-on-gold hover:bg-gold/85">
          {approving ? 'Approving…' : 'Approve'}
        </Button>
        <p className="text-center text-[11px] text-muted">Nothing is bought until you approve.</p>
      </CardFooter>
    </Card>
  )
}
