import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

export function ServiceTile({
  icon: Icon,
  name,
  detail,
  swapped = false,
  tooltipSide = 'top',
  delay = 0,
}: {
  icon: LucideIcon
  name: string
  detail: string
  swapped?: boolean
  tooltipSide?: 'top' | 'bottom'
  delay?: number
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="bb-tile h-16 w-16 sm:h-[72px] sm:w-[72px]" tabIndex={0}>
          <div className="bb-tile-inner" style={{ animationDelay: `${delay}s` }}>
            {swapped && <Badge className="absolute -top-2 -right-2 h-4 bg-gold px-1 text-[9px] text-on-gold">↻</Badge>}
            <Icon className="h-5 w-5 text-muted" strokeWidth={1.6} aria-hidden="true" />
            <span className="font-mono text-[9px] leading-none text-muted">{name}</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide === 'top' ? 'top' : 'bottom'} className="font-mono">
        {detail}
      </TooltipContent>
    </Tooltip>
  )
}
