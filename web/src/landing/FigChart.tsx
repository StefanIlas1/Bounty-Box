// Hand-built SVG scatter chart. No chart library.
// x = monthly cost ($0-60), y = p95 latency (ms, 0-1600, sqrt scale so the
// spread between 90ms / 140ms / 1400ms stays legible).

const W = 680
const H = 420
const PAD_L = 76
const PAD_R = 24
const PAD_T = 28
const PAD_B = 54
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B

const MAX_COST = 60
const MAX_MS = 1600

const xFor = (cost: number) => PAD_L + (cost / MAX_COST) * PLOT_W
const yFor = (ms: number) => PAD_T + PLOT_H - Math.sqrt(ms / MAX_MS) * PLOT_H

const X_TICKS = [0, 15, 30, 45, 60]
const Y_TICKS = [0, 100, 200, 400, 800, 1600]

const BUDGET = 30
const TARGET_MS = 200

type Point = {
  n: number
  title: string
  detail: string
  cost: number
  ms: number | null // null = off-scale failure, pinned to the top edge
  status: 'fail' | 'over' | 'chosen'
  note: string
  labelDx?: number
  labelDy?: number
}

const POINTS: Point[] = [
  {
    n: 1,
    title: 'Attempt 1',
    detail: 'SQLite + free host',
    cost: 0,
    ms: null,
    status: 'fail',
    note: 'fails at 800 users',
    labelDx: 14,
    labelDy: 16,
  },
  {
    n: 2,
    title: 'Attempt 2',
    detail: 'Postgres + VM',
    cost: 48,
    ms: 90,
    status: 'over',
    note: 'p95 90ms · $48/mo, over budget',
    labelDx: 12,
    labelDy: -24,
  },
  {
    n: 3,
    title: 'Attempt 3',
    detail: 'Postgres + edge, no cache',
    cost: 22,
    ms: 1400,
    status: 'fail',
    note: 'p95 1.4s · too slow',
    labelDx: -90,
    labelDy: 44,
  },
  {
    n: 4,
    title: 'Chosen',
    detail: 'Postgres + edge + Redis',
    cost: 27.4,
    ms: 140,
    status: 'chosen',
    note: 'p95 140ms · $27.40/mo',
    labelDx: 12,
    labelDy: 18,
  },
]

export function FigChart() {
  return (
    <figure className="m-0">
      <div className="overflow-x-auto rounded-md border border-line bg-surface p-4 sm:p-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto h-auto w-full max-w-[680px]"
          role="img"
          aria-labelledby="fig01-title fig01-desc"
        >
          <title id="fig01-title">Fig. 01 — Stacks tried for a 1,000-user waitlist app</title>
          <desc id="fig01-desc">
            Scatter chart plotting monthly cost against p95 latency for four attempted stacks. The
            chosen stack, Postgres plus edge plus Redis, lands under the $30 budget line and under
            the 200 millisecond target line; two earlier attempts fail those lines.
          </desc>

          {/* gridlines */}
          {Y_TICKS.map((ms) => (
            <line
              key={`gy-${ms}`}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yFor(ms)}
              y2={yFor(ms)}
              stroke="var(--color-line)"
              strokeWidth={1}
              opacity={0.6}
            />
          ))}

          {/* axes */}
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke="var(--color-line)" strokeWidth={1.5} />
          <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + PLOT_H} stroke="var(--color-line)" strokeWidth={1.5} />

          {/* budget line ($30, gold, vertical) */}
          <line
            x1={xFor(BUDGET)}
            x2={xFor(BUDGET)}
            y1={PAD_T}
            y2={PAD_T + PLOT_H}
            stroke="var(--color-gold)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
          <text x={xFor(BUDGET) + 6} y={PAD_T + 12} fontSize={11} fontFamily="var(--font-mono)" fill="var(--color-gold)">
            $30 budget
          </text>

          {/* target line (200ms, blue, horizontal) */}
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yFor(TARGET_MS)}
            y2={yFor(TARGET_MS)}
            stroke="var(--color-blue)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
          <text x={W - PAD_R - 6} y={yFor(TARGET_MS) - 8} fontSize={11} fontFamily="var(--font-mono)" fill="var(--color-blue-soft)" textAnchor="end">
            200ms target
          </text>

          {/* x ticks */}
          {X_TICKS.map((cost) => (
            <g key={`xt-${cost}`}>
              <line x1={xFor(cost)} x2={xFor(cost)} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H + 6} stroke="var(--color-muted)" strokeWidth={1} />
              <text x={xFor(cost)} y={PAD_T + PLOT_H + 22} fontSize={11} fontFamily="var(--font-mono)" fill="var(--color-muted)" textAnchor="middle">
                ${cost}
              </text>
            </g>
          ))}
          <text x={PAD_L + PLOT_W / 2} y={H - 8} fontSize={11} fontFamily="var(--font-mono)" fill="var(--color-muted)" textAnchor="middle">
            monthly cost
          </text>

          {/* y ticks */}
          {Y_TICKS.map((ms) => (
            <g key={`yt-${ms}`}>
              <line x1={PAD_L - 6} x2={PAD_L} y1={yFor(ms)} y2={yFor(ms)} stroke="var(--color-muted)" strokeWidth={1} />
              <text x={PAD_L - 10} y={yFor(ms) + 4} fontSize={11} fontFamily="var(--font-mono)" fill="var(--color-muted)" textAnchor="end">
                {ms}
              </text>
            </g>
          ))}
          <text
            x={18}
            y={PAD_T + PLOT_H / 2}
            fontSize={11}
            fontFamily="var(--font-mono)"
            fill="var(--color-muted)"
            textAnchor="middle"
            transform={`rotate(-90 18 ${PAD_T + PLOT_H / 2})`}
          >
            p95 latency (ms)
          </text>

          {/* points */}
          {POINTS.map((p) => {
            const cx = xFor(p.cost)
            const cy = p.ms === null ? PAD_T + 6 : yFor(p.ms)
            const color =
              p.status === 'chosen' ? 'var(--color-gold)' : p.status === 'fail' ? 'var(--color-bad)' : 'var(--color-muted)'
            return (
              <g key={p.n}>
                {p.status === 'fail' ? (
                  <g stroke={color} strokeWidth={2.2} strokeLinecap="round">
                    <line x1={cx - 5} x2={cx + 5} y1={cy - 5} y2={cy + 5} />
                    <line x1={cx - 5} x2={cx + 5} y1={cy + 5} y2={cy - 5} />
                  </g>
                ) : p.status === 'chosen' ? (
                  <>
                    <circle cx={cx} cy={cy} r={9} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
                    <circle cx={cx} cy={cy} r={5.5} fill={color} />
                  </>
                ) : (
                  <circle cx={cx} cy={cy} r={5.5} fill="var(--color-surface)" stroke={color} strokeWidth={2} />
                )}
                <text
                  x={cx + (p.labelDx ?? 10)}
                  y={cy + (p.labelDy ?? -8)}
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                  fontWeight={p.status === 'chosen' ? 600 : 500}
                  fill={p.status === 'chosen' ? 'var(--color-gold)' : 'var(--color-ink)'}
                >
                  {p.title}
                </text>
                <text
                  x={cx + (p.labelDx ?? 10)}
                  y={cy + (p.labelDy ?? -8) + 13}
                  fontSize={10}
                  fontFamily="var(--font-sans)"
                  fill="var(--color-muted)"
                >
                  {p.detail}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="mt-3 text-sm text-muted">
        Fig. 01 — Stacks tried for a 1,000-user waitlist app (example run).
      </figcaption>
    </figure>
  )
}
