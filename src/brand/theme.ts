import { DEFAULT_BRANDING } from '../lib/blueprints'
import type { Branding } from '../types/experience'
import type { JourneyBrand } from '../journey/types'

/** Generic notched CTA. Merchants who pick clip-path start from this, then edit. */
export const DEFAULT_BUTTON_CLIP =
  'polygon(12px 0%, 0% 50%, 12px 100%, calc(100% - 12px) 100%, 100% 50%, calc(100% - 12px) 0%)'

export function compileBrand(brand: JourneyBrand): Branding {
  const theme = brand.theme ?? {}
  return {
    ...DEFAULT_BRANDING,
    ...theme,
    merchantName: brand.merchant,
    primaryColor: brand.primary,
    cornerRadius: brand.corners,
    buttonBorderColor: theme.buttonBorderColor ?? brand.primary,
  }
}

export function patchBrandShortcuts(
  brand: JourneyBrand,
  patch: Partial<Pick<JourneyBrand, 'merchant' | 'primary' | 'corners'>>,
): JourneyBrand {
  const next: JourneyBrand = { ...brand, ...patch }
  if (!next.theme) return next
  next.theme = {
    ...next.theme,
    ...(patch.merchant != null ? { merchantName: patch.merchant } : {}),
    ...(patch.primary != null ? { primaryColor: patch.primary } : {}),
    ...(patch.corners != null ? { cornerRadius: patch.corners } : {}),
  }
  return next
}

export function journeyBrandFrom(branding: Branding): JourneyBrand {
  return {
    merchant: branding.merchantName,
    primary: branding.primaryColor,
    corners: branding.cornerRadius,
    theme: { ...branding },
  }
}

/** Prefix merchant CSS so it cannot escape .brand-surface. Drops @import. */
export function scopeBrandCss(css: string): string {
  const cleaned = css
    .replace(/@import[^;]+;/gi, '')
    .replace(/@import\s+url\([^)]+\)/gi, '')
  return cleaned
    .split('}')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [selectors, ...rest] = chunk.split('{')
      const body = rest.join('{').trim()
      if (!selectors || !body) return ''
      const scoped = selectors
        .split(',')
        .map((s) => {
          const sel = s.trim().replace(/^(html|body)\b/i, '.brand-surface')
          if (sel.startsWith('.brand-surface')) return sel
          return `.brand-surface ${sel}`
        })
        .join(', ')
      return `${scoped} { ${body} }`
    })
    .filter(Boolean)
    .join('\n')
}
