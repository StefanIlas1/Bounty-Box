import { useEffect, useState } from 'react'
import { FileCode } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Mode } from '../../shared/types'
import type { RunState } from '../state/reducer'

export function CodeTab({ state, mode }: { state: RunState; mode: Mode }) {
  const stackId = state.currentStackId
  const stack = stackId ? state.stacks[stackId] : null
  const files = stack?.files ?? []
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (files.length === 0) {
      setSelected(null)
      return
    }
    if (!selected || !files.some((f) => f.path === selected)) {
      setSelected(files[files.length - 1].path)
    }
  }, [files, selected])

  if (!stack) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">No code written yet.</div>
  }

  if (mode === 'live' && files.length === 0) {
    return <div className="flex h-full items-center justify-center text-center text-sm text-muted">Generated files appear here when the backend exposes them.</div>
  }

  const activeFile = files.find((f) => f.path === selected)

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="w-44 shrink-0 rounded border border-line bg-navy">
        <div className="border-b border-line px-3 py-2 font-mono text-[11px] text-muted">stack {stack.stack.id} · {stack.stack.label}</div>
        <ScrollArea className="h-[calc(100%-33px)]">
          <div className="flex flex-col p-1.5">
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => setSelected(f.path)}
                className={cn(
                  'flex items-center gap-1.5 rounded px-2 py-1.5 text-left font-mono text-xs transition-colors',
                  f.path === selected ? 'bg-blue/15 text-blue' : 'text-muted hover:bg-navy-2 hover:text-ink',
                )}
              >
                <FileCode className="size-3.5 shrink-0" />
                {f.path}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden rounded border border-line bg-navy">
        {activeFile ? (
          <ScrollArea className="h-full">
            <pre className="whitespace-pre p-3 font-mono text-[12px] leading-relaxed text-ink">
              <code>{activeFile.content}</code>
            </pre>
          </ScrollArea>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">Select a file.</div>
        )}
      </div>
    </div>
  )
}
