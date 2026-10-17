import type { Mode } from '../shared/types'

const MODE_KEY = 'bb_mode'

export function resolveInitialMode(search: string): Mode {
  const params = new URLSearchParams(search)
  const fromQuery = params.get('mode')
  if (fromQuery === 'demo' || fromQuery === 'live') return fromQuery
  try {
    const stored = localStorage.getItem(MODE_KEY)
    if (stored === 'demo' || stored === 'live') return stored
  } catch {
    // ignore (private browsing etc.)
  }
  return 'demo'
}

export function persistMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // ignore
  }
}

/** `?hardware=1` on the landing page's link into the app. Query-only (no persistence):
 * the Brief screen's own toggle is the source of truth once the app has loaded. */
export function resolveInitialHardware(search: string): boolean {
  return new URLSearchParams(search).get('hardware') === '1'
}
