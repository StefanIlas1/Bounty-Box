import type { Mode } from '../shared/types'

const MODE_KEY = 'bb_mode'

export function resolveInitialMode(search: string): Mode {
  const fromQuery = new URLSearchParams(search).get('mode')
  if (fromQuery === 'demo' || fromQuery === 'live') return fromQuery
  try {
    const stored = localStorage.getItem(MODE_KEY)
    if (stored === 'demo' || stored === 'live') return stored
  } catch {
    return 'demo'
  }
  return 'demo'
}

export function persistMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    return
  }
}

export function resolveInitialHardware(search: string): boolean {
  return new URLSearchParams(search).get('hardware') === '1'
}
