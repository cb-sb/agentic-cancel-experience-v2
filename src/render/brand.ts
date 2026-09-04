import type { CSSProperties } from 'react'
import type { Branding, ShadowLevel, SurfaceStyle } from '../types/experience'

/** Drop-shadow presets shared by editable surfaces (reason rows, offer card). */
export const SURFACE_SHADOWS: Record<ShadowLevel, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
  md: '0 6px 18px -8px rgba(15, 23, 42, 0.18)',
  lg: '0 12px 34px -18px rgba(15, 23, 42, 0.28)',
}

/**
 * Resolve a component's stroke/fill/shadow into inline CSS, filling any unset
 * field from `defaults`. Border is emitted as discrete properties so callers
 * can still override just the color (e.g. a selected reason row) cleanly.
 */
export function surfaceStyleCss(
  style: SurfaceStyle | undefined,
  defaults: Required<SurfaceStyle>,
): CSSProperties {
  const s = { ...defaults, ...(style ?? {}) }
  return {
    background: s.fillColor,
    borderStyle: 'solid',
    borderWidth: s.strokeWidth,
    borderColor: s.strokeColor,
    boxShadow: SURFACE_SHADOWS[s.shadow],
  }
}

/**
 * Turn merchant branding into CSS variables consumed by the subscriber card.
 * Everything inside `.brand-surface` reads these, so the card carries the
 * merchant brand rather than ours.
 */
export function brandStyle(branding: Branding): CSSProperties {
  const headingFont = branding.headingFontFamily ?? branding.fontFamily
  const bodyFont = branding.bodyFontFamily ?? branding.fontFamily
  const btnBorderWidth = branding.buttonBorderWidth ?? 0
  const btnBorderColor = branding.buttonBorderColor ?? branding.primaryColor
  // Heading typography is controlled independently of body; size is a scale
  // multiplier so each heading keeps its relative place in the hierarchy.
  const headingWeight = branding.headingFontWeight ?? 700
  const headingScale = (branding.headingFontScale ?? 100) / 100
  const headingLine = branding.headingLineHeight ?? 1.2
  const headingSpacing = branding.headingLetterSpacing ?? 0
  return {
    // custom props are valid CSS but not in the typed CSSProperties surface
    ['--brand-primary' as string]: branding.primaryColor,
    ['--brand-primary-hover' as string]: shade(branding.primaryColor, -12),
    ['--brand-secondary' as string]: branding.secondaryColor,
    ['--brand-accent' as string]: branding.accentColor,
    ['--brand-site' as string]: branding.siteColor,
    // Header bar fill — transparent by default so it reads as the card fill.
    ['--brand-header' as string]: branding.headerColor ?? 'transparent',
    // Emit fill & border as background-IMAGES (solids wrapped as gradients) so
    // the modal card's layered background stays a valid CSS declaration — a bare
    // <color> is only allowed in a shorthand's final layer, so a solid fill in
    // the first layer would otherwise invalidate the whole rule.
    ['--brand-card' as string]: toImage(cardFillCss(branding)),
    ['--brand-card-border' as string]: toImage(cardBorderCss(branding)),
    ['--brand-card-border-width' as string]: `${branding.cardBorderWidth}px`,
    ['--brand-title' as string]: branding.titleColor,
    ['--brand-text' as string]: branding.textColor,
    ['--brand-muted' as string]: branding.mutedColor,
    ['--brand-font-heading' as string]: headingFont,
    ['--brand-font-body' as string]: bodyFont,
    ['--brand-btn-border-width' as string]: `${btnBorderWidth}px`,
    ['--brand-btn-border-color' as string]: btnBorderColor,
    ['--brand-font-size' as string]: `${branding.fontSizeBase}px`,
    ['--brand-line-height' as string]: String(branding.fontLineHeight),
    ['--brand-font-weight' as string]: String(branding.fontWeight),
    ['--brand-letter-spacing' as string]: `${branding.letterSpacing / 100}em`,
    ['--brand-heading-weight' as string]: String(headingWeight),
    ['--brand-heading-scale' as string]: String(headingScale),
    ['--brand-heading-line-height' as string]: String(headingLine),
    ['--brand-heading-letter-spacing' as string]: `${headingSpacing / 100}em`,
    ['--brand-text-align' as string]: branding.textAlign,
    ['--brand-radius' as string]: `${branding.cornerRadius}px`,
  }
}

/** Coerce a paint value into a background-image so it's valid in any bg layer. */
function toImage(value: string): string {
  return value.trimStart().startsWith('linear-gradient')
    ? value
    : `linear-gradient(${value}, ${value})`
}

/** Shared CTA border from branding tokens. */
export function brandBtnBorderStyle(): CSSProperties {
  return {
    border: 'var(--brand-btn-border-width, 0px) solid var(--brand-btn-border-color, transparent)',
  }
}

/** CSS value for the card fill — a flat color or a two-stop linear gradient. */
export function cardFillCss(b: Branding): string {
  return b.cardFillType === 'gradient'
    ? `linear-gradient(${b.cardGradientAngle}deg, ${b.cardGradientFrom}, ${b.cardGradientTo})`
    : b.cardColor
}

/** CSS paint for the card border — a flat color or a two-stop linear gradient. */
export function cardBorderCss(b: Branding): string {
  return b.cardBorderType === 'gradient'
    ? `linear-gradient(${b.cardBorderGradientAngle}deg, ${b.cardBorderGradientFrom}, ${b.cardBorderGradientTo})`
    : b.cardBorderColor
}

/** Lighten/darken a hex color by a percentage (-100..100). */
export function shade(hex: string, percent: number): string {
  const parsed = normalizeHex(hex)
  if (!parsed) return hex
  const amt = Math.round(2.55 * percent)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(parsed.r + amt)
  const g = clamp(parsed.g + amt)
  const b = clamp(parsed.b + amt)
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Tint a hex toward white to build subtle offer/impact backgrounds. */
export function tint(hex: string, alpha: number): string {
  const parsed = normalizeHex(hex)
  if (!parsed) return hex
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`
}

function normalizeHex(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return null
  const num = parseInt(h, 16)
  if (Number.isNaN(num)) return null
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}
