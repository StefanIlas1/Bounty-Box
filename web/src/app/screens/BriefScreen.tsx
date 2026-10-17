import { useState } from 'react'
import { Mic, ArrowRight, ChevronDown } from 'lucide-react'
import { GridPattern } from '@/components/ui/grid-pattern'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Logo } from '../../shared/Logo'
import type { Mode } from '../../shared/types'
import type { StartPayload } from '../live/useLiveRun'

const EXAMPLES = [
  'A waitlist app with email signups that survives 1,000 concurrent users',
  'A link shortener with click analytics for a small marketing team',
  'An internal feedback form that notifies Slack on every submission',
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
  const [prompt, setPrompt] = useState(EXAMPLES[0])
  const [budget, setBudget] = useState(30)
  const [users, setUsers] = useState(1000)
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY)
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_S)
  const [maxP95Ms, setMaxP95Ms] = useState(DEFAULT_MAX_P95)
  const [maxErrorRate, setMaxErrorRate] = useState(DEFAULT_MAX_ERROR_RATE)
  const [useFixtures, setUseFixtures] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [hardwareOn, setHardwareOn] = useState(!!initialHardware)
  const [deviceNeeds, setDeviceNeeds] = useState('')

  const canStart = prompt.trim().length > 0 && budget > 0 && users > 0

  const start = () =>
    onStart({
      description: prompt,
      budgetMonthly: budget,
      targetUsers: users,
      concurrency,
      durationSeconds,
      maxP95Ms,
      maxErrorRate,
      useFixtures,
      hardwareOn,
      deviceNeeds,
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
            placeholder="Describe the app..."
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
            <Input id="budget" type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="users">Target concurrent users</Label>
            <Input id="users" type="number" min={1} value={users} onChange={(e) => setUsers(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <ToggleGroup
            type="single"
            value={hardwareOn ? 'hardware' : 'software'}
            onValueChange={(v) => v && setHardwareOn(v === 'hardware')}
            size="sm"
            className="self-start"
          >
            <ToggleGroupItem value="software">Software</ToggleGroupItem>
            <ToggleGroupItem value="hardware">+ Hardware</ToggleGroupItem>
          </ToggleGroup>
          {hardwareOn && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="device-needs">Device needs</Label>
              <Input
                id="device-needs"
                value={deviceNeeds}
                onChange={(e) => setDeviceNeeds(e.target.value)}
                placeholder="e.g. a door sensor that posts signups from a kiosk"
              />
              {mode === 'live' && <p className="text-xs text-muted">Hardware planning runs in demo only for now.</p>}
            </div>
          )}
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
            <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm text-ink">Use backend fixtures</span>
                <span className="text-xs text-muted">Deterministic test data instead of a live run.</span>
              </div>
              <Switch checked={useFixtures} onCheckedChange={setUseFixtures} />
            </div>
          </div>
        )}

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
