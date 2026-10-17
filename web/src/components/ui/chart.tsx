// Small shadcn-style recharts wrapper: a fixed-aspect container so layout never
// jumps while the parent resizes, plus a tooltip shell themed with brand tokens.
import * as React from 'react'
import { ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

type ChartContainerProps = {
  children: React.ReactElement
  /** width / height, matching the chart's natural proportions. */
  aspect?: number
  className?: string
}

export function ChartContainer({ children, aspect = 560 / 380, className }: ChartContainerProps) {
  return (
    <div className={cn('w-full overflow-hidden', className)} style={{ aspectRatio: aspect }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export type ChartTooltipRow = { label: string; value: React.ReactNode; accent?: boolean }

/**
 * Generic tooltip shell for recharts `content`. Pass `render` to turn the
 * hovered/focused payload into a title + rows; returning null hides the tooltip.
 */
export function ChartTooltipContent<T>({
  active,
  payload,
  render,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: T }>
  render: (payload: T) => { title: string; rows: ChartTooltipRow[] } | null
}) {
  if (!active || !payload?.length) return null
  const info = render(payload[0].payload)
  if (!info) return null
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg shadow-black/30">
      <div className="font-sans font-semibold text-ink">{info.title}</div>
      <dl className="mt-1 space-y-0.5 font-mono tabular-nums">
        {info.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="text-muted">{row.label}</dt>
            <dd className={row.accent ? 'text-gold' : 'text-ink'}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
