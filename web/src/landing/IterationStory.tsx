// Scroll-driven "one run, four attempts" story. The chart and the attempt cards share
// one progress value: as the reader scrolls, each attempt computes (bar + ticking
// numbers), its point lands on the chart, failures get crossed out, and dots carry
// the run to the next attempt. At the end everything stays in its final state.
import { useEffect, useRef, useState } from 'react'
import { useMotionValueEvent, useScroll } from 'motion/react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DotProps, ScatterShapeProps } from 'recharts'
import { cn } from '@/lib/utils'
import { BorderBeam } from '@/components/ui/border-beam'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'

type Status = 'fail' | 'over' | 'chosen'
type Attempt = { label: string; title: string; cost: number; ms: number; users: number; status: Status; verdict: string }

const ATTEMPTS: Attempt[] = [
  { label: 'Attempt 1', title: 'SQLite + free host', cost: 0, ms: 2100, users: 800, status: 'fail', verdict: 'Falls over at 800 users' },
  { label: 'Attempt 2', title: 'Postgres + VM', cost: 48, ms: 90, users: 1000, status: 'over', verdict: 'Fast, but $18 over budget' },
  { label: 'Attempt 3', title: 'Postgres + edge, no cache', cost: 22, ms: 1400, users: 1000, status: 'fail', verdict: 'p95 1.4 s under load' },
  { label: 'Chosen', title: 'Postgres + edge + Redis', cost: 27.4, ms: 140, users: 1000, status: 'chosen', verdict: '$2.60 under budget' },
]

// Chart domain (sqrt y scale keeps 90 ms and 2 s both readable).
const MAX_COST = 60, MAX_MS = 2400, BUDGET = 30, TARGET = 200
const X_TICKS = [0, 15, 30, 45, 60]
const Y_TICKS = [0, 100, 200, 500, 1000, 2000]
const formatCost = (v: number) => `$${v}`
const formatMs = (v: number) => (v >= 1000 ? `${v / 1000}s` : `${v}`)
// sqrt-scale fraction <-> ms, used to ease the probe along the same curve the
// y-axis itself draws (see Chart() below).
const toFraction = (ms: number) => Math.sqrt(Math.min(ms, MAX_MS) / MAX_MS)
const fromFraction = (u: number) => u * u * MAX_MS

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const START = 0.06, SEG = 0.215 // four segments, ending at ~0.92 so the final state holds
const local = (p: number, i: number) => clamp((p - (START + i * SEG)) / (SEG * 0.8))

function useProgress(ref: React.RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0)
  const [static_, setStatic] = useState(false)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => setP(v))
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px), (prefers-reduced-motion: reduce)')
    const on = () => setStatic(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return static_ ? 1 : p
}

type PlotPoint = {
  x: number
  y: number
  label: string
  title: string
  cost: number
  ms: number
  status: Status
  verdict: string
}

// Per-point label placement keeps labels off the dashed budget/target lines.
const LABEL_PLACEMENT: Record<string, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = {
  'Attempt 1': { dx: 12, dy: -8, anchor: 'start' },
  'Attempt 2': { dx: 0, dy: 22, anchor: 'middle' },
  'Attempt 3': { dx: -12, dy: -8, anchor: 'end' },
  Chosen: { dx: -12, dy: 20, anchor: 'end' },
}

function PointMark(props: ScatterShapeProps) {
  const { cx, cy, payload } = props as unknown as { cx?: number; cy?: number; payload: PlotPoint }
  if (cx == null || cy == null) return null
  const color = payload.status === 'chosen' ? 'var(--color-gold)' : payload.status === 'fail' ? 'var(--color-bad)' : 'var(--color-muted)'
  const lp = LABEL_PLACEMENT[payload.label] ?? { dx: 10, dy: -8, anchor: 'start' as const }
  return (
    <g className="bb-pop">
      {payload.status === 'fail' ? (
        <g stroke={color} strokeWidth={2.2} strokeLinecap="round">
          <line x1={cx - 5} x2={cx + 5} y1={cy - 5} y2={cy + 5} />
          <line x1={cx - 5} x2={cx + 5} y1={cy + 5} y2={cy - 5} />
        </g>
      ) : payload.status === 'chosen' ? (
        <>
          <circle cx={cx} cy={cy} r={11} fill="none" stroke={color} opacity={0.45} className="bb-ring" />
          <circle cx={cx} cy={cy} r={6} fill={color} />
        </>
      ) : (
        <circle cx={cx} cy={cy} r={5.5} fill="none" stroke={color} strokeWidth={2} />
      )}
      <text x={cx + lp.dx} y={cy + lp.dy} fontSize={12} fontWeight={600} fill="var(--color-ink)" textAnchor={lp.anchor}>
        {payload.label}
      </text>
    </g>
  )
}

function ProbeMark({ cx, cy }: DotProps) {
  if (cx == null || cy == null) return <g />
  return (
    <g>
      <circle cx={cx} cy={cy} r={14} fill="var(--color-blue)" opacity={0.15} />
      <circle cx={cx} cy={cy} r={4.5} fill="var(--color-blue-soft)" />
    </g>
  )
}

function Chart({ p }: { p: number }) {
  const done = ATTEMPTS.map((_, i) => local(p, i) >= 1)
  const activeIdx = ATTEMPTS.findIndex((_, i) => local(p, i) > 0 && local(p, i) < 1)
  const points: PlotPoint[] = ATTEMPTS.map((a) => ({
    x: a.cost,
    y: a.ms,
    label: a.label,
    title: a.title,
    cost: a.cost,
    ms: a.ms,
    status: a.status,
    verdict: a.verdict,
  }))
  const finished = points.filter((_, i) => done[i])

  // Probe eases between attempts in the same sqrt-fraction space the y-axis
  // scales by, so its path on screen is a straight line regardless of how
  // curved the ms domain looks once the sqrt scale maps it to pixels.
  let probe: { x: number; y: number } | null = null
  if (activeIdx >= 0) {
    const t = local(p, activeIdx)
    const e = 1 - Math.pow(1 - t, 3)
    const from = activeIdx === 0 ? { cost: 0, u: 0 } : { cost: points[activeIdx - 1].cost, u: toFraction(points[activeIdx - 1].ms) }
    const to = { cost: points[activeIdx].cost, u: toFraction(points[activeIdx].ms) }
    probe = { x: from.cost + (to.cost - from.cost) * e, y: fromFraction(from.u + (to.u - from.u) * e) }
  }

  return (
    <ChartContainer aspect={560 / 380}>
      <ComposedChart
        margin={{ top: 22, right: 16, bottom: 26, left: 14 }}
        role="img"
        title="Cost versus p95 latency for each attempt"
        desc="Scatter of monthly cost against p95 latency for four attempts. The chosen stack lands under both the budget and the latency target."
      >
        <CartesianGrid horizontal vertical={false} stroke="var(--color-line)" strokeOpacity={0.55} />
        <XAxis
          type="number"
          dataKey="x"
          domain={[0, MAX_COST]}
          ticks={X_TICKS}
          tickFormatter={formatCost}
          tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-line)', strokeWidth: 1.5 }}
          label={{ value: 'monthly cost', position: 'insideBottom', offset: -4, fill: 'var(--color-muted)', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          scale="sqrt"
          domain={[0, MAX_MS]}
          ticks={Y_TICKS}
          tickFormatter={formatMs}
          tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
          tickLine={false}
          width={46}
          axisLine={{ stroke: 'var(--color-line)', strokeWidth: 1.5 }}
          label={{ value: 'p95 latency', angle: -90, position: 'insideLeft', offset: 12, fill: 'var(--color-muted)', fontSize: 11 }}
        />

        {/* the passing region: under budget and under target */}
        <ReferenceArea x1={0} x2={BUDGET} y1={0} y2={TARGET} fill="var(--color-gold)" fillOpacity={0.06} stroke="none" />
        <ReferenceLine
          x={BUDGET}
          stroke="var(--color-gold)"
          strokeDasharray="5 5"
          strokeWidth={1.5}
          label={{ value: '$30 budget', position: 'insideTopRight', fill: 'var(--color-gold)', fontSize: 11 }}
        />
        <ReferenceLine
          y={TARGET}
          stroke="var(--color-blue)"
          strokeDasharray="5 5"
          strokeWidth={1.5}
          label={{ value: '200 ms target', position: 'insideTopRight', fill: 'var(--color-blue-soft)', fontSize: 11 }}
        />

        <Line
          data={finished}
          dataKey="y"
          type="linear"
          stroke="var(--color-muted)"
          strokeOpacity={0.45}
          strokeWidth={2}
          strokeDasharray="2 6"
          strokeLinecap="round"
          dot={false}
          isAnimationActive={false}
          legendType="none"
        />
        <Scatter data={finished} dataKey="y" shape={PointMark} isAnimationActive={false} legendType="none" />
        {probe && <ReferenceDot x={probe.x} y={probe.y} shape={ProbeMark} ifOverflow="visible" />}

        <Tooltip
          cursor={{ stroke: 'var(--color-line)', strokeDasharray: '3 3' }}
          content={({ active, payload }) => (
            <ChartTooltipContent<PlotPoint>
              active={active}
              payload={payload as unknown as ReadonlyArray<{ payload: PlotPoint }> | undefined}
              render={(pt) => ({
                title: `${pt.label} — ${pt.title}`,
                rows: [
                  { label: '$/mo', value: `$${pt.cost.toFixed(pt.cost % 1 ? 2 : 0)}` },
                  { label: 'p95', value: pt.ms >= 1000 ? `${(pt.ms / 1000).toFixed(1)}s` : `${pt.ms} ms` },
                  { label: 'verdict', value: pt.verdict, accent: pt.status === 'chosen' },
                ],
              })}
            />
          )}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

function AttemptRow({ a, t, last }: { a: Attempt; t: number; last: boolean }) {
  const queued = t <= 0
  const computing = t > 0 && t < 1
  const done = t >= 1
  const crossed = done && a.status !== 'chosen'
  const chosen = done && a.status === 'chosen'
  const e = 1 - Math.pow(1 - t, 2)
  const msNow = Math.round(a.ms * e)
  const usersNow = Math.round(a.users * e)
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border px-4 py-3.5 transition-[opacity,border-color,background-color] duration-500',
        queued && 'border-dashed border-line/70 bg-transparent opacity-45',
        computing && 'border-blue/60 bg-surface',
        crossed && 'border-line bg-surface/60 opacity-60',
        chosen && 'border-gold bg-surface shadow-[0_0_0_1px_var(--color-gold),0_12px_40px_-12px_rgba(233,185,73,0.35)]',
        !last && 'mb-0'
      )}
    >
      {chosen && <BorderBeam size={90} duration={7} colorFrom="#e9b949" colorTo="#635bff" />}
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('text-[11px] font-medium uppercase tracking-[0.12em]', chosen ? 'text-gold' : 'text-muted')}>{a.label}</span>
        <span className="text-sm tabular-nums text-muted">${a.cost.toFixed(a.cost % 1 ? 2 : 0)}/mo</span>
      </div>
      <div className={cn('mt-1 font-semibold text-ink', crossed && 'line-through decoration-bad/70 decoration-2')}>{a.title}</div>
      <div className="mt-2 h-5 text-sm tabular-nums">
        {queued && <span className="text-muted/70">Queued</span>}
        {computing && (
          <span className="text-blue-soft">
            Load testing… {usersNow.toLocaleString()} users · p95 {msNow} ms
          </span>
        )}
        {done && (
          <span className={a.status === 'chosen' ? 'text-gold' : a.status === 'fail' ? 'text-bad' : 'text-muted'}>
            {a.status === 'chosen' ? '✓ ' : '✕ '}
            {a.verdict}
            {a.status !== 'fail' && ` · p95 ${a.ms} ms`}
          </span>
        )}
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-line/60">
        <div
          className={cn('h-full rounded-full', done ? (a.status === 'chosen' ? 'bg-gold' : a.status === 'fail' ? 'bg-bad/70' : 'bg-muted/60') : 'bg-blue')}
          style={{ width: `${Math.round(t * 100)}%` }}
        />
      </div>
    </div>
  )
}

function Dots({ p, i }: { p: number; i: number }) {
  // Lights up between attempt i finishing and attempt i+1 starting.
  const from = START + i * SEG + SEG * 0.8
  const to = START + (i + 1) * SEG
  const t = clamp((p - from) / Math.max(0.0001, to - from))
  return (
    <div className="flex h-6 flex-col items-center justify-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((k) => (
        <span key={k} className={cn('h-1 w-1 rounded-full transition-colors duration-300', t > (k + 0.5) / 3 ? 'bg-gold' : 'bg-line')} />
      ))}
    </div>
  )
}

export function IterationStory() {
  const ref = useRef<HTMLElement>(null)
  const p = useProgress(ref)
  const step = Math.min(4, ATTEMPTS.filter((_, i) => local(p, i) >= 1).length)
  return (
    <section ref={ref} id="fig-01" className="relative border-b border-line lg:h-[300vh]">
      <div className="lg:sticky lg:top-16 lg:flex lg:h-[calc(100svh-4rem)] lg:items-center">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-0">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-gold">One run, four attempts</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Watch the agent search, measure and choose.</h2>
            </div>
            <p className="text-sm tabular-nums text-muted">
              {step < 4 ? `Attempt ${Math.min(step + 1, 4)} of 4` : 'Chosen: under budget and under target'}
            </p>
          </div>
          <div className="grid items-center gap-8 lg:grid-cols-[1.25fr_1fr]">
            <figure className="m-0 rounded-lg border border-line bg-surface/70 p-4 sm:p-5">
              <Chart p={p} />
              <figcaption className="mt-2 text-xs text-muted">Fig. 01 · Stacks tried for a 1,000-user waitlist app. Example run; in the product every number comes from a sandbox run you can open.</figcaption>
            </figure>
            <div>
              {ATTEMPTS.map((a, i) => (
                <div key={a.label}>
                  <AttemptRow a={a} t={local(p, i)} last={i === ATTEMPTS.length - 1} />
                  {i < ATTEMPTS.length - 1 && <Dots p={p} i={i} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
