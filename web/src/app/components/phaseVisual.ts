import type { AgentState } from '@livekit/components-react'
import type { Phase } from '../state/reducer'

// Maps our run phases onto the LiveKit AgentState buckets the aura shader understands,
// plus a brand color per phase so phases that share a motion bucket still read as distinct.
export const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Idle',
  planning: 'Planning',
  writing: 'Writing code',
  testing: 'Testing',
  fixing: 'Fixing',
  awaiting_approval: 'Waiting for approval',
  buying: 'Buying services',
  live: 'Live',
  finished: 'Done',
  error: 'Error',
}

// Hex values mirror the brand tokens in src/index.css (gold/blue/blue-soft/muted/bad).
// Kept as literal hex because the shader prop takes a color, not a Tailwind class.
const MAP: Record<Phase, { state: AgentState; color: `#${string}` }> = {
  idle: { state: 'idle', color: '#a68f8c' },
  planning: { state: 'thinking', color: '#635bff' },
  writing: { state: 'speaking', color: '#8f89ff' },
  testing: { state: 'listening', color: '#635bff' },
  fixing: { state: 'thinking', color: '#e9b949' },
  awaiting_approval: { state: 'idle', color: '#a68f8c' },
  buying: { state: 'connecting', color: '#e9b949' },
  live: { state: 'listening', color: '#635bff' },
  finished: { state: 'listening', color: '#635bff' },
  error: { state: 'failed', color: '#f2994a' },
}

export function phaseVisual(phase: Phase) {
  return MAP[phase]
}
