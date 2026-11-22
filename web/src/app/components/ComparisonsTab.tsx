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
    <div className="@container h-full min-w-0 overflow-auto rounded border border-line bg-surface-2">
      <ul className="divide-y divide-line @lg:hidden">
        {rows.map((s) => {
          const last = s.loadResults[s.loadResults.length - 1]
          const monthlyCost = s.monthlyCost ?? s.stack.services.reduce((total, service) => total + service.monthlyCost, 0)
          const metrics: [string, string][] = [
            ['p95', last ? `${last.p95Ms}ms` : '—'],
            ['Errors', last ? `${(last.errorRate * 100).toFixed(1)}%` : '—'],
            [mode === 'live' ? 'Concurrency' : 'Users', last ? last.users.toLocaleString() : '—'],
            ['$/mo', `$${monthlyCost.toFixed(2)}`],
          ]
          return (
            <li key={s.stack.id} className="space-y-2 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-semibold">{s.stack.id} <span className="font-sans text-xs font-normal text-muted">{s.stack.label}</span></div>
                {s.status ? <StatusPill status={s.status as PillStatus} /> : <StatusPill status="pending" />}
              </div>
              <div className="break-words font-mono text-xs text-muted">{s.stack.services.map((svc) => svc.serviceId).join(', ')}</div>
              <dl className="grid grid-cols-4 gap-2">
                {metrics.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="truncate text-[11px] text-muted">{label}</dt>
                    <dd className="font-mono text-xs tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          )
        })}
      </ul>
      <Table className="hidden @lg:table">
        <TableHeader>
          <TableRow>
            <TableHead>Stack</TableHead>
            <TableHead className="text-right">p95</TableHead>
            <TableHead className="text-right">Errors</TableHead>
            <TableHead className="text-right">{mode === 'live' ? 'Concurrency' : 'Users'}</TableHead>
            <TableHead className="text-right">$/mo</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const last = s.loadResults[s.loadResults.length - 1]
            const serviceList = s.stack.services.map((svc) => svc.serviceId).join(', ')
            const monthlyCost = s.monthlyCost ?? s.stack.services.reduce((total, service) => total + service.monthlyCost, 0)
            return (
              <TableRow key={s.stack.id} className="align-top">
                <TableCell className="min-w-[180px] whitespace-normal">
                  <div className="font-semibold">{s.stack.id} <span className="font-sans text-xs font-normal text-muted">{s.stack.label}</span></div>
                  <div className="mt-0.5 break-words font-mono text-xs text-muted">{serviceList}</div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{last ? `${last.p95Ms}ms` : '—'}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{last ? `${(last.errorRate * 100).toFixed(1)}%` : '—'}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{last ? last.users.toLocaleString() : '—'}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{`$${monthlyCost.toFixed(2)}`}</TableCell>
                <TableCell>{s.status ? <StatusPill status={s.status as PillStatus} /> : <StatusPill status="pending" />}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {mode === 'live' && <p className="border-t border-line px-4 py-3 text-xs text-muted">Pending rows show the selected plan and estimated base fee; AI and compute credits are additional. Performance stays blank until measured. Concurrency is the tested number of simultaneous requests, not verified user capacity. Results come from this run; no performance estimate is substituted for a failed test.</p>}
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
