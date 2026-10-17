import { useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, SkipForward, X } from 'lucide-react'
import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura'
import { AgentChatIndicator } from '@/components/agents-ui/agent-chat-indicator'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Message, MessageContent, MessageHeader } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { cn } from '@/lib/utils'
import type { Mode } from '../../shared/types'
import type { RunState } from '../state/reducer'
import type { DemoSpeed, DemoStage } from '../demo/useDemoPlayer'
import { phaseVisual, PHASE_LABEL } from './phaseVisual'

interface DemoControls {
  stage: DemoStage
  speed: DemoSpeed
  setSpeed: (s: DemoSpeed) => void
  togglePause: () => void
  restart: () => void
  skipToApproval: () => void
}

interface LiveControls {
  cancel: () => void
  canCancel: boolean
}

export function AgentPanel({ mode, state, demo, live }: { mode: Mode; state: RunState; demo?: DemoControls; live?: LiveControls }) {
  const { state: auraState, color } = phaseVisual(state.phase)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [state.transcript.length])

  const active = state.phase !== 'idle' && state.phase !== 'finished' && state.phase !== 'error'

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 rounded bg-surface p-4">
      <div className="flex flex-col items-center gap-2 rounded bg-surface-2 py-6">
        <div className="relative h-[140px] w-[140px] overflow-hidden rounded-full">
          <AgentAudioVisualizerAura size="lg" state={auraState} color={color} className="h-full w-full" />
        </div>
        <div className="flex items-center gap-2">
          {active && <AgentChatIndicator size="sm" style={{ backgroundColor: color }} />}
          <span className="text-sm font-semibold text-ink">{PHASE_LABEL[state.phase]}</span>
        </div>
        {state.currentStackId && (
          <span className="font-mono text-xs text-muted">stack {state.currentStackId}</span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div className="flex flex-col gap-3">
          {state.transcript.length === 0 && (
            <p className="text-sm text-muted">The agent's narration and self-fix attempts will appear here once the run starts.</p>
          )}
          {state.transcript.map((entry) => {
            if (entry.kind === 'log') {
              const dot = entry.level === 'warn' ? 'bg-bad' : entry.level === 'ok' ? 'bg-blue' : 'bg-muted'
              return (
                <div key={entry.id} className="flex items-start gap-2 pl-1 text-xs text-muted">
                  <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', dot)} />
                  <span className="font-mono">{entry.text}</span>
                </div>
              )
            }
            if (entry.kind === 'agent_message') {
              return (
                <Message key={entry.id} align="start">
                  <MessageContent>
                    <MessageHeader>Agent</MessageHeader>
                    <Bubble variant="secondary" className="max-w-[92%]">
                      <BubbleContent>{entry.text}</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              )
            }
            // fix_attempt
            const fix = entry.fix!
            return (
              <div
                key={entry.id}
                className={cn(
                  'rounded border px-3 py-2.5 text-xs transition-colors duration-300',
                  fix.resolved ? 'border-blue/30 bg-blue/10' : 'border-bad/40 bg-bad/10',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn('text-[13px] font-semibold', fix.resolved ? 'text-blue' : 'text-bad')}>
                    Self-fix · attempt {fix.attempt} {fix.resolved ? '· resolved' : ''}
                  </span>
                  <span className="font-mono text-[10px] text-muted">stack {fix.stackId}</span>
                </div>
                <p className="font-mono text-muted">
                  <span className="text-bad">error</span> {fix.error}
                </p>
                <p className="mt-1 font-mono text-ink">
                  <span className={fix.resolved ? 'text-blue' : 'text-gold'}>change</span> {fix.change}
                </p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        {mode === 'demo' && demo ? (
          <>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={demo.togglePause} disabled={demo.stage === 'idle' || demo.stage === 'finished'} title={demo.stage === 'paused' ? 'Play' : 'Pause'}>
                {demo.stage === 'paused' ? <Play className="size-4" /> : <Pause className="size-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={demo.restart} title="Restart">
                <RotateCcw className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={demo.skipToApproval}
                disabled={demo.stage === 'awaiting_approval' || demo.stage === 'finished'}
                className="gap-1"
                title="Skip to approval"
              >
                <SkipForward className="size-3.5" /> Skip
              </Button>
            </div>
            <ToggleGroup type="single" value={String(demo.speed)} onValueChange={(v) => v && demo.setSpeed(Number(v) as DemoSpeed)} size="sm">
              <ToggleGroupItem value="1">1×</ToggleGroupItem>
              <ToggleGroupItem value="2">2×</ToggleGroupItem>
              <ToggleGroupItem value="4">4×</ToggleGroupItem>
            </ToggleGroup>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={live?.cancel} disabled={!live?.canCancel} className="gap-1.5">
            <X className="size-3.5" /> Cancel run
          </Button>
        )}
      </div>
    </div>
  )
}
