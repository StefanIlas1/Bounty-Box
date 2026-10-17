// Minimal autoplay timer for a RunEvent[] queue, honoring each event's cumulative `at`
// offset in real time (speed = 1x). Used by the live-mode fallback (simulateRun) so it
// drives the same reducer the same way Demo mode and Live mode do. No pause/speed
// controls here on purpose: the fallback just needs to play through automatically.
import type { RunEvent } from '../../shared/types'

export function playQueue(
  events: RunEvent[],
  dispatch: (event: RunEvent) => void,
  opts?: { stopAt?: (event: RunEvent) => boolean; onDone?: () => void },
): { cancel: () => void } {
  let index = 0
  let lastAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let cancelled = false

  function step() {
    if (cancelled || index >= events.length) {
      if (!cancelled) opts?.onDone?.()
      return
    }
    const event = events[index]
    const delay = Math.max(0, event.at - lastAt)
    timer = setTimeout(() => {
      if (cancelled) return
      dispatch(event)
      lastAt = event.at
      index += 1
      if (opts?.stopAt?.(event)) {
        opts.onDone?.()
        return
      }
      step()
    }, delay)
  }

  step()

  return {
    cancel: () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    },
  }
}
