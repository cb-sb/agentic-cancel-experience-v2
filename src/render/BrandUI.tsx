import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Branding } from '../types/experience'

type BrandVariant = 'primary' | 'secondary' | 'outline' | 'ghost'

interface BrandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BrandVariant
  children: ReactNode
}

/**
 * Buttons on the subscriber card are deliberately NOT sting components — they
 * must carry the merchant brand via the brand CSS variables.
 */
export function BrandButton({ variant = 'primary', children, style, ...rest }: BrandButtonProps) {
  const btnBorder = 'var(--brand-btn-border-width, 0px) solid var(--brand-btn-border-color, transparent)'
  const base: React.CSSProperties = {
    borderRadius: 'calc(var(--brand-radius) * 0.66)',
    fontWeight: 600,
    fontSize: 14,
    padding: '10px 18px',
    cursor: rest.disabled ? 'not-allowed' : 'pointer',
    transition: 'background 120ms ease, opacity 120ms ease',
    opacity: rest.disabled ? 0.5 : 1,
    lineHeight: 1.2,
    border: btnBorder,
  }
  const variants: Record<BrandVariant, React.CSSProperties> = {
    primary: { background: 'var(--brand-primary)', color: '#fff' },
    secondary: { background: 'var(--brand-secondary)', color: '#fff' },
    outline: {
      background: '#fff',
      color: 'var(--brand-primary)',
      // Outline variant keeps a visible stroke even when merchant stroke is 0.
      border:
        'max(var(--brand-btn-border-width, 0px), 1px) solid var(--brand-btn-border-color, var(--brand-primary))',
    },
    ghost: { background: 'transparent', color: 'var(--brand-primary)', border: 'var(--brand-btn-border-width, 0px) solid transparent' },
  }
  return (
    <button {...rest} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

export function BrandLogo({ branding }: { branding: Branding }) {
  if (branding.logoUrl) {
    return <img src={branding.logoUrl} alt={branding.merchantName} style={{ height: 31 }} />
  }
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: 'var(--brand-accent)',
          display: 'inline-block',
          maskImage:
            'radial-gradient(circle at 30% 30%, transparent 3px, black 3.5px), radial-gradient(circle at 70% 70%, transparent 3px, black 3.5px)',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--brand-font-heading)',
          fontWeight: 700,
          fontSize: 21,
          letterSpacing: '-0.01em',
          color: 'var(--brand-title)',
        }}
      >
        {branding.merchantName}
      </span>
    </div>
  )
}
