import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ShieldCheck, Scale, Tag } from 'lucide-react'
import { NavBar } from './Landing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DotPattern } from '@/components/ui/dot-pattern'
import { BorderBeam } from '@/components/ui/border-beam'

const CATEGORIES = ['Database', 'Cache / key-value', 'Hosting / compute', 'Auth', 'Email / messaging', 'Search', 'AI / models', 'Storage / CDN', 'Observability', 'Payments', 'Hardware / components', 'Other']

type Form = {
  company: string; contactName: string; email: string; product: string; website: string; links: string
  category: string; description: string; inCatalog: string; standardPricing: string; partnerPricing: string; freeTier: string; notes: string
}

const EMPTY: Form = {
  company: '', contactName: '', email: '', product: '', website: '', links: '', category: '', description: '',
  inCatalog: '', standardPricing: '', partnerPricing: '', freeTier: '', notes: '',
}

const RULES = [
  { icon: Scale, title: 'Same tests as everyone', body: 'Your service is load-tested in the same CreateOS sandbox, against the same thresholds as every alternative.' },
  { icon: Tag, title: 'You win on price, not placement', body: 'A partner is only recommended when it beats the cheapest qualifying market option. Partner picks are always labelled.' },
  { icon: ShieldCheck, title: 'Your partner rate stays private', body: 'Users see their total and why your service won. Your discounted rate is never shown publicly.' },
]

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm text-ink">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

export default function Saas() {
  const [f, setF] = useState<Form>(EMPTY)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'saved'>('idle')
  const [copied, setCopied] = useState(false)
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const summary = () =>
    [
      `Bounty-Box partner application`,
      `Company: ${f.company}`, `Contact: ${f.contactName} <${f.email}>`, `Product: ${f.product} (${f.category})`,
      `Website: ${f.website}`, `Links: ${f.links}`, `In Stripe Projects catalog: ${f.inCatalog}`,
      `What it does: ${f.description}`, `Standard pricing: ${f.standardPricing}`,
      `Partner pricing offered: ${f.partnerPricing}`, `Free tier: ${f.freeTier}`, `Notes: ${f.notes}`,
    ].join('\n')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch('/api/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      if (!res.ok) throw new Error(String(res.status))
      setState('sent')
    } catch {
      try { localStorage.setItem('bb-partner-application', JSON.stringify({ ...f, savedAt: Date.now() })) } catch { /* storage unavailable */ }
      setState('saved')
    }
  }

  const ready = f.company && f.email && f.product && f.category && f.description && f.standardPricing && f.partnerPricing

  return (
    <div className="min-h-svh bg-bg text-ink">
      <NavBar />

      <section className="relative isolate overflow-hidden border-b border-line">
        <DotPattern aria-hidden="true" width={22} height={22} cr={1} className="pointer-events-none absolute inset-0 -z-10 fill-brown-soft/30 [mask-image:radial-gradient(600px_circle_at_30%_30%,white,transparent)]" />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1fr_1.15fr] lg:py-20">
          <div className="flex flex-col gap-6">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-gold">For SaaS companies</p>
            <h1 className="font-display text-[clamp(2rem,4.4vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight">
              Get picked by the agent that <span className="text-gold">buys infrastructure.</span>
            </h1>
            <p className="max-w-lg text-muted sm:text-lg">
              Bounty-Box chooses and purchases stacks for developers through Stripe Projects. Tell us about your product and the rate you'd offer
              Bounty-Box users. If it passes our tests and beats the market, it gets recommended.
            </p>
            <div className="mt-2 flex flex-col gap-4">
              {RULES.map((r) => (
                <div key={r.title} className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-blue-soft"><r.icon className="h-4 w-4" /></div>
                  <div>
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-sm text-muted">{r.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-line bg-surface p-6 sm:p-8">
            <BorderBeam size={120} duration={9} colorFrom="#e9b949" colorTo="#635bff" />
            {state === 'sent' || state === 'saved' ? (
              <div className="flex flex-col gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue/15 text-blue-soft"><Check className="h-5 w-5" /></div>
                <h2 className="font-display text-2xl font-bold">{state === 'sent' ? 'Application received' : 'Saved on this device'}</h2>
                <p className="text-muted">
                  {state === 'sent'
                    ? `Thanks, ${f.contactName || f.company}. We'll test ${f.product} against the current catalog and reply to ${f.email}.`
                    : "We couldn't reach our server right now, so your application is saved in this browser. Copy it below and send it to the Bounty-Box team."}
                </p>
                {state === 'saved' && (
                  <>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-navy p-4 font-mono text-xs text-ink/90">{summary()}</pre>
                    <Button type="button" variant="outline" className="self-start" onClick={() => { navigator.clipboard.writeText(summary()).then(() => setCopied(true)).catch(() => {}) }}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy application'}
                    </Button>
                  </>
                )}
                <Button type="button" variant="ghost" className="self-start text-muted" onClick={() => { setF(EMPTY); setState('idle'); setCopied(false) }}>Submit another product</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-5">
                <h2 className="font-display text-xl font-bold">Partner application</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="company" label="Company *"><Input id="company" value={f.company} onChange={set('company')} placeholder="Acme Data Inc." required /></Field>
                  <Field id="product" label="Product *"><Input id="product" value={f.product} onChange={set('product')} placeholder="Acme Postgres" required /></Field>
                  <Field id="contactName" label="Your name"><Input id="contactName" value={f.contactName} onChange={set('contactName')} placeholder="Jordan Lee" /></Field>
                  <Field id="email" label="Work email *"><Input id="email" type="email" value={f.email} onChange={set('email')} placeholder="jordan@acme.dev" required /></Field>
                  <Field id="category" label="Category *">
                    <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                      <SelectTrigger id="category" className="w-full"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field id="inCatalog" label="Listed in Stripe Projects?">
                    <Select value={f.inCatalog} onValueChange={(v) => setF({ ...f, inCatalog: v })}>
                      <SelectTrigger id="inCatalog" className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="in-progress">In progress</SelectItem>
                        <SelectItem value="no">Not yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field id="website" label="Website"><Input id="website" type="url" value={f.website} onChange={set('website')} placeholder="https://acme.dev" /></Field>
                <Field id="links" label="Docs, pricing page or other links" hint="One per line."><Textarea id="links" value={f.links} onChange={set('links')} rows={2} placeholder={'https://acme.dev/docs\nhttps://acme.dev/pricing'} /></Field>
                <Field id="description" label="What it does *"><Textarea id="description" value={f.description} onChange={set('description')} rows={3} placeholder="Serverless Postgres with branching and a generous free tier…" required /></Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="standardPricing" label="Your standard rates *" hint="Plans and $/month as listed publicly."><Textarea id="standardPricing" value={f.standardPricing} onChange={set('standardPricing')} rows={3} placeholder={'Free: 0.5 GB\nLaunch: $19/mo\nScale: $69/mo'} required /></Field>
                  <Field id="partnerPricing" label="Discount you'd offer *" hint="Private. Never shown to users."><Textarea id="partnerPricing" value={f.partnerPricing} onChange={set('partnerPricing')} rows={3} placeholder={'Launch at $12/mo for Bounty-Box users\n(37% off) for the first 12 months'} required /></Field>
                </div>
                <Field id="freeTier" label="Free tier or trial"><Input id="freeTier" value={f.freeTier} onChange={set('freeTier')} placeholder="0.5 GB storage, 190 compute hours" /></Field>
                <Field id="notes" label="Anything else"><Textarea id="notes" value={f.notes} onChange={set('notes')} rows={2} placeholder="Regions, limits, sponsorship interest…" /></Field>
                <Button type="submit" disabled={!ready || state === 'sending'} className="h-11 bg-gold font-semibold text-on-gold hover:bg-gold/90">
                  {state === 'sending' ? 'Sending…' : 'Submit application'}
                </Button>
                <p className="text-xs text-muted">We test every applicant the same way. Submitting doesn't guarantee placement.</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
