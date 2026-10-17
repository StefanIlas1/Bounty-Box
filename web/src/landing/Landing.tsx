import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Play,
  Database,
  Globe,
  ShieldCheck,
  Mail,
  ListOrdered,
  Zap,
  Archive,
  Search,
  Share2,
  Clock,
  PenLine,
  FlaskConical,
  CheckCircle2,
  Rocket,
  Lock,
  Link2,
  EyeOff,
  Menu,
} from 'lucide-react'
import { Logo } from '../shared/Logo'
import { ModeToggle } from '../shared/ModeToggle'
import { siNeon, siSupabase, siUpstash, siResend, siVercel, siRailway, siAuth0, siRender, siStripe, siCloudflare, siPosthog, siRedis } from 'simple-icons'
import { ProviderGrid, type GridMode } from './ProviderGrid'
import { IterationStory } from './IterationStory'
import { FigChart } from './FigChart'
import { GithubMark } from './GithubMark'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DotPattern } from '@/components/ui/dot-pattern'
import { GridPattern } from '@/components/ui/grid-pattern'
import { BorderBeam } from '@/components/ui/border-beam'
import { FlickeringGrid } from '@/components/ui/flickering-grid'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import './landing.css'

const NAV_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#fig-01', label: 'Proof' },
  { href: '/#trust', label: 'Trust' },
]

const TOP_TILES = [
  { icon: Database, name: 'Postgres', detail: 'Postgres · via Neon' },
  { icon: Globe, name: 'Edge host', detail: 'Edge host · via Vercel' },
  { icon: ShieldCheck, name: 'Auth', detail: 'Auth · via Auth0' },
  { icon: Mail, name: 'Email', detail: 'Email · via Resend' },
  { icon: ListOrdered, name: 'Queue', detail: 'Queue · via Railway' },
]

const BOTTOM_TILES = [
  { icon: Zap, name: 'Redis', detail: '↻ swapped in · p95 140ms', swapped: true },
  { icon: Archive, name: 'Storage', detail: 'Storage · via Supabase' },
  { icon: Search, name: 'Search', detail: 'Search · via Render' },
  { icon: Share2, name: 'Vector DB', detail: 'Vector DB · via Supabase' },
  { icon: Clock, name: 'Cron', detail: 'Cron · via Railway' },
]

const CATALOG_PROVIDERS = [
  { name: 'Neon', path: siNeon.path }, { name: 'Supabase', path: siSupabase.path }, { name: 'Upstash', path: siUpstash.path },
  { name: 'Resend', path: siResend.path }, { name: 'Vercel', path: siVercel.path }, { name: 'Railway', path: siRailway.path },
  { name: 'Auth0', path: siAuth0.path }, { name: 'Render', path: siRender.path }, { name: 'Stripe', path: siStripe.path },
  { name: 'Cloudflare', path: siCloudflare.path }, { name: 'PostHog', path: siPosthog.path }, { name: 'Redis', path: siRedis.path },
]

type IterationCard = {
  n: string
  title: string
  result: string
  cost: string
  pass: boolean
  chosen?: boolean
}

const ITERATIONS: IterationCard[] = [
  { n: 'ATTEMPT 1', title: 'SQLite + free host', result: '✕ fails at 800 users', cost: '$0/mo', pass: false },
  { n: 'ATTEMPT 2', title: 'Postgres + VM', result: '✓ 1,000 users · p95 90ms', cost: '$48/mo · over budget', pass: true },
  { n: 'ATTEMPT 3', title: 'Postgres + edge, no cache', result: '✕ p95 1.4s under load', cost: '$22/mo', pass: false },
  {
    n: 'CHOSEN',
    title: 'Postgres + edge + Redis',
    result: '✓ 1,000 users · p95 140ms',
    cost: '$27.40/mo · $2.60 under',
    pass: true,
    chosen: true,
  },
]

const STEPS = [
  { n: '01', icon: PenLine, title: 'Describe', detail: 'Your brief and budget become a locked spec.' },
  {
    n: '02',
    icon: FlaskConical,
    title: 'Test in a CreateOS sandbox',
    detail: 'Runs behind an egress allowlist; a self-fix loop patches what fails.',
    shot: '/shots/terminal.png',
    shotAlt: 'Terminal tab showing a failed test, a self-fix, then a passing load test inside the CreateOS sandbox',
    shotRatio: 900 / 416,
  },
  {
    n: '03',
    icon: CheckCircle2,
    title: 'Approve',
    detail: 'The sandbox pauses — nothing runs or costs money while you review the stack.',
    shot: '/shots/comparisons.png',
    shotAlt: 'Comparisons table scoring three stacks on latency, error rate and monthly cost',
    shotRatio: 900 / 306,
  },
  {
    n: '04',
    icon: Rocket,
    title: 'Buy and ship with Stripe Projects',
    detail: 'Each service is bought with stripe projects add, then you get a live ingress URL.',
    shot: '/shots/sandbox-cart.png',
    shotAlt: 'Sandbox and cart panel with an egress allowlist, a paused sandbox, and a Stripe Projects approve button',
    shotRatio: 620 / 1049,
  },
]

const TRUST_POINTS = [
  { icon: EyeOff, title: 'No partner pricing shown', body: "Never exposes a vendor's discounted rate — only your total and why it won." },
  { icon: Link2, title: 'Every claim is linked', body: 'Every "fastest" or "cheapest" links to the sandbox run that measured it.' },
  { icon: Lock, title: 'Nothing bought without you', body: 'The stack is bought through Stripe Projects only after you approve it.' },
  { icon: ShieldCheck, title: 'Safe to try', body: 'The demo runs in test mode, on free tiers, inside a paused-by-default sandbox.' },
]

const CTA_GOLD =
  'h-auto rounded-lg px-5 py-3 text-sm font-semibold transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-0.5'
const CTA_OUTLINE =
  'h-auto rounded-lg border-blue/50 px-5 py-3 text-sm font-semibold text-ink transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-0.5 hover:border-blue hover:bg-blue/10'

export function NavBar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-line bg-bg/90 backdrop-blur">
      <div className="flex h-16 w-full items-center justify-between px-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-12 2xl:px-16">
        <Link to="/" className="shrink-0 justify-self-start" aria-label="Bounty-Box home">
          <Logo size={20} />
        </Link>

        <nav className="hidden items-center gap-10 lg:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
          <Link to="/saas" className="text-sm text-muted transition-colors hover:text-ink">For SaaS</Link>
          <a
            href="https://github.com/StefanIlas1/Bounty-Box"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            <GithubMark className="h-4 w-4" /> GitHub
          </a>
        </nav>

        <div className="hidden items-center gap-3 justify-self-end lg:flex">
          <Button asChild variant="outline" className={cn(CTA_OUTLINE, 'py-2')}>
            <Link to="/demo">Try the demo</Link>
          </Button>
          <Button asChild className={cn(CTA_GOLD, 'py-2')}>
            <Link to="/app?mode=live">Start a build</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open menu" className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 border-l border-line bg-bg">
            <SheetHeader>
              <SheetTitle>
                <Logo size={18} />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 px-4">
              {NAV_LINKS.map((l) => (
                <SheetClose asChild key={l.href}>
                  <a href={l.href} className="text-sm text-muted hover:text-ink">
                    {l.label}
                  </a>
                </SheetClose>
              ))}
              <Link to="/saas" className="text-sm text-muted hover:text-ink">For SaaS</Link>
              <a
                href="https://github.com/StefanIlas1/Bounty-Box"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"
              >
                <GithubMark className="h-4 w-4" /> GitHub
              </a>
              <div className="mt-2 flex flex-col gap-3">
                <Button asChild variant="outline" className={cn(CTA_OUTLINE, 'justify-center py-2.5')}>
                  <Link to="/demo">Try the demo</Link>
                </Button>
                <Button asChild className={cn(CTA_GOLD, 'justify-center py-2.5')}>
                  <Link to="/app?mode=live">Start a build</Link>
                </Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

function Hero() {
  const [mode, setMode] = useState<GridMode>('software')
  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden px-6 py-10">
      <ProviderGrid mode={mode} />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[460px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg/80 blur-[60px]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue/[0.07] blur-[120px]" />

      <div className="bb-fade-up mx-auto max-w-2xl text-center">
        <ModeToggle hardware={mode === 'hardware'} onChange={(hw) => setMode(hw ? 'hardware' : 'software')} className="mx-auto mb-7" />
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold">Stripe Projects × CreateOS Sandbox</p>
        <h1 className="mt-4 font-display text-[clamp(2.25rem,5.2vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
          Building big <span className="text-gold whitespace-nowrap">under budget.</span>
        </h1>
        <p className="mx-auto mt-5 flex min-h-[7.5rem] max-w-xl items-start justify-center text-base text-muted sm:min-h-[7rem] sm:text-lg">
          {mode === 'software'
            ? 'Describe the app you want and a monthly budget. Bounty-Box picks the stack, load-tests it inside a CreateOS sandbox, fixes and swaps out whatever fails, then buys it through Stripe Projects and hands you a live URL.'
            : 'Need a device too? Bounty-Box adds a hardware bill of materials: boards, chips and parts priced against your budget, firmware written and tested next to your app, and the parts bought only after you approve the whole build.'}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className={CTA_GOLD}>
            <Link to={mode === 'hardware' ? '/app?mode=live&hardware=1' : '/app?mode=live'}>
              Start a build <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={CTA_OUTLINE}>
            <Link to={mode === 'hardware' ? '/demo?hardware=1' : '/demo'}>
              Watch the demo <Play className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function CatalogRow() {
  // Two copies side by side so the strip loops seamlessly.
  const loop = [...CATALOG_PROVIDERS, ...CATALOG_PROVIDERS]
  return (
    <section className="border-y border-line bg-surface/40">
      <div className="py-10 text-center">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.12em] text-muted">Buys from the Stripe Projects catalog</p>
        <div className="bb-marquee-mask overflow-hidden">
          <ul className="bb-marquee flex w-max gap-4" aria-label="Providers in the Stripe Projects catalog">
            {loop.map((p, i) => (
              <li key={`${p.name}-${i}`} aria-hidden={i >= CATALOG_PROVIDERS.length} className="bb-widget flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-gold/25 bg-surface">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-gold" fill="currentColor" aria-hidden="true"><path d={p.path} /></svg>
                <span className="text-[10px] font-medium text-ink/80">{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function SectionHead({
  eyebrow,
  title,
  body,
  tone = 'dark',
}: {
  eyebrow: string
  title: string
  body: string
  tone?: 'dark' | 'light'
}) {
  const light = tone === 'light'
  return (
    <div className="mb-10 grid gap-3 sm:grid-cols-[200px_1fr] sm:gap-6">
      <span className={cn('text-xs font-medium uppercase tracking-[0.12em] sm:pt-1', light ? 'text-blue' : 'text-gold')}>
        {eyebrow}
      </span>
      <div>
        <h2 className={cn('font-display text-2xl font-bold sm:text-3xl', light ? 'text-ink' : 'text-ink')}>{title}</h2>
        <p className={cn('mt-3 max-w-2xl', light ? 'text-ink/65' : 'text-muted')}>{body}</p>
      </div>
    </div>
  )
}

function IterationStrip() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <SectionHead
          eyebrow="One run, four attempts"
          title="Show the depth of the search, simply."
          body="One run plays out as four cards. The agent tries, measures, fails, swaps, and lands under budget — before you read a line of code."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITERATIONS.map((c) => (
            <Card
              key={c.n}
              className={cn(
                'relative overflow-hidden rounded-lg border bg-surface ring-0',
                c.chosen ? 'border-gold shadow-[0_0_0_1px_var(--color-gold)]' : 'border-line'
              )}
            >
              <CardContent className="flex flex-col gap-2.5">
                <Badge
                  variant={c.chosen ? 'default' : 'outline'}
                  className={cn(
                    'rounded-full font-mono text-[10px] uppercase tracking-wide',
                    !c.chosen && 'border-brown-soft/40 text-brown-soft'
                  )}
                >
                  {c.n}
                </Badge>
                <span className="font-display text-base font-semibold text-ink">{c.title}</span>
                <span className={cn('font-mono text-sm', c.pass ? 'text-ok' : 'text-bad')}>{c.result}</span>
                <span className="font-mono text-sm text-muted">{c.cost}</span>
              </CardContent>
              {c.chosen && <BorderBeam size={90} duration={7} colorFrom="#e9b949" colorTo="#635bff" />}
            </Card>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted">
          Example figures. In the product every number comes from a real sandbox run you can open.
        </p>
      </div>
    </section>
  )
}

function FigureSection() {
  return (
    <section id="fig-01" className="relative isolate overflow-hidden border-b border-line bg-surface/30">
      <DotPattern aria-hidden="true" width={22} height={22} cr={1} className="pointer-events-none absolute inset-0 -z-10 fill-brown-soft/30 [mask-image:linear-gradient(to_bottom,white,transparent_85%)]" />
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <SectionHead
          eyebrow="Measured, not claimed"
          title="Every stack gets charted against your budget."
          body="Cost and latency for every attempt, plotted against the budget line and the latency target. The chosen stack is the one that clears both."
        />
        <FigChart />
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative isolate scroll-mt-16 overflow-hidden border-b border-line bg-surface/30">
      <DotPattern aria-hidden="true" width={22} height={22} cr={1} className="pointer-events-none absolute inset-0 -z-10 fill-brown-soft/30 [mask-image:linear-gradient(to_bottom,white,transparent_85%)]" />
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <SectionHead
          eyebrow="How it works"
          title="Four steps from idea to live URL."
          body="Everything the agent does is visible: what it tried, what it measured, and what it bought."
        />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-blue-soft">
                  <s.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <span className="text-xs tabular-nums text-muted/70">{s.n}</span>
              </div>
              <h3 className="text-base font-semibold text-ink">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{s.detail}</p>
              {s.shot && (
                <div className="bb-shot-frame mt-1" style={{ aspectRatio: s.shotRatio }}>
                  <img src={s.shot} alt={s.shotAlt} width={900} height={Math.round(900 / s.shotRatio!)} loading="lazy" decoding="async" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Trust() {
  return (
    <section id="trust" className="relative isolate scroll-mt-16 overflow-hidden border-b border-line">
      <GridPattern aria-hidden="true" width={56} height={56} className="pointer-events-none absolute inset-0 -z-10 stroke-line/50 [mask-image:radial-gradient(500px_circle_at_80%_20%,white,transparent)]" />
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <SectionHead
          eyebrow="Trust"
          title="Nothing moves without you."
          body="Bounty-Box is built to be checked. Every number is sourced, and every purchase waits for your yes."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {TRUST_POINTS.map((t) => (
            <Card key={t.title} className="rounded-lg border border-line bg-surface ring-0">
              <CardContent className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-blue-soft">
                  <t.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">{t.title}</h3>
                  <p className="mt-1 text-sm text-muted">{t.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden border-b border-line bg-surface-2">
      <FlickeringGrid aria-hidden="true" squareSize={3} gridGap={7} color="#635bff" maxOpacity={0.22} flickerChance={0.08} className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(600px_circle_at_center,white,transparent)]" />
      <div className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
        <h2 className="font-display text-3xl font-bold text-ink sm:text-4xl">Set the bounty. Get the build.</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Describe the app, name the budget, and approve the stack. Bounty-Box does the rest.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className={CTA_GOLD}>
            <Link to="/app?mode=live">
              Start a build <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={CTA_OUTLINE}>
            <Link to="/demo">
              Watch the demo <Play className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Logo size={18} />
          <p className="text-sm text-muted">Building big under budget.</p>
        </div>
        <p className="text-xs text-muted">Built at CreateOS × Stripe Projects hackathon, Oct 17 2026.</p>
        <a
          href="https://github.com/StefanIlas1/Bounty-Box"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <GithubMark className="h-4 w-4" /> GitHub
        </a>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-bg text-ink">
        <NavBar />
        <Hero />
        <CatalogRow />
        <IterationStory />
        <HowItWorks />
        <Trust />
        <FinalCta />
        <Footer />
      </div>
    </TooltipProvider>
  )
}
