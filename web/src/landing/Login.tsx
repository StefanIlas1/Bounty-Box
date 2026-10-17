import { Link } from 'react-router-dom'
import { GithubMark } from './GithubMark'
import { Logo } from '../shared/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  return (
    <div className="grid min-h-screen bg-bg text-ink lg:grid-cols-[1.2fr_1fr]">
      <div className="relative flex min-h-[260px] flex-col justify-end overflow-hidden bg-gradient-to-br from-surface-2 via-bg to-bg px-8 py-10 sm:px-12 lg:min-h-screen lg:px-16 lg:py-16">
        <p className="font-display text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
          Building big
          <br />
          <span className="text-gold">under budget.</span>
        </p>
        <p className="mt-5 max-w-sm text-sm text-muted">Your last run: waitlist app · live · $27.40/mo</p>
      </div>

      <div className="flex flex-col justify-center gap-6 px-8 py-12 sm:px-12 lg:px-16">
        <Link to="/" aria-label="Bounty-Box home" className="mb-2">
          <Logo size={22} />
        </Link>

        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Pick up where your last run left off.</p>
        </div>

        <Button asChild className="h-auto justify-center gap-2 rounded-lg py-3 text-sm font-semibold">
          <Link to="/app">
            <GithubMark className="h-4 w-4" /> Continue with GitHub
          </Link>
        </Button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-muted">
            Email
          </Label>
          <Input id="email" type="email" placeholder="you@team.dev" autoComplete="email" className="h-10 rounded-lg px-3" />
        </div>

        <Button
          asChild
          variant="outline"
          className="h-auto justify-center rounded-lg border-blue/50 py-3 text-sm font-semibold text-ink hover:border-blue hover:bg-blue/10"
        >
          <Link to="/app">Email me a sign-in link</Link>
        </Button>

        <p className="text-xs text-muted">Nothing is bought until you approve the stack.</p>
      </div>
    </div>
  )
}
