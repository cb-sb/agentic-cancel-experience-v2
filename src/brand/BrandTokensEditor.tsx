import { compileBrand } from './theme'
import { useJourney } from '../store/useJourney'
import type { Branding } from '../types/experience'

const TOKENS: { key: keyof Branding; label: string }[] = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'accentColor', label: 'Accent' },
  { key: 'cardColor', label: 'Surface' },
  { key: 'titleColor', label: 'Title' },
  { key: 'textColor', label: 'Text' },
]

function normalizeHex(value: string): string | null {
  const raw = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase()
  }
  return null
}

/**
 * Compact editable token strip after a site match. Writes through applyBrand so
 * the canvas and preview pick up the same tokens the studio edits.
 */
export function BrandTokensEditor() {
  const brand = useJourney((s) => s.file.brand)
  const applyBrand = useJourney((s) => s.applyBrand)
  const branding = compileBrand(brand)

  const set = (key: keyof Branding, hex: string) => {
    const next = { ...branding, [key]: hex }
    if (key === 'cardColor') {
      next.siteColor = hex
      next.headerColor = hex
    }
    if (key === 'primaryColor') {
      next.buttonBorderColor = hex
      next.buttonGradientFrom = hex
    }
    applyBrand(next, true)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-bold uppercase leading-normal text-[#4b5563]">Design tokens</p>
      <div className="flex flex-col gap-1.5">
        {TOKENS.map(({ key, label }) => {
          const value = String(branding[key] ?? '#000000')
          const picker = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
          return (
            <label key={key} className="flex items-center gap-2">
              <span className="w-[58px] flex-none text-[12px] text-[#4b5563]">{label}</span>
              <span className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-[#e5e7eb]">
                <span className="relative block h-7 w-7 flex-none" style={{ background: value }}>
                  <input
                    type="color"
                    value={picker}
                    onChange={(e) => set(key, e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label={label}
                  />
                </span>
                <input
                  value={value.toUpperCase()}
                  onChange={(e) => {
                    const hex = normalizeHex(e.target.value)
                    if (hex) set(key, hex)
                  }}
                  spellCheck={false}
                  className="min-w-0 flex-1 border-l border-[#e5e7eb] bg-white px-2 py-1 text-[12px] uppercase text-[#111827] outline-none"
                />
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
