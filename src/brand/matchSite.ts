import { DEFAULT_BRANDING } from '../lib/blueprints'
import type { Branding } from '../types/experience'
import type { JourneyBrand, JourneyKind } from '../journey/types'
import { samplePaletteFromFile, type MediaKind, type PaletteSwatch } from './sampleMedia'

/** Generic notched CTA. Merchants who need clip-path start from this, then edit. */
export const DEFAULT_BUTTON_CLIP =
  'polygon(12px 0%, 0% 50%, 12px 100%, calc(100% - 12px) 100%, 100% 50%, calc(100% - 12px) 0%)'

const FONT_STACKS: { test: RegExp; stack: string; url?: string; label: string }[] = [
  { test: /\binter\b/, stack: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { test: /\broboto\b/, stack: "'Roboto', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap', label: 'Roboto' },
  { test: /\bpoppins\b/, stack: "'Poppins', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap', label: 'Poppins' },
  { test: /\bbarlow\b/, stack: "'Barlow', 'Segoe UI', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;900&display=swap', label: 'Barlow' },
  { test: /\bmontserrat\b/, stack: "'Montserrat', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap', label: 'Montserrat' },
  { test: /\bgeorgia\b/, stack: "'Georgia', serif", label: 'Georgia' },
  { test: /\barial\b/, stack: "'Arial', Helvetica, sans-serif", label: 'Arial' },
  { test: /\bhelvetica\b/, stack: "'Helvetica Neue', Helvetica, sans-serif", label: 'Helvetica Neue' },
  { test: /\bspace grotesk\b/, stack: "'Space Grotesk', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap', label: 'Space Grotesk' },
]

const URL_RE = /https?:\/\/[^\s)]+/i
const HOST_RE = /\b(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/i

export function extractSiteUrl(text: string): string | null {
  const href = text.match(URL_RE)
  if (href) return href[0].replace(/[.,;]+$/, '')
  const host = text.match(HOST_RE)
  if (!host) return null
  const raw = host[0]
  if (!/\.[a-z]{2,}$/i.test(raw)) return null
  if (/^(step|cancel|chargebee|localhost)/i.test(raw)) return null
  return `https://${raw.replace(/^www\./i, '')}`
}

/** Label from the host the snippet will run on — account.acme.com → Acme. */
export function merchantFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    const parts = host.split('.').filter(Boolean)
    const skip = new Set(['account', 'accounts', 'app', 'my', 'www', 'billing', 'payments', 'pay', 'store', 'shop', 'secure', 'login'])
    const brand = parts.find((p) => !skip.has(p.toLowerCase()) && p !== 'com' && p !== 'io' && p !== 'co') ?? parts[0]
    return brand.charAt(0).toUpperCase() + brand.slice(1)
  } catch {
    return 'Your brand'
  }
}

function hexes(text: string): string[] {
  const found = text.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi) ?? []
  return found.map((h) => {
    if (h.length === 4) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
    return h
  })
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 1
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return 1
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function darkSurfaces(primary: string): Partial<Branding> {
  const lightCta = luminance(primary) > 0.55
  return {
    siteColor: '#1a1b22',
    cardColor: '#1d202b',
    headerColor: '#1a1b22',
    cardFillType: 'solid',
    cardBorderColor: '#404252',
    cardBorderWidth: 1,
    cardShadow: '0 0 28px rgba(0,0,0,0.45)',
    titleColor: '#ffffff',
    textColor: '#d7d7d7',
    mutedColor: '#86868c',
    buttonTextColor: lightCta ? '#1a1a1a' : '#ffffff',
  }
}

function lightSurfaces(): Partial<Branding> {
  return {
    siteColor: DEFAULT_BRANDING.siteColor,
    cardColor: DEFAULT_BRANDING.cardColor,
    headerColor: undefined,
    titleColor: DEFAULT_BRANDING.titleColor,
    textColor: DEFAULT_BRANDING.textColor,
    mutedColor: DEFAULT_BRANDING.mutedColor,
    buttonTextColor: '#ffffff',
  }
}

export function isBrandIntent(text: string): boolean {
  const t = text.toLowerCase()
  if (extractSiteUrl(text) && !/\b(cancel|acquire|acquisition|step|survey|offer|pause|discount)\b/.test(t)) {
    return true
  }
  return (
    /\b(brand|branding|look like (my |our )?site|match my site|live (site|branding)|typeface|clip-?path|hex buttons?)\b/.test(t) ||
    (hexes(text).length > 0 && /\b(color|button|theme|dark|navy|gold|primary)\b/.test(t)) ||
    /\b(dark theme|dark mode|inky|navy (theme|ui)|pill buttons?|rounded buttons?)\b/.test(t)
  )
}

/** Tokens from what the merchant said — no named-brand fixtures. */
export function brandingFromSpeech(text: string, base: Branding): { branding: Branding; notes: string[] } {
  const t = text.toLowerCase()
  const notes: string[] = []
  const next: Branding = { ...base }
  const url = extractSiteUrl(text)
  if (url) {
    next.merchantName = merchantFromUrl(url)
    notes.push(`named it ${next.merchantName} from the site URL`)
  }

  const colors = hexes(text)
  if (colors[0]) {
    next.primaryColor = colors[0]
    next.buttonBorderColor = colors[0]
    next.buttonGradientFrom = colors[0]
    notes.push(`set primary to ${colors[0].toUpperCase()}`)
  }
  if (colors[1]) {
    next.accentColor = colors[1]
    next.buttonGradientTo = colors[1]
    notes.push(`set accent to ${colors[1].toUpperCase()}`)
  }
  if (colors[2]) {
    next.secondaryColor = colors[2]
  }

  const font = FONT_STACKS.find((f) => f.test.test(t))
  if (font) {
    next.fontFamily = font.stack
    next.headingFontFamily = font.stack
    next.bodyFontFamily = font.stack
    next.fontUrl = font.url
    next.headingFontUrl = font.url
    notes.push(`set type to ${font.label}`)
  }

  if (/\b(dark|inky|navy theme|dark mode|dark ui)\b/.test(t) || (colors[0] && luminance(colors[0]) > 0.6 && /\bdark\b/.test(t))) {
    Object.assign(next, darkSurfaces(next.primaryColor))
    notes.push('applied dark surfaces so type stays readable')
  } else if (/\b(light theme|light mode|white (card|background))\b/.test(t)) {
    Object.assign(next, lightSurfaces())
    notes.push('applied light surfaces')
  } else if (luminance(next.cardColor) < 0.35) {
    Object.assign(next, darkSurfaces(next.primaryColor))
  }

  if (/\b(pill|fully rounded)\b/.test(t)) {
    next.buttonShape = 'pill'
    notes.push('set buttons to pill')
  } else if (/\b(hex|clip(?:-?path)?|notched|chevron buttons?)\b/.test(t)) {
    next.buttonShape = 'clip'
    next.buttonClipPath = next.buttonClipPath || DEFAULT_BUTTON_CLIP
    notes.push('set buttons to a clip-path')
  } else if (/\brounded\b/.test(t)) {
    next.buttonShape = 'radius'
    notes.push('set buttons to rounded')
  }

  if (/\bgradient\b/.test(t) && colors.length >= 1) {
    next.buttonFillType = 'gradient'
    next.buttonGradientFrom = colors[0]
    next.buttonGradientTo = colors[1] ?? colors[0]
    notes.push('set a two-stop button gradient')
  }

  const corners = t.match(/(\d+)\s*px/)
  if (corners) {
    const n = Math.max(0, Math.min(24, Number(corners[1])))
    next.cornerRadius = n
    notes.push(`set corners to ${n}px`)
  }

  return { branding: next, notes }
}

function pickCssColor(css: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const m = css.match(new RegExp(`${key}\\s*:\\s*(#[0-9a-f]{3,8}|rgb\\([^)]+\\))`, 'i'))
    if (m) {
      const v = m[1]
      if (v.startsWith('#')) return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v.slice(0, 7)
    }
  }
  return undefined
}

/** Best-effort sample of a live page. Isolation still applies — we copy tokens, we do not inherit CSS. */
export function brandingFromHtml(html: string, url: string, base: Branding): { branding: Branding; notes: string[] } {
  const notes: string[] = []
  const next: Branding = { ...base, merchantName: merchantFromUrl(url) }
  notes.push(`named it ${next.merchantName} from the page the snippet will run on`)

  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i)
  if (theme?.[1]?.startsWith('#')) {
    next.primaryColor = theme[1].slice(0, 7)
    next.buttonBorderColor = next.primaryColor
    notes.push(`sampled theme-color ${next.primaryColor.toUpperCase()}`)
  }

  const fontHref = html.match(/fonts\.googleapis\.com\/css2\?family=([A-Za-z+]+)[^"']*/i)
  if (fontHref) {
    const family = decodeURIComponent(fontHref[1].replace(/\+/g, ' '))
    const known = FONT_STACKS.find((f) => f.label.toLowerCase() === family.toLowerCase() || f.test.test(family.toLowerCase()))
    const stack = known?.stack ?? `'${family}', system-ui, sans-serif`
    next.fontFamily = stack
    next.headingFontFamily = stack
    next.bodyFontFamily = stack
    next.fontUrl = `https://${fontHref[0]}`
    next.headingFontUrl = next.fontUrl
    notes.push(`sampled ${family} from the page stylesheet`)
  }

  const bg = pickCssColor(html, ['background-color', '--background', '--bg', '--color-background'])
  const fg = pickCssColor(html, ['--color-text', '--text', 'color'])
  const btn = pickCssColor(html, ['--color-primary', '--primary', '--brand'])
  if (btn && !theme) {
    next.primaryColor = btn
    next.buttonBorderColor = btn
    notes.push(`sampled a primary token ${btn.toUpperCase()}`)
  }
  if (bg?.startsWith('#')) {
    next.cardColor = bg
    next.siteColor = bg
    if (luminance(bg) < 0.4) Object.assign(next, darkSurfaces(next.primaryColor), { cardColor: bg, siteColor: bg })
    notes.push('sampled a surface color')
  }
  if (fg?.startsWith('#') && luminance(next.cardColor) >= 0.4) {
    next.textColor = fg
  }

  if (/\bclip-path\s*:\s*polygon/i.test(html)) {
    const clip = html.match(/clip-path\s*:\s*(polygon\([^)]+\))/i)
    next.buttonShape = 'clip'
    next.buttonClipPath = clip?.[1] ?? DEFAULT_BUTTON_CLIP
    notes.push('sampled a clip-path on CTAs')
  }

  const logo = html.match(/<link[^>]+rel=["'](?:icon|apple-touch-icon)["'][^>]+href=["']([^"']+)/i)
  if (logo?.[1]) {
    try {
      next.logoUrl = new URL(logo[1], url).href
      notes.push('sampled the site icon as a logo')
    } catch {
      /* ignore */
    }
  }

  return { branding: next, notes }
}

export async function fetchSiteHtml(url: string): Promise<{ html?: string; blocked?: boolean; status?: number }> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return { status: res.status }
    const html = await res.text()
    return { html }
  } catch {
    return { blocked: true }
  }
}

export interface MatchSiteResult {
  branding: Branding
  reply: string
  sampled: boolean
  /** Tokens were written — enough to count the brand step as done. */
  applied: boolean
}

export function isBrandMatched(brand: JourneyBrand): boolean {
  return brand.matched === true
}

export function brandGatePrompt(kind: JourneyKind): string {
  const what = kind === 'acquisition' ? 'pricing table' : 'cancel UI'
  return `Match this ${what} to the page it will run on — screenshot, URL, or a short description.`
}

/**
 * Match the subscriber UI to the merchant — from a live URL, from copy they typed,
 * or both. Applies to cancel and acquisition. Never inherits host CSS; tokens +
 * scoped hatch stay the apply path.
 */
export async function matchMerchantBrand(text: string, base: Branding): Promise<MatchSiteResult> {
  const spoken = brandingFromSpeech(text, base)
  let branding = spoken.branding
  const notes = [...spoken.notes]
  let sampled = false
  const url = extractSiteUrl(text)

  if (url) {
    const page = await fetchSiteHtml(url)
    if (page.html) {
      const fromPage = brandingFromHtml(page.html, url, branding)
      branding = fromPage.branding
      notes.push(...fromPage.notes)
      sampled = true
    } else if (page.blocked) {
      notes.push(
        "couldn't sample computed styles from here (the page isn't readable in this studio). Drop a screenshot of the billing page, or describe colors, type, and button shape",
      )
    } else if (page.status) {
      notes.push(`the site returned ${page.status}, so I used the URL and what you described`)
    }
  }

  if (notes.length === 0) {
    return {
      branding: base,
      sampled: false,
      applied: false,
      reply:
        'I need a screenshot or video of the billing page, the URL where the snippet will run, or a description — colors, dark or light, type, button shape.',
    }
  }

  const list =
    notes.length === 1
      ? notes[0]
      : `${notes.slice(0, -1).join('; ')}; ${notes[notes.length - 1]}`
  return {
    branding,
    sampled,
    applied: true,
    reply: `Matched your brand: ${list}. Native look is applied as tokens (and scoped CSS if you need geometry the tokens can’t express) — it stays isolated from the host page. Refine anything in Experiences → Branding.`,
  }
}

function rgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function saturation(hex: string): number {
  const { r, g, b } = rgb(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

function dist(a: string, b: string): number {
  const A = rgb(a)
  const B = rgb(b)
  return Math.hypot(A.r - B.r, A.g - B.g, A.b - B.b)
}

function mix(a: string, b: string, t: number): string {
  const A = rgb(a)
  const B = rgb(b)
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t)
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(ch(A.r, B.r))}${hex(ch(A.g, B.g))}${hex(ch(A.b, B.b))}`
}

function contrastOn(bg: string): string {
  return luminance(bg) > 0.55 ? '#111827' : '#ffffff'
}

/**
 * Map a sampled screenshot/video palette onto the token set the subscriber UI
 * actually uses. Dominant paint becomes the surface; saturated leftovers become
 * primary/accent; type colors follow surface luminance.
 */
export function brandingFromPalette(
  base: Branding,
  palette: PaletteSwatch[],
  source: MediaKind,
): { branding: Branding; notes: string[] } {
  const notes: string[] = []
  const next: Branding = { ...base }
  if (palette.length === 0) return { branding: next, notes }

  const surface = palette[0].hex
  next.siteColor = surface
  next.cardColor = surface
  next.headerColor = surface
  next.cardFillType = 'solid'
  notes.push(`set the surface to ${surface.toUpperCase()} from the ${source}`)

  const rest = palette.filter((s) => dist(s.hex, surface) > 36)
  const colorful = rest
    .filter((s) => saturation(s.hex) > 0.22 && dist(s.hex, surface) > 70)
    .sort((a, b) => saturation(b.hex) * Math.sqrt(b.count) - saturation(a.hex) * Math.sqrt(a.count))

  const primary = colorful[0]?.hex
  if (primary) {
    next.primaryColor = primary
    next.buttonBorderColor = primary
    next.buttonGradientFrom = primary
    notes.push(`set primary to ${primary.toUpperCase()}`)
  }
  const accent = colorful.find((s) => dist(s.hex, next.primaryColor) > 40)?.hex
  if (accent) {
    next.accentColor = accent
    next.buttonGradientTo = accent
    notes.push(`set accent to ${accent.toUpperCase()}`)
  }

  const typeCandidates = rest.length > 0 ? rest : palette
  if (luminance(surface) > 0.55) {
    const dark = [...typeCandidates].sort((a, b) => luminance(a.hex) - luminance(b.hex))[0]?.hex
    next.titleColor = dark ?? '#0f172a'
    next.textColor = dark ? mix(dark, surface, 0.18) : '#334155'
    next.mutedColor = mix(next.textColor, surface, 0.45)
    Object.assign(next, lightSurfaces(), {
      siteColor: surface,
      cardColor: surface,
      headerColor: surface,
      titleColor: next.titleColor,
      textColor: next.textColor,
      mutedColor: next.mutedColor,
    })
  } else {
    const light = [...typeCandidates].sort((a, b) => luminance(b.hex) - luminance(a.hex))[0]?.hex
    Object.assign(next, darkSurfaces(next.primaryColor), {
      siteColor: surface,
      cardColor: surface,
      headerColor: surface,
      titleColor: light ?? '#ffffff',
      textColor: light ? mix(light, surface, 0.12) : '#d7d7d7',
      mutedColor: mix(light ?? '#ffffff', surface, 0.4),
    })
    notes.push('applied dark surfaces so type stays readable')
  }

  next.buttonTextColor = contrastOn(next.primaryColor)
  next.cardBorderColor = mix(surface, next.textColor, 0.18)

  return { branding: next, notes }
}

export async function matchMerchantBrandFromMedia(
  file: File,
  base: Branding,
): Promise<MatchSiteResult> {
  try {
    const { palette, kind } = await samplePaletteFromFile(file)
    const { branding, notes } = brandingFromPalette(base, palette, kind)
    if (notes.length === 0) {
      return {
        branding: base,
        sampled: false,
        applied: false,
        reply: 'I couldn’t read enough color from that file. Try a clearer crop of the billing page.',
      }
    }
    const list =
      notes.length === 1
        ? notes[0]
        : `${notes.slice(0, -1).join('; ')}; ${notes[notes.length - 1]}`
    return {
      branding,
      sampled: true,
      applied: true,
      reply: `Matched your brand from the ${kind}: ${list}. Edit the tokens below, or refine further in Experiences → Branding.`,
    }
  } catch (err) {
    return {
      branding: base,
      sampled: false,
      applied: false,
      reply: err instanceof Error ? err.message : 'That file could not be sampled.',
    }
  }
}
