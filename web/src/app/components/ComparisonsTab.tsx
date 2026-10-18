import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusPill, type PillStatus } from './StatusPill'
import type { Mode } from '../../shared/types'
import type { RunState } from '../state/reducer'

export function ComparisonsTab({ state, mode = 'demo' }: { state: RunState; mode?: Mode }) {
  const rows = state.stackOrder.map((id) => state.stacks[id])

  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">No stacks tried yet.</div>
  }

  return (
    <div className="h-full min-w-0 overflow-auto rounded border border-line bg-surface-2">
      <Table className="min-w-[540px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[16%]">Stack</TableHead>
            <TableHead className="w-[27%]">Services</TableHead>
            <TableHead className="w-[9%]">p95</TableHead>
            <TableHead className="w-[10%]">Error rate</TableHead>
            <TableHead className="w-[12%]">{mode === 'live' ? 'Concurrency' : 'Users'}</TableHead>
            <TableHead className="w-[9%]">$/mo</TableHead>
            <TableHead className="w-[17%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const last = s.loadResults[s.loadResults.length - 1]
            return (
              <TableRow key={s.stack.id}>
                <TableCell className="truncate font-semibold">
                  {s.stack.id} <span className="font-sans text-xs text-muted">{s.stack.label}</span>
                </TableCell>
                <TableCell
                  className="truncate font-mono text-xs text-muted"
                  title={s.stack.services.map((svc) => svc.serviceId).join(', ')}
                >
                  {s.stack.services.map((svc) => svc.serviceId).join(', ')}
                </TableCell>
                <TableCell className="truncate font-mono">{last ? `${last.p95Ms}ms` : '—'}</TableCell>
                <TableCell className="truncate font-mono">{last ? `${(last.errorRate * 100).toFixed(1)}%` : '—'}</TableCell>
                <TableCell className="truncate font-mono">{last ? last.users.toLocaleString() : '—'}</TableCell>
                <TableCell className="truncate font-mono">{s.monthlyCost != null ? `$${s.monthlyCost.toFixed(2)}` : '—'}</TableCell>
                <TableCell className="truncate">{s.status ? <StatusPill status={s.status as PillStatus} /> : <StatusPill status="pending" />}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {mode === 'live' && <p className="border-t border-line px-4 py-3 text-xs text-muted">Concurrency is the tested number of simultaneous requests, not verified user capacity. Results come from this run; no performance estimate is substituted for a failed test.</p>}
      {!!state.bom?.length && <section className="border-t border-line p-4" aria-label="Hardware comparison">
        <h3 className="mb-2 text-sm font-semibold">Hardware · one-time costs</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Unit price</TableHead><TableHead>One-time total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{state.bom.map((item, index) => <TableRow key={`${item.name}-${index}`}>
            <TableCell className="whitespace-normal font-medium">{item.name}</TableCell>
            <TableCell>{item.qty}</TableCell><TableCell>${item.unitPriceUsd.toFixed(2)}</TableCell>
            <TableCell>${(item.qty * item.unitPriceUsd).toFixed(2)}</TableCell><TableCell>Selected · demo</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        <p className="mt-3 text-sm">Hardware subtotal: <strong>${state.bomOneTimeCostUsd.toFixed(2)} one-time</strong></p>
        <p className="mt-1 text-xs text-muted">Added to the monthly software services above. Example USD prices; shipping and tax excluded. No physical hardware benchmark is claimed.</p>
      </section>}

    </div>
  )
}
