import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusPill, type PillStatus } from './StatusPill'
import type { RunState } from '../state/reducer'

export function ComparisonsTab({ state }: { state: RunState }) {
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
            <TableHead className="w-[12%]">Users</TableHead>
            <TableHead className="w-[9%]">$/mo</TableHead>
            <TableHead className="w-[17%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const last = s.loadResults[s.loadResults.length - 1]
            const bestUsers = s.loadResults.reduce((max, r) => (r.passed && r.users > max ? r.users : max), 0)
            return (
              <TableRow key={s.stack.id}>
                <TableCell className="truncate font-display font-semibold">
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
                <TableCell className="truncate font-mono">{last ? (last.passed ? last.users.toLocaleString() : `~${bestUsers || Math.round(last.users * 0.8)}`) : '—'}</TableCell>
                <TableCell className="truncate font-mono">{s.monthlyCost != null ? `$${s.monthlyCost.toFixed(2)}` : '—'}</TableCell>
                <TableCell className="truncate">{s.status ? <StatusPill status={s.status as PillStatus} /> : <StatusPill status="pending" />}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
