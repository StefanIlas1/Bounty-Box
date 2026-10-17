// Hero background: a faintly filled grid whose cells flicker, with provider
// logos fading in and out of random cells. Cells are zoned by category
// (databases left, cloud right, email/auth top, AI/data bottom) and never
// land on the centred hero copy.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  siNeon, siSupabase, siTurso, siClickhouse, siPrisma, siUpstash, siRedis,
  siVercel, siRailway, siRender, siCloudflare, siFlydotio,
  siResend, siAuth0, siStripe,
  siAlgolia, siOpenrouter, siPerplexity, siPosthog, siDatadog, siCloudinary,
  siArduino, siRaspberrypi, siEspressif, siNvidia, siAmd, siIntel, siArm, siRiscv,
  siStmicroelectronics, siDigikeyelectronics, siAdafruit, siSparkfun, siKicad,
} from 'simple-icons'

type Zone = 'db' | 'cloud' | 'auth' | 'data'
type Provider = { name: string; path?: string; mono?: string; zone: Zone }

const PROVIDERS: Provider[] = [
  { name: 'Neon', path: siNeon.path, zone: 'db' },
  { name: 'Supabase', path: siSupabase.path, zone: 'db' },
  { name: 'Turso', path: siTurso.path, zone: 'db' },
  { name: 'ClickHouse', path: siClickhouse.path, zone: 'db' },
  { name: 'Prisma', path: siPrisma.path, zone: 'db' },
  { name: 'Upstash', path: siUpstash.path, zone: 'db' },
  { name: 'Redis', path: siRedis.path, zone: 'db' },
  { name: 'Vercel', path: siVercel.path, zone: 'cloud' },
  { name: 'Railway', path: siRailway.path, zone: 'cloud' },
  { name: 'Render', path: siRender.path, zone: 'cloud' },
  { name: 'Cloudflare', path: siCloudflare.path, zone: 'cloud' },
  { name: 'Fly.io', path: siFlydotio.path, zone: 'cloud' },
  { name: 'CreateOS', mono: 'C/', zone: 'cloud' },
  { name: 'Resend', path: siResend.path, zone: 'auth' },
  { name: 'Auth0', path: siAuth0.path, zone: 'auth' },
  { name: 'Stripe', path: siStripe.path, zone: 'auth' },
  { name: 'Algolia', path: siAlgolia.path, zone: 'data' },
  { name: 'OpenRouter', path: siOpenrouter.path, zone: 'data' },
  { name: 'Perplexity', path: siPerplexity.path, zone: 'data' },
  { name: 'PostHog', path: siPosthog.path, zone: 'data' },
  { name: 'Datadog', path: siDatadog.path, zone: 'data' },
  { name: 'Cloudinary', path: siCloudinary.path, zone: 'data' },
]

const HARDWARE: Provider[] = [
  { name: 'Arduino', path: siArduino.path, zone: 'db' },
  { name: 'Raspberry Pi', path: siRaspberrypi.path, zone: 'db' },
  { name: 'Espressif', path: siEspressif.path, zone: 'db' },
  { name: 'STM32', path: siStmicroelectronics.path, zone: 'db' },
  { name: 'NVIDIA', path: siNvidia.path, zone: 'cloud' },
  { name: 'AMD', path: siAmd.path, zone: 'cloud' },
  { name: 'Intel', path: siIntel.path, zone: 'cloud' },
  { name: 'Arm', path: siArm.path, zone: 'cloud' },
  { name: 'RISC-V', path: siRiscv.path, zone: 'cloud' },
  { name: 'DigiKey', path: siDigikeyelectronics.path, zone: 'auth' },
  { name: 'Adafruit', path: siAdafruit.path, zone: 'auth' },
  { name: 'SparkFun', path: siSparkfun.path, zone: 'auth' },
  { name: 'KiCad', path: siKicad.path, zone: 'data' },
  { name: 'FPGA', mono: 'FP', zone: 'data' },
  { name: 'PCB fab', mono: 'PCB', zone: 'data' },
]

export type GridMode = 'software' | 'hardware'

const ZONE_LABELS: Record<GridMode, Record<Zone, string>> = {
  software: {
    db: 'Databases',
    cloud: 'Cloud & hosting',
    auth: 'Email, auth & payments',
    data: 'Search, AI & data',
  },
  hardware: {
    db: 'Boards & microcontrollers',
    cloud: 'Compute & chips',
    auth: 'Parts suppliers',
    data: 'Design & fabrication',
  },
}

const CELL = 72
const SLOTS = 9
const FLICKER = 26

type Cell = { c: number; r: number }
type Tile = Cell & { key: number; p: Provider }

const rand = (n: number) => Math.floor(Math.random() * n)

export function ProviderGrid({ exclude = { w: 760, h: 470 }, mode = 'software' }: { exclude?: { w: number; h: number }; mode?: GridMode }) {
  const LIST = mode === 'hardware' ? HARDWARE : PROVIDERS
  const ZONE_LABEL = ZONE_LABELS[mode]
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [tiles, setTiles] = useState<Tile[]>([])
  const [flicker, setFlicker] = useState<(Cell & { key: number })[]>([])
  const keyRef = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cols = Math.ceil(size.w / CELL)
  const rows = Math.ceil(size.h / CELL)
  // Offset so the grid is centred horizontally.
  const offX = (size.w - cols * CELL) / 2

  // Cells available for logos, bucketed by zone; the centre copy area is excluded.
  const zones = useMemo(() => {
    const out: Record<Zone, Cell[]> = { db: [], cloud: [], auth: [], data: [] }
    if (!cols || !rows) return out
    const cx = size.w / 2, cy = size.h / 2
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = offX + c * CELL, y = r * CELL
        const inCentre = x + CELL > cx - exclude.w / 2 && x < cx + exclude.w / 2 && y + CELL > cy - exclude.h / 2 && y < cy + exclude.h / 2
        if (inCentre || r === 0 || r >= rows - 1 || x < 0 || x + CELL > size.w || y + CELL > size.h) continue
        const fx = (x + CELL / 2) / size.w
        const zone: Zone = fx < 0.33 ? 'db' : fx > 0.67 ? 'cloud' : y < cy ? 'auth' : 'data'
        out[zone].push({ c, r })
      }
    }
    return out
  }, [cols, rows, size.w, size.h, offX, exclude.w, exclude.h])

  // Rotate one provider tile every ~1.6s.
  useEffect(() => {
    const all = Object.values(zones).flat()
    if (!all.length) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const place = (current: Tile[]): Tile | null => {
      const used = new Set(current.map((t) => t.p.name))
      const zoneKeys = (Object.keys(zones) as Zone[]).filter((z) => zones[z].length)
      for (let tries = 0; tries < 20; tries++) {
        const z = zoneKeys[rand(zoneKeys.length)]
        const choices = LIST.filter((p) => p.zone === z && !used.has(p.name))
        if (!choices.length) continue
        const cell = zones[z][rand(zones[z].length)]
        // keep tiles from touching each other
        if (current.some((t) => Math.abs(t.c - cell.c) <= 1 && Math.abs(t.r - cell.r) <= 1)) continue
        return { ...cell, p: choices[rand(choices.length)], key: keyRef.current++ }
      }
      return null
    }
    setTiles(() => {
      const init: Tile[] = []
      for (let i = 0; i < SLOTS; i++) { const t = place(init); if (t) init.push(t) }
      return init
    })
    if (reduce) return
    const id = window.setInterval(() => {
      setTiles((cur) => {
        if (!cur.length) return cur
        const next = cur.slice(1)
        const t = place(next)
        return t ? [...next, t] : cur
      })
    }, 1600)
    return () => window.clearInterval(id)
  }, [zones, LIST])

  // Background cells that softly light up and fade.
  useEffect(() => {
    if (!cols || !rows) return
    const mk = () => ({ c: rand(cols), r: rand(rows), key: keyRef.current++ })
    setFlicker(Array.from({ length: FLICKER }, mk))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setFlicker((cur) => [...cur.slice(3), mk(), mk(), mk()])
    }, 700)
    return () => window.clearInterval(id)
  }, [cols, rows])

  const labelPos: Record<Zone, React.CSSProperties> = {
    db: { left: 24, top: 26 },
    cloud: { right: 24, top: 26, textAlign: 'right' },
    auth: { left: '50%', top: 26, transform: 'translateX(-50%)' },
    data: { left: '50%', bottom: 18, transform: 'translateX(-50%)' },
  }

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(ellipse_75%_70%_at_center,white_55%,transparent)]">
      {size.w > 0 && (
        <svg className="absolute inset-0 h-full w-full">
          <defs>
            <pattern id="bb-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse" x={offX} y={0}>
              <rect x="1" y="1" width={CELL - 2} height={CELL - 2} fill="rgba(243,231,226,0.022)" />
              <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(160,105,63,0.22)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bb-grid)" />
          {flicker.map((f) => (
            <rect key={f.key} x={offX + f.c * CELL + 1} y={f.r * CELL + 1} width={CELL - 2} height={CELL - 2} className="bb-cell-flicker" fill="rgba(233,185,73,0.10)" />
          ))}
        </svg>
      )}

      {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
        <span key={z} style={labelPos[z]} className="absolute hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted/45 lg:block">
          {ZONE_LABEL[z]}
        </span>
      ))}

      {tiles.map((t) => (
        <div
          key={t.key}
          className="bb-logo-cell absolute flex flex-col items-center justify-center gap-1.5 bg-ink/[0.045] text-ink/70"
          style={{ left: offX + t.c * CELL + 1, top: t.r * CELL + 1, width: CELL - 2, height: CELL - 2 }}
        >
          {t.p.path ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d={t.p.path} /></svg>
          ) : (
            <span className="font-display text-lg font-extrabold leading-none text-gold/80">{t.p.mono}</span>
          )}
          <span className="font-mono text-[9.5px] leading-none text-muted">{t.p.name}</span>
        </div>
      ))}
    </div>
  )
}
