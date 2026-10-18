import { useState } from 'react'
import { Rocket, Copy, Check, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/ui/border-beam'
import type { RunState } from '../state/reducer'

export function LiveUrlCard({ state, scripted = false }: { state: RunState; scripted?: boolean }) {
  const [copied, setCopied] = useState(false)
  if (!state.liveUrl) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.liveUrl!)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <Card className="relative border-blue/30 bg-surface">
      <BorderBeam size={60} duration={5} colorFrom="#635bff" colorTo="#e9b949" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="size-4 text-blue" /> {scripted ? 'Verified judging app' : 'Live URL'}
        </CardTitle>
      </CardHeader>
      {scripted && <p className="px-6 pb-3 text-xs text-muted">This replay made no purchases or deployments. This separate real app was generated, repaired and verified in CreateOS with Neon. Available until October 18, 9:17 PM EDT.</p>}
      <CardContent className="flex items-center gap-2">
        <a
          href={state.liveUrl}
          target="_blank"
          rel="noreferrer"
          className="flex-1 truncate rounded bg-surface-2 px-2.5 py-1.5 font-mono text-sm text-blue hover:underline"
        >
          {state.liveUrl}
        </a>
        <Button variant="outline" size="icon" onClick={copy} title="Copy link">
          {copied ? <Check className="size-4 text-blue" /> : <Copy className="size-4" />}
        </Button>
        <Button variant="outline" size="icon" asChild title="Open">
          <a href={state.liveUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
