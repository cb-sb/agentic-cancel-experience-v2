import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { scopeBrandCss } from '../brand/theme'
import { brandStyle } from './brand'
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
export function BrandButton({ variant = 'primary', children, className, style, ...rest }: BrandButtonProps) {
  const btnBorder = 'var(--brand-btn-border-width, 0px) solid var(--brand-btn-border-color, transparent)'
  const clip = variant === 'primary' ? 'var(--brand-btn-clip, none)' : undefined
  const radius = variant === 'primary' ? 'var(--brand-btn-radius)' : 'calc(var(--brand-radius) * 0.66)'
  const base: CSSProperties = {
    borderRadius: radius,
    fontWeight: 600,
    fontSize: 14,
    padding: '10px 18px',
    cursor: rest.disabled ? 'not-allowed' : 'pointer',
    transition: 'background 120ms ease, opacity 120ms ease, filter 120ms ease',
    opacity: rest.disabled ? 0.5 : 1,
    lineHeight: 1.2,
    border: btnBorder,
    clipPath: clip,
  }
  const variants: Record<BrandVariant, CSSProperties> = {
    primary: {
      background: 'var(--brand-btn-fill, var(--brand-primary))',
      color: 'var(--brand-btn-text, #fff)',
    },
    secondary: { background: 'var(--brand-secondary)', color: '#fff' },
    outline: {
      background: 'var(--brand-card-solid, var(--brand-card, #fff))',
      color: 'var(--brand-title, var(--brand-primary))',
      border:
        'max(var(--brand-btn-border-width, 0px), 1px) solid var(--brand-btn-border-color, var(--brand-primary))',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--brand-primary)',
      border: 'var(--brand-btn-border-width, 0px) solid transparent',
    },
  }
  return (
    <button
      {...rest}
      className={['brand-btn', `brand-btn-${variant}`, className].filter(Boolean).join(' ')}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  )
}

/** Applies tokens, merchant font stylesheets, and the scoped CSS hatch. */
export function BrandRoot({
  branding,
  className,
  style,
  children,
}: {
  branding: Branding
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const css = branding.customCss?.trim()
  const scoped = css ? scopeBrandCss(css) : ''
  const headingUrl = branding.headingFontUrl && branding.headingFontUrl !== branding.fontUrl
    ? branding.headingFontUrl
    : null
  return (
    <div className={className} style={{ ...brandStyle(branding), ...style }}>
      {branding.fontUrl && <link rel="stylesheet" href={branding.fontUrl} />}
      {headingUrl && <link rel="stylesheet" href={headingUrl} />}
      {scoped ? <style dangerouslySetInnerHTML={{ __html: scoped }} /> : null}
      {children}
    </div>
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
