// Scroll-driven "one run, four attempts" story. The chart and the attempt cards share
// one progress value: as the reader scrolls, each attempt computes (bar + ticking
// numbers), its point lands on the chart, failures get crossed out, and dots carry
// the run to the next attempt. At the end everything stays in its final state.
import { useEffect, useRef, useState } from 'react'
import { useMotionValueEvent, useScroll } from 'motion/react'
import { cn } from '@/lib/utils'
import { BorderBeam } from '@/components/ui/border-beam'

type Status = 'fail' | 'over' | 'chosen'
type Attempt = { label: string; title: string; cost: number; ms: number; users: number; status: Status; verdict: string }

const ATTEMPTS: Attempt[] = [
  { label: 'Attempt 1', title: 'SQLite + free host', cost: 0, ms: 2100, users: 800, status: 'fail', verdict: 'Falls over at 800 users' },
  { label: 'Attempt 2', title: 'Postgres + VM', cost: 48, ms: 90, users: 1000, status: 'over', verdict: 'Fast, but $18 over budget' },
  { label: 'Attempt 3', title: 'Postgres + edge, no cache', cost: 22, ms: 1400, users: 1000, status: 'fail', verdict: 'p95 1.4 s under load' },
  { label: 'Chosen', title: 'Postgres + edge + Redis', cost: 27.4, ms: 140, users: 1000, status: 'chosen', verdict: '$2.60 under budget' },
]

// Chart geometry (sqrt y scale keeps 90 ms and 2 s both readable).
const W = 560, H = 380, PL = 56, PR = 20, PT = 24, PB = 44
const PW = W - PL - PR, PH = H - PT - PB
const MAX_COST = 60, MAX_MS = 2400, BUDGET = 30, TARGET = 200
const xFor = (c: number) => PL + (c / MAX_COST) * PW
const yFor = (ms: number) => PT + PH - Math.sqrt(Math.min(ms, MAX_MS) / MAX_MS) * PH

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

function Chart({ p }: { p: number }) {
  const done = ATTEMPTS.map((_, i) => local(p, i) >= 1)
  const activeIdx = ATTEMPTS.findIndex((_, i) => local(p, i) > 0 && local(p, i) < 1)
  const pts = ATTEMPTS.map((a) => ({ x: xFor(a.cost), y: yFor(a.ms) }))
  const trail = pts.filter((_, i) => done[i])
  let probe: { x: number; y: number } | null = null
  if (activeIdx >= 0) {
    const t = local(p, activeIdx)
    const from = activeIdx === 0 ? { x: xFor(0), y: yFor(0) } : pts[activeIdx - 1]
    const to = pts[activeIdx]
    const e = 1 - Math.pow(1 - t, 3)
    probe = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Cost versus p95 latency for each attempt">
      {[0, 100, 200, 500, 1000, 2000].map((ms) => (
        <g key={ms}>
          <line x1={PL} x2={W - PR} y1={yFor(ms)} y2={yFor(ms)} stroke="var(--color-line)" opacity={0.55} />
          <text x={PL - 10} y={yFor(ms) + 4} fontSize={11} fill="var(--color-muted)" textAnchor="end" className="tabular-nums">{ms >= 1000 ? `${ms / 1000}s` : `${ms}`}</text>
        </g>
      ))}
      {[0, 15, 30, 45, 60].map((c) => (
        <text key={c} x={xFor(c)} y={PT + PH + 20} fontSize={11} fill="var(--color-muted)" textAnchor="middle" className="tabular-nums">${c}</text>
      ))}
      <text x={PL + PW / 2} y={H - 6} fontSize={11} fill="var(--color-muted)" textAnchor="middle">monthly cost</text>
      <text x={14} y={PT + PH / 2} fontSize={11} fill="var(--color-muted)" textAnchor="middle" transform={`rotate(-90 14 ${PT + PH / 2})`}>p95 latency (ms)</text>
      <line x1={PL} x2={W - PR} y1={PT + PH} y2={PT + PH} stroke="var(--color-line)" strokeWidth={1.5} />
      <line x1={PL} x2={PL} y1={PT} y2={PT + PH} stroke="var(--color-line)" strokeWidth={1.5} />

      {/* the passing region: under budget and under target */}
      <rect x={PL} y={yFor(TARGET)} width={xFor(BUDGET) - PL} height={PT + PH - yFor(TARGET)} fill="var(--color-gold)" opacity={0.06} />
      <line x1={xFor(BUDGET)} x2={xFor(BUDGET)} y1={PT} y2={PT + PH} stroke="var(--color-gold)" strokeDasharray="5 5" strokeWidth={1.5} />
      <text x={xFor(BUDGET) + 6} y={PT + 12} fontSize={11} fill="var(--color-gold)">$30 budget</text>
      <line x1={PL} x2={W - PR} y1={yFor(TARGET)} y2={yFor(TARGET)} stroke="var(--color-blue)" strokeDasharray="5 5" strokeWidth={1.5} />
      <text x={W - PR - 4} y={yFor(TARGET) - 7} fontSize={11} fill="var(--color-blue-soft)" textAnchor="end">200 ms target</text>

      {trail.length > 1 && (
        <polyline points={trail.map((t) => `${t.x},${t.y}`).join(' ')} fill="none" stroke="var(--color-muted)" strokeOpacity={0.45} strokeDasharray="2 6" strokeLinecap="round" strokeWidth={2} />
      )}

      {ATTEMPTS.map((a, i) => {
        if (!done[i]) return null
        const { x, y } = pts[i]
        const color = a.status === 'chosen' ? 'var(--color-gold)' : a.status === 'fail' ? 'var(--color-bad)' : 'var(--color-muted)'
        // per-point label placement keeps labels off the dashed budget/target lines
        const place: Record<string, { dx: number; dy: number; end: boolean }> = {
          'Attempt 1': { dx: 12, dy: -8, end: false },
          'Attempt 2': { dx: 0, dy: 22, end: false },
          'Attempt 3': { dx: -12, dy: -8, end: true },
          Chosen: { dx: -12, dy: 20, end: true },
        }
        const lp = place[a.label]
        return (
          <g key={a.label} className="bb-pop">
            {a.status === 'fail' ? (
              <g stroke={color} strokeWidth={2.2} strokeLinecap="round">
                <line x1={x - 5} x2={x + 5} y1={y - 5} y2={y + 5} />
                <line x1={x - 5} x2={x + 5} y1={y + 5} y2={y - 5} />
              </g>
            ) : a.status === 'chosen' ? (
              <>
                <circle cx={x} cy={y} r={11} fill="none" stroke={color} opacity={0.45} className="bb-ring" />
                <circle cx={x} cy={y} r={6} fill={color} />
              </>
            ) : (
              <circle cx={x} cy={y} r={5.5} fill="none" stroke={color} strokeWidth={2} />
            )}
            <text x={x + lp.dx} y={y + lp.dy} fontSize={12} fontWeight={600} fill="var(--color-ink)" textAnchor={lp.dx === 0 ? 'middle' : lp.end ? 'end' : 'start'}>{a.label}</text>
          </g>
        )
      })}

      {probe && (
        <g>
          <circle cx={probe.x} cy={probe.y} r={14} fill="var(--color-blue)" opacity={0.15} />
          <circle cx={probe.x} cy={probe.y} r={4.5} fill="var(--color-blue-soft)" />
        </g>
      )}
    </svg>
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
