import { useEffect, useRef, useState } from 'react'
import { BorderBeam } from '@/components/ui/border-beam'
import { cn } from '@/lib/utils'

const SRC = '/media/bounty-box-demo.mp4'
const POSTER = '/media/demo-poster.jpg'

// Fades in and starts playing with sound when scrolled into view. If the browser blocks
// sound before the first interaction, it plays muted and unmutes on the first click, tap or key.
// Pauses when scrolled away; once the viewer pauses it themselves, it stays paused.
export function DemoVideo({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const userPaused = useRef(false)
  const autoPausing = useRef(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = wrap.current
    const v = video.current
    if (!el || !v) return
    // Turn sound on at the first click, tap or key press if autoplay had to start muted.
    const unmute = () => {
      v.muted = false
      off()
    }
    const off = () => ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.removeEventListener(t, unmute))
    const start = () => {
      v.muted = false
      v.play().catch(() => {
        v.muted = true
        v.play().catch(() => {})
        ;['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, unmute, { once: true }))
      })
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          if (!userPaused.current) start()
        } else if (!v.paused) {
          autoPausing.current = true
          v.pause()
        }
      },
      { threshold: 0.45 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      off()
    }
  }, [])

  const onPause = () => {
    if (autoPausing.current) autoPausing.current = false
    else userPaused.current = true
  }

  return (
    <div
      ref={wrap}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-20px_rgba(99,91,255,0.45)] transition-all duration-1000 ease-out',
        shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-[0.97] opacity-0',
        className,
      )}
    >
      <video
        ref={video}
        src={SRC}
        poster={POSTER}
        playsInline
        controls
        preload="metadata"
        className="block aspect-video w-full bg-black object-cover"
        onPlay={() => (userPaused.current = false)}
        onPause={onPause}
      />
      <BorderBeam duration={8} size={160} />
    </div>
  )
}

export function DemoVideoSection() {
  return (
    <section id="demo" className="relative isolate scroll-mt-16 overflow-hidden border-b border-line bg-surface/30 px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold">See it run</p>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Watch Bounty-Box build, test and buy a stack in 2 minutes
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          The agent writes the app, breaks it in a CreateOS sandbox, fixes its own code, then buys exactly the stack that passed through Stripe Projects.
        </p>
        <DemoVideo className="mx-auto mt-10" />
      </div>
    </section>
  )
}
