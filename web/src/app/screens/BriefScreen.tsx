import { useEffect, useState } from 'react'
import { Mic, ArrowRight, ChevronDown } from 'lucide-react'
import { GridPattern } from '@/components/ui/grid-pattern'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Logo } from '../../shared/Logo'
import type { Mode } from '../../shared/types'
import type { StartPayload } from '../live/useLiveRun'

const EXAMPLES = [
  'A task tracker for a student team with priorities and completion status',
  'A portfolio for a landscape photographer with a project gallery',
  'An event interest form for a campus robotics club',
]

// ADR-10 defaults.
const DEFAULT_CONCURRENCY = 10
const DEFAULT_DURATION_S = 30
const DEFAULT_MAX_P95 = 500
const DEFAULT_MAX_ERROR_RATE = 0.01

export function BriefScreen({
  mode,
  onStart,
  starting,
  startError,
  initialHardware,
}: {
  mode: Mode
  onStart: (payload: StartPayload) => void
  starting?: boolean
  startError?: string | null
  initialHardware?: boolean
}) {
  const [prompt, setPrompt] = useState(mode === 'live' ? '' : EXAMPLES[0])
  const [budget, setBudget] = useState(30)
  const [users, setUsers] = useState(mode === 'live' ? 1 : 1000)
  const [concurrency, setConcurrency] = useState(mode === 'live' ? 1 : DEFAULT_CONCURRENCY)
  const [durationSeconds, setDurationSeconds] = useState(mode === 'live' ? 5 : DEFAULT_DURATION_S)
  const [maxP95Ms, setMaxP95Ms] = useState(mode === 'live' ? 10000 : DEFAULT_MAX_P95)
  const [maxErrorRate, setMaxErrorRate] = useState(DEFAULT_MAX_ERROR_RATE)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [hardwareOn, setHardwareOn] = useState(!!initialHardware)
  useEffect(() => {
    setPrompt(mode === 'live' ? '' : EXAMPLES[0])
    setUsers(mode === 'live' ? 1 : 1000)
    setConcurrency(mode === 'live' ? 1 : DEFAULT_CONCURRENCY)
    setDurationSeconds(mode === 'live' ? 5 : DEFAULT_DURATION_S)
    setMaxP95Ms(mode === 'live' ? 10000 : DEFAULT_MAX_P95)
  }, [mode])
  const canStart = prompt.trim().length > 0 && Number.isFinite(budget) && budget >= 0 && Number.isInteger(users) && users > 0 && (mode !== 'live' || (users <= 100 && Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 2 && durationSeconds >= 1 && durationSeconds <= 5 && maxP95Ms > 0 && maxErrorRate >= 0 && maxErrorRate <= 1))

  const start = () =>
    onStart({
      description: prompt,
      budgetMonthly: budget,
      targetUsers: users,
      concurrency,
      durationSeconds,
      maxP95Ms,
      maxErrorRate,
      useFixtures: false,
      hardwareOn,
      deviceNeeds: hardwareOn ? prompt : undefined,
    })

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto">
      <GridPattern
        width={44}
        height={44}
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full stroke-line/50 fill-line/20 [mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
      />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={34} />
          <p className="max-w-md text-sm text-muted">
            Describe the app you need and a budget. The agent picks a stack, writes the code, tests it in a sandbox, and
            asks before it buys anything.
          </p>
        </div>

      <div className="flex w-full flex-col gap-4 rounded bg-surface p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brief-prompt">What do you need?</Label>
          <Textarea
            id="brief-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your end goal, who the app is for, and what it should do..."
            className="min-h-28 text-base"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setPrompt(ex)} className="text-left">
              <Badge variant="outline" className="cursor-pointer whitespace-normal border-line font-sans text-muted hover:border-blue/40 hover:text-blue">
                {ex}
              </Badge>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget">Budget ($/mo)</Label>
            <Input id="budget" type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="users">Target users</Label>
            <Input id="users" type="number" min={1} max={mode === 'live' ? 100 : undefined} value={users} onChange={(e) => setUsers(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink" htmlFor="hardware-functionality">
            <input
              id="hardware-functionality"
              type="checkbox"
              checked={hardwareOn}
              onChange={(e) => setHardwareOn(e.target.checked)}
              className="size-4 accent-gold"
            />
            Hardware functionality
          </label>
          {hardwareOn && mode === 'live' && <p className="text-xs text-muted">Hardware planning runs in demo only for now.</p>}
        </div>

        {mode === 'live' && (
          <div className="rounded border border-line">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-muted hover:text-ink"
            >
              Advanced load test
              <ChevronDown className={cnRotate(advancedOpen)} />
            </button>
            {advancedOpen && (
              <div className="grid grid-cols-2 gap-3 border-t border-line p-3">
                <Field label="Concurrency" value={concurrency} onChange={setConcurrency} />
                <Field label="Duration (s)" value={durationSeconds} onChange={setDurationSeconds} />
                <Field label="Max p95 (ms)" value={maxP95Ms} onChange={setMaxP95Ms} />
                <Field label="Max error rate" value={maxErrorRate} onChange={setMaxErrorRate} step={0.01} />
              </div>
            )}

          </div>
        )}

        {mode === 'live' && <p className="text-xs text-muted">Live builds generate a small web app from your goal and run bounded checks in CreateOS. Up to 100 planned users; default test is 2 concurrent requests for 5 seconds. Planned users are not measured capacity.</p>}
        {startError && <p className="text-sm text-bad">{startError}</p>}

        <div className="flex items-center gap-2">
          <Button
            size="lg"
            disabled={!canStart || starting}
            onClick={start}
            className="flex-1 gap-1.5 bg-gold text-on-gold hover:bg-gold/85"
          >
            {starting ? 'Starting…' : 'Start build'} <ArrowRight className="size-4" />
          </Button>
          {mode === 'live' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" disabled>
                  <Mic className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voice brief needs the LiveKit token endpoint</TooltipContent>
            </Tooltip>
          )}
        </div>
        {mode === 'demo' && <p className="text-center text-[11px] text-muted">Demo mode plays a fixed scripted example regardless of what you type above.</p>}
        <ol aria-label="What you will see after you start" className="grid grid-cols-2 gap-2 border-t border-line pt-4 text-xs text-muted sm:grid-cols-4">
          {[
            ['Agent', 'left panel: its reasoning, live'],
            ['Code', 'files it writes and fixes'],
            ['Terminal + Sandbox', mode === 'live' ? 'real runs in CreateOS' : 'scripted example output'],
            ['Cart', 'review costs before deployment'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded border border-line/70 px-2.5 py-2">
              <span className="font-medium text-ink"><span className="mr-1 tabular-nums text-gold">{i + 1}</span>{t}</span>
              <span className="mt-0.5 block">{d}</span>
            </li>
          ))}
        </ol>
        </div>
      </div>
    </div>
  )
}

function cnRotate(open: boolean) {
  return `size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-7 text-xs" />
    </div>
  )
}
