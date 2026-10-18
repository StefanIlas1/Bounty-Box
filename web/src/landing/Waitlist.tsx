import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../shared/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Waitlist() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (status === 'saving' || status === 'saved') return
    setStatus('saving'); setError('')
    try {
      const response = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, website }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not join the waitlist.')
      setStatus('saved')
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); setStatus('idle') }
  }
  return <main className="flex min-h-screen flex-col bg-bg text-ink">
    <header className="flex items-center justify-between border-b border-line px-6 py-5"><Link to="/"><Logo size={24} /></Link><Link to="/" className="text-sm text-muted hover:text-ink">Back to site</Link></header>
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm text-gold">Build big. Stay under budget.</p>
      <h1 className="font-display text-4xl font-semibold">Join our waitlist</h1>
      <p className="mt-4 text-muted">Be first to know when Bounty-Box is ready for your builds.</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <Label htmlFor="waitlist-email">Email address</Label>
        <div className="flex flex-col gap-2 sm:flex-row"><Input id="waitlist-email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={status === 'saved'} className="h-12" /><Button type="submit" disabled={status !== 'idle'} className="h-12 bg-gold text-on-gold hover:bg-gold/85">{status === 'saving' ? 'Joining…' : status === 'saved' ? 'Joined' : 'Join waitlist'}</Button></div>
        <Link to={params.get('hardware') === '1' ? '/demo?hardware=1' : '/demo'} className="text-sm font-medium text-gold underline underline-offset-4">Try the demo →</Link>
        <div className="hidden" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></div>
        {status === 'saved' && <p role="status" className="text-sm text-ink">You’re on the list! We’ll email you when access opens.</p>}
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <p className="mt-3 text-xs text-muted">By joining, you agree to receive Bounty-Box launch updates by email.</p>
      </form>
    </div>
  </main>
}
