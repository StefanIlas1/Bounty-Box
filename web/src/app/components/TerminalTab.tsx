import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { RunState } from '../state/reducer'

export function TerminalTab({ state }: { state: RunState }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const rows = state.stackOrder.flatMap((id) => {
    const s = state.stacks[id]
    return s.commands.map((c) => ({ stackId: id, ...c }))
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [rows.length])

  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">No commands run yet.</div>
  }

  return (
    <ScrollArea className="h-full rounded border border-line bg-navy">
      <div className="flex flex-col gap-3 p-3 font-mono text-[12px]">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 text-muted">
              <span className="text-blue">stack {r.stackId}</span>
              <span>$</span>
              <span className="text-ink">{r.cmd}</span>
              <span className={cn('ml-auto rounded px-1.5 text-[10px]', r.exitCode === 0 ? 'bg-blue/15 text-blue' : 'bg-bad/15 text-bad')}>
                exit {r.exitCode}
              </span>
            </div>
            <pre className={cn('mt-1 whitespace-pre-wrap pl-4', r.exitCode === 0 ? 'text-muted' : 'text-bad')}>{r.output}</pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
