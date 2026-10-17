import type { Transition } from 'motion/react'

// Shared timings so hover, overlay and panel motion feel like one system.
// Seconds, to match motion/react. CSS mirrors live in index.css (--dur-*, --ease-*).
export const duration = {
  press: 0.12,
  overlay: 0.17,
  panel: 0.22,
  chart: 0.6,
} as const

export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const

export const offset = { sm: 4, md: 8 } as const

export const transition = {
  press: { duration: duration.press, ease: ease.out },
  overlay: { duration: duration.overlay, ease: ease.out },
  panel: { duration: duration.panel, ease: ease.out },
} satisfies Record<string, Transition>

// Small fade-and-rise for elements entering the view.
export const enter = {
  initial: { opacity: 0, y: offset.md },
  animate: { opacity: 1, y: 0 },
  transition: transition.panel,
}
