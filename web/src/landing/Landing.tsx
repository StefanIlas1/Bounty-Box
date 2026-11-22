import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  Play,
  ShieldCheck,
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
import { siNeon, siSupabase, siUpstash, siResend, siVercel, siRailway, siAuth0, siRender, siStripe, siCloudflare, siPosthog, siRedis, siTurso, siClickhouse, siPrisma, siFlydotio, siAlgolia, siDatadog, siCloudinary, siOpenrouter, siMongodb, siSentry, siNetlify, siPerplexity } from 'simple-icons'
import { ProviderGrid, type GridMode } from './ProviderGrid'
import { IterationStory } from './IterationStory'
import { DemoVideoSection } from './DemoVideo'
import { GithubMark } from './GithubMark'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DotPattern } from '@/components/ui/dot-pattern'
import { GridPattern } from '@/components/ui/grid-pattern'
import { FlickeringGrid } from '@/components/ui/flickering-grid'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import './landing.css'

const NAV_LINKS = [
  { hash: '#how-it-works', label: 'How it works' },
  { hash: '#fig-01', label: 'Proof' },
  { hash: '#trust', label: 'Trust' },
]

const CATALOG_PROVIDERS = [
  { name: 'Neon', path: siNeon.path }, { name: 'Supabase', path: siSupabase.path }, { name: 'Upstash', path: siUpstash.path },
  { name: 'Resend', path: siResend.path }, { name: 'Vercel', path: siVercel.path }, { name: 'Railway', path: siRailway.path },
  { name: 'Auth0', path: siAuth0.path }, { name: 'Render', path: siRender.path }, { name: 'Stripe', path: siStripe.path },
  { name: 'Cloudflare', path: siCloudflare.path }, { name: 'PostHog', path: siPosthog.path }, { name: 'Redis', path: siRedis.path },
  { name: 'Turso', path: siTurso.path }, { name: 'ClickHouse', path: siClickhouse.path }, { name: 'Prisma', path: siPrisma.path },
  { name: 'Fly.io', path: siFlydotio.path }, { name: 'Algolia', path: siAlgolia.path }, { name: 'Datadog', path: siDatadog.path },
  { name: 'Cloudinary', path: siCloudinary.path }, { name: 'OpenRouter', path: siOpenrouter.path }, { name: 'MongoDB', path: siMongodb.path },
  { name: 'Sentry', path: siSentry.path }, { name: 'Netlify', path: siNetlify.path }, { name: 'Perplexity', path: siPerplexity.path },
]

const STEPS = [
  {
    n: '01', icon: PenLine, title: 'Describe', detail: 'Your brief, budget, and target users become a locked project spec.',
    shot: '/shots/describe.png',
    shotAlt: 'Describe form with a project brief, monthly budget, and target users',
  },
  {
    n: '02',
    icon: FlaskConical,
    title: 'Test',
    detail: 'The agent tests and fixes code in a CreateOS sandbox with an egress allowlist.',
    shot: '/shots/terminal.png',
    shotAlt: 'Terminal tab showing a failed test, a self-fix, then a passing load test inside the CreateOS sandbox',
  },
  {
    n: '03',
    icon: CheckCircle2,
    title: 'Approve',
    detail: 'The sandbox pauses — nothing runs or costs money while you review the stack.',
    shot: '/shots/comparisons.png',
    shotAlt: 'Comparisons table scoring three stacks on latency, error rate and monthly cost',
  },
  {
    n: '04',
    icon: Rocket,
    title: 'Buy and ship',
    detail: 'Buy services through Stripe Projects, then get your live project URL.',
    shot: '/shots/sandbox-cart.png',
    shotAlt: 'Sandbox and cart panel with an egress allowlist, a paused sandbox, and a Stripe Projects approve button',
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
    <header className="sticky top-0 z-50 h-17 border-b border-line bg-bg/90 backdrop-blur">
      <div className="flex h-full w-full items-center justify-between px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link to="/" className="shrink-0 justify-self-start" aria-label="Bounty-Box home">
          <Logo size={24} />
        </Link>

        <nav className="hidden items-center gap-10 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.hash} to={{ pathname: '/', hash: l.hash }} className="text-sm text-muted transition-colors hover:text-ink">
              {l.label}
            </Link>
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
            <Link to="/waitlist">Start a build</Link>
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
                <SheetClose asChild key={l.hash}>
                  <Link to={{ pathname: '/', hash: l.hash }} className="text-sm text-muted hover:text-ink">
                    {l.label}
                  </Link>
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
                  <Link to="/waitlist">Start a build</Link>
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
            <Link to={mode === 'hardware' ? '/waitlist?hardware=1' : '/waitlist'}>
              Start a build <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={CTA_OUTLINE}>
            <Link to={mode === 'hardware' ? '/demo?hardware=1' : '/demo'}>
              Try the demo <Play className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function CatalogRow() {
  const loop = [...CATALOG_PROVIDERS, ...CATALOG_PROVIDERS]
  return (
    <section className="border-y border-line bg-surface/40">
      <div className="py-10 text-center">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.12em] text-muted">Buys from the Stripe Projects catalog</p>
        <div className="bb-marquee-mask overflow-hidden">
          <ul className="bb-marquee flex w-max gap-7" aria-label="Providers in the Stripe Projects catalog">
            {loop.map((p, i) => (
              <li key={`${p.name}-${i}`} aria-hidden={i >= CATALOG_PROVIDERS.length} className="bb-widget flex h-[136px] w-[136px] shrink-0 flex-col items-center justify-center gap-2.5 rounded-2xl border border-gold/25 bg-surface">
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-gold" fill="currentColor" aria-hidden="true"><path d={p.path} /></svg>
                <span className="text-[17px] font-medium text-ink/80">{p.name}</span>
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
        <div className="bb-steps-grid grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="bb-step">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-blue-soft">
                  <s.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-semibold leading-6 tracking-tight text-ink">{s.title}</h3>
                <span className="text-xs tabular-nums text-muted/70">{s.n}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted">{s.detail}</p>
              {s.shot && (
                <div className="bb-shot-frame bb-step-shot">
                  <img src={s.shot} alt={s.shotAlt} width={900} height={563} loading="lazy" decoding="async" />
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
      <div aria-hidden="true" className="bb-hero-shot bb-hero-shot--left -z-10 hidden lg:block">
        <img src="/shots/code.png" alt="" loading="lazy" decoding="async" width={900} height={416} />
      </div>
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
            <Link to="/waitlist">
              Start a build <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={CTA_OUTLINE}>
            <Link to="/demo">
              Try the demo <Play className="h-4 w-4" />
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

function useScrollToHash() {
  const location = useLocation()
  useEffect(() => {
    const targetId = location.hash.slice(1)
    if (!targetId) return
    const frame = requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [location.hash, location.key])
}

export default function Landing() {
  useScrollToHash()
  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-bg text-ink">
        <NavBar />
        <Hero />
        <DemoVideoSection />
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
