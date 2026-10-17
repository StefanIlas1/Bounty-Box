// Wordmark: [bounty-box] with a single-shape keyhole as the hyphen.
// Keyhole is ONE path (round head merged into the tapered slot).
export const KEYHOLE_PATH = 'M12 2a8 8 0 0 0-4.4 14.7L5.2 33h13.6l-2.4-16.3A8 8 0 0 0 12 2Z'

export function Keyhole({ className = '', size = '0.62em' }: { className?: string; size?: string }) {
  return (
    <svg viewBox="0 0 24 36" style={{ height: size, width: 'auto' }} className={className} aria-hidden="true">
      <path d={KEYHOLE_PATH} fill="var(--color-gold)" stroke="var(--color-brown)" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap font-display font-extrabold leading-none text-ink ${className}`}
      style={{
        fontSize: size,
        WebkitTextStroke: '0.035em var(--color-brown)',
        paintOrder: 'stroke fill',
        textShadow: '0.05em 0.05em 0 var(--color-gold)',
      }}
      aria-label="bounty-box"
    >
      [bounty
      <span className="mx-[0.06em] inline-flex translate-y-[0.04em]"><Keyhole /></span>
      box]
    </span>
  )
}
