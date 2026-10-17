import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

const ITEM = 'h-7 rounded-sm px-3 text-xs font-medium data-[state=on]:bg-surface-2 data-[state=on]:text-ink text-muted'

/** Shared Software / "+ Hardware" toggle — same labels, order and styling everywhere it appears. */
export function ModeToggle({
  hardware,
  onChange,
  className,
}: {
  hardware: boolean
  onChange: (hardware: boolean) => void
  className?: string
}) {
  return (
    <ToggleGroup
      type="single"
      value={hardware ? 'hardware' : 'software'}
      onValueChange={(v) => v && onChange(v === 'hardware')}
      className={cn('inline-flex rounded-md border border-line bg-surface/70 p-1 backdrop-blur', className)}
      aria-label="What are you building?"
    >
      <ToggleGroupItem value="software" className={ITEM}>
        Software
      </ToggleGroupItem>
      <ToggleGroupItem value="hardware" className={ITEM}>
        + Hardware
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
