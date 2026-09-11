import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_BUTTON_CLIP } from '../brand/theme'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import type { Branding, FillType, FrameVisibility, TextAlign } from '../types/experience'
import { cardFillCss } from '../render/brand'
import { SelectField, SwitchField, TextField } from './fields'

/**
 * Brand panel modelled on Squarespace "Site Styles" / Stripe branding: a root
 * list of category cards that drill into full sub-screens (rather than
 * expanding inline), each with a back button at the top. Inside a category,
 * every relevant control is revealed at once. Color rows follow Stripe's
 * swatch + hex chip.
 */

type ScreenId = 'root' | 'colors' | 'type' | 'logo' | 'buttons' | 'advanced' | 'frame'

const TITLES: Record<ScreenId, string> = {
  root: 'Brand',
  colors: 'Colors',
  type: 'Typography',
  logo: 'Logo & name',
  buttons: 'Buttons',
  advanced: 'Advanced',
  frame: 'Frame elements',
}

function ChevronRight({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

function ChevronLeft({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}

/** A drill-in row: title (+ optional value/accessory) and a right chevron. */
function NavRow({
  title,
  value,
  accessory,
  onClick,
}: {
  title: string
  value?: string
  accessory?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-slate-700">{title}</div>
        {value && <div className="mt-0.5 truncate text-[11px] text-slate-400">{value}</div>}
      </div>
      {accessory}
      <ChevronRight className="flex-none text-slate-300" />
    </button>
  )
}

/** Uppercase group label with a small pill noting which layout(s) it affects. */
function SectionLabel({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">{badge}</span>
    </div>
  )
}

function SwatchStrip({ colors }: { colors: string[] }) {
  return (
    <div className="flex flex-none items-center gap-1">
      {colors.map((c, i) => (
        <span key={i} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c }} />
      ))}
    </div>
  )
}

/** Stripe-style color row: label + hint on the left, swatch + hex chip right. */
function ColorChipRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-slate-700">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{hint}</div>}
      </div>
      <div className="flex flex-none items-center overflow-hidden rounded-lg border border-slate-200">
        <label className="relative block h-8 w-9 cursor-pointer" style={{ background: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          value={value.toUpperCase()}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-[86px] border-l border-slate-200 px-2 py-1.5 text-[13px] uppercase text-slate-600 outline-none"
        />
      </div>
    </div>
  )
}

/** A fill value: a flat color or a two-stop linear gradient. */
type FillValue = {
  type: FillType
  solid: string
  from: string
  to: string
  angle: number
}

function fillPreview(v: FillValue): string {
  return v.type === 'gradient'
    ? `linear-gradient(${v.angle}deg, ${v.from}, ${v.to})`
    : v.solid
}

/** Small swatch + hex input row, reused inside the fill popover. */
function HexRow({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="w-9 flex-none text-[11px] text-slate-500">{label}</span>}
      <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-slate-200">
        <label className="relative block h-7 w-8 flex-none cursor-pointer" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <input
          value={value.toUpperCase()}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-full border-l border-slate-200 px-2 py-1 text-[12px] uppercase text-slate-600 outline-none"
        />
      </div>
    </div>
  )
}

/**
 * Stripe-style paint row that opens a popover to switch between a solid color
 * and a two-stop gradient (with color stops + angle). Used for the card fill
 * and the card border.
 */
/** A near-white/very-light color needs a darker ring so the swatch doesn't
 *  visually merge with the white panel background. */
function isLightHex(hex: string): boolean {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (full.length !== 6) return false
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 228
}

/** Ring class for a color swatch — a clear grey stroke on light/white fills so
 *  the swatch never merges with the white panel; subtle otherwise. */
function swatchRing(color: string): string {
  return isLightHex(color) ? 'ring-1 ring-slate-400' : 'ring-1 ring-black/10'
}

function FillControl({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: FillValue
  onChange: (v: FillValue) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-slate-700">{label}</div>
          {hint && <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{hint}</div>}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-none items-center gap-2 rounded-lg border border-slate-200 py-1 pl-1 pr-2.5 transition-colors hover:border-slate-300"
        >
          <span
            className={`h-6 w-6 rounded-md ${swatchRing(value.type === 'solid' ? value.solid : value.from)}`}
            style={{ background: fillPreview(value) }}
          />
          <span className="text-[12px] font-medium capitalize text-slate-600">{value.type}</span>
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className="mb-3 flex rounded-lg bg-slate-100 p-0.5">
              {(['solid', 'gradient'] as FillType[]).map((t) => {
                const active = value.type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ ...value, type: t })}
                    className="flex-1 rounded-md px-2 py-1 text-[12px] font-semibold capitalize transition-colors"
                    style={{
                      background: active ? '#fff' : 'transparent',
                      color: active ? '#0f172a' : '#64748b',
                      boxShadow: active ? '0 1px 2px rgba(15,23,42,0.12)' : 'none',
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>

            {value.type === 'solid' ? (
              <HexRow value={value.solid} onChange={(solid) => onChange({ ...value, solid })} />
            ) : (
              <div className="space-y-2.5">
                <div className={`h-8 w-full rounded-md ${swatchRing(value.from)}`} style={{ background: fillPreview(value) }} />
                <HexRow label="From" value={value.from} onChange={(from) => onChange({ ...value, from })} />
                <HexRow label="To" value={value.to} onChange={(to) => onChange({ ...value, to })} />
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Angle</span>
                    <span className="tabular-nums">{value.angle}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={value.angle}
                    onChange={(e) => onChange({ ...value, angle: Number(e.target.value) })}
                    className="w-full accent-slate-800"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Label + value + range slider. */
function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (n: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-slate-700">{label}</div>
        <span className="text-[12px] tabular-nums text-slate-500">
          {value}
          {suffix}
        </span>
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-slate-800"
      />
    </div>
  )
}

/** Compact bordered numeric field with a leading glyph (Figma type panel style). */
function NumField({
  icon,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  icon?: ReactNode
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 transition-colors focus-within:border-slate-400">
      {icon && <span className="flex-none text-slate-400">{icon}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent text-[13px] tabular-nums text-slate-700 outline-none"
      />
      {suffix && <span className="flex-none text-[12px] text-slate-400">{suffix}</span>}
    </div>
  )
}

function AlignIcon({ dir }: { dir: TextAlign }) {
  const short = dir === 'left' ? { x1: 3, x2: 13 } : dir === 'right' ? { x1: 7, x2: 17 } : { x1: 5, x2: 15 }
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1={short.x1} y1="9.5" x2={short.x2} y2="9.5" />
      <line x1="3" y1="14" x2="17" y2="14" />
    </svg>
  )
}

/** Segmented horizontal-alignment control. */
function AlignToggle({ value, onChange }: { value: TextAlign; onChange: (v: TextAlign) => void }) {
  const opts: TextAlign[] = ['left', 'center', 'right']
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map((id) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-label={`Align ${id}`}
            className="flex items-center justify-center rounded-lg border py-2 transition-colors"
            style={{
              borderColor: active ? '#0f172a' : '#e2e8f0',
              background: active ? '#f8fafc' : '#fff',
              color: active ? '#0f172a' : '#94a3b8',
            }}
          >
            <AlignIcon dir={id} />
          </button>
        )
      })}
    </div>
  )
}

const GlyphLineHeight = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="4" y1="6" x2="16" y2="6" />
    <line x1="4" y1="10" x2="16" y2="10" />
    <line x1="4" y1="14" x2="16" y2="14" />
  </svg>
)

const GlyphLetterSpacing = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="4" y1="4" x2="4" y2="16" />
    <line x1="16" y1="4" x2="16" y2="16" />
    <line x1="8" y1="10" x2="12" y2="10" />
  </svg>
)

const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { value: 'system-ui, -apple-system, sans-serif', label: 'System default' },
  { value: "'Georgia', serif", label: 'Georgia' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Arial', Helvetica, sans-serif", label: 'Arial' },
  { value: "'Helvetica Neue', Helvetica, sans-serif", label: 'Helvetica Neue' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
  { value: "'Mulish', 'Muli', sans-serif", label: 'Muli' },
  { value: "'Nunito Sans', sans-serif", label: 'Nunito Sans' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Barlow', 'Segoe UI', sans-serif", label: 'Barlow' },
]

const WEIGHT_OPTIONS: { value: string; label: string }[] = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
]

const FRAME_TOGGLES: { key: keyof FrameVisibility; label: string; description: string }[] = [
  { key: 'logo', label: 'Merchant logo', description: 'Show your logo in the header.' },
  { key: 'exitX', label: 'Exit (X)', description: 'Close control in the top-right.' },
  { key: 'progress', label: 'Progress indicator', description: 'Step X of N counter.' },
  { key: 'title', label: 'Step title', description: 'Heading for each step.' },
  { key: 'description', label: 'Step description', description: 'Supporting text below the title.' },
]

/** Logo image upload with a fixed-height preview + replace/remove controls. */
/** Checkerboard backdrop so transparent (PNG/SVG) logos read clearly. */
const CHECKER: CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'linear-gradient(45deg,#eef2f7 25%,transparent 25%),linear-gradient(-45deg,#eef2f7 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eef2f7 75%),linear-gradient(-45deg,transparent 75%,#eef2f7 75%)',
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0,0 7px,7px -7px,-7px 0',
}

function LogoUploader({
  logoUrl,
  onChange,
}: {
  logoUrl?: string
  onChange: (v: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <div className="text-[12px] font-semibold text-slate-600">Logo image</div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) readFile(file)
        }}
        className={`flex min-h-[136px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-4 transition-colors ${
          dragging ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-300 hover:border-slate-400'
        }`}
        style={logoUrl ? CHECKER : { backgroundColor: '#f8fafc' }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo preview"
            style={{ maxHeight: 72, maxWidth: '100%', width: 'auto', objectFit: 'contain' }}
          />
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <div className="text-[12px] font-semibold text-slate-500">Drag and drop, or click to upload</div>
            <div className="mt-0.5 text-[11px] text-slate-400">PNG, SVG or JPG · transparent recommended</div>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
          e.target.value = ''
        }}
      />
      {logoUrl && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            Replace image
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-500 transition-colors hover:border-red-200 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-slate-400">
        The upload box scales to fit any logo. In the header it's shown at a fixed height (width scales automatically) so it never affects the layout's height.
      </p>
    </div>
  )
}

export function BrandingPanel() {
  const branding = useExperience((s) => s.experience.branding)
  const frame = useExperience((s) => s.experience.frame)
  const shell = useExperience((s) => s.experience.shell)
  const applyBrand = useJourney((s) => s.applyBrand)
  const updateFrame = useExperience((s) => s.updateFrame)
  const isFullPage = shell !== 'modal'

  const set = (p: Partial<Branding>) => applyBrand({ ...branding, ...p })
  const [stack, setStack] = useState<ScreenId[]>(['root'])
  const current = stack[stack.length - 1]
  const push = (id: ScreenId) => setStack((s) => [...s, id])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const parentTitle = stack.length > 1 ? TITLES[stack[stack.length - 2]] : ''

  const shownFrame = FRAME_TOGGLES.filter((t) => frame[t.key]).length
  // The surface swatch reflects whichever layout is active (page bg vs card fill).
  const surfaceColor = isFullPage ? branding.siteColor : cardFillCss(branding)
  const palette = [surfaceColor, branding.primaryColor, branding.secondaryColor, branding.accentColor, branding.titleColor]
  const fontLabel = FONT_OPTIONS.find((f) => f.value === (branding.bodyFontFamily ?? branding.fontFamily))?.label ?? 'Custom'
  const headingLabel = FONT_OPTIONS.find((f) => f.value === (branding.headingFontFamily ?? branding.fontFamily))?.label ?? 'Custom'

  const clampSize = (n: number) => Math.max(12, Math.min(22, Math.round(n)))
  const clampLine = (n: number) => Math.round(Math.max(1, Math.min(2, n)) * 10) / 10
  const clampSpacing = (n: number) => Math.round(Math.max(-5, Math.min(20, n)) * 2) / 2
  const clampScale = (n: number) => Math.max(70, Math.min(160, Math.round(n / 5) * 5))

  return (
    <div className="space-y-4">
      {/* Header: back button + current title. Only on sub-screens — at the root
          the pane itself already says Brand, and the category rows say the rest. */}
      {stack.length > 1 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={back}
            className="-ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[12px] font-semibold text-slate-500 transition-colors hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" />
            {parentTitle}
          </button>
          <div className="text-[15px] font-bold text-slate-800">{TITLES[current]}</div>
        </div>
      )}

      {/* ---- Root: category list ---- */}
      {current === 'root' && (
        <div className="space-y-2">
          <NavRow title="Colors" accessory={<SwatchStrip colors={palette} />} onClick={() => push('colors')} />
          <NavRow
            title="Typography"
            value={`${headingLabel} / ${fontLabel} · ${branding.fontSizeBase}px`}
            onClick={() => push('type')}
          />
          <NavRow title="Logo & name" value={branding.merchantName || 'Not set'} onClick={() => push('logo')} />
          <NavRow
            title="Buttons"
            value={
              branding.buttonShape === 'clip'
                ? 'Clip path'
                : branding.buttonFillType === 'gradient'
                  ? 'Gradient'
                  : 'Solid'
            }
            onClick={() => push('buttons')}
          />
          <NavRow title="Advanced" value={branding.customCss?.trim() ? 'Scoped CSS on' : 'Fonts & CSS hatch'} onClick={() => push('advanced')} />
          <NavRow title="Frame elements" value={`${shownFrame} of ${FRAME_TOGGLES.length} shown`} onClick={() => push('frame')} />
        </div>
      )}

      {/* ---- Colors: surface controls are layout-specific; brand colors are shared ---- */}
      {current === 'colors' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Palette</div>
            <div className="flex overflow-hidden rounded-lg ring-1 ring-black/5">
              {palette.map((c, i) => (
                <div key={i} className="h-11 flex-1" style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Surface — only the controls that apply to the CURRENT layout show. */}
          <div className="space-y-3.5">
            <SectionLabel
              title={isFullPage ? 'Full-page surface' : 'Modal surface'}
              badge={isFullPage ? 'Full page only' : 'Modal only'}
            />
            {isFullPage ? (
              <ColorChipRow
                label="Page background"
                hint="The full-viewport branded background behind everything."
                value={branding.siteColor}
                onChange={(siteColor) => set({ siteColor })}
              />
            ) : (
              <>
                <FillControl
                  label="Card fill"
                  hint="The floating modal card background — solid or gradient."
                  value={{
                    type: branding.cardFillType,
                    solid: branding.cardColor,
                    from: branding.cardGradientFrom,
                    to: branding.cardGradientTo,
                    angle: branding.cardGradientAngle,
                  }}
                  onChange={(v) =>
                    set({
                      cardFillType: v.type,
                      cardColor: v.solid,
                      cardGradientFrom: v.from,
                      cardGradientTo: v.to,
                      cardGradientAngle: v.angle,
                    })
                  }
                />
                <FillControl
                  label="Card border"
                  hint="Border around the modal card — solid or gradient."
                  value={{
                    type: branding.cardBorderType,
                    solid: branding.cardBorderColor,
                    from: branding.cardBorderGradientFrom,
                    to: branding.cardBorderGradientTo,
                    angle: branding.cardBorderGradientAngle,
                  }}
                  onChange={(v) =>
                    set({
                      cardBorderType: v.type,
                      cardBorderColor: v.solid,
                      cardBorderGradientFrom: v.from,
                      cardBorderGradientTo: v.to,
                      cardBorderGradientAngle: v.angle,
                    })
                  }
                />
                <SliderRow
                  label="Border width"
                  value={branding.cardBorderWidth}
                  min={0}
                  max={8}
                  suffix="px"
                  onChange={(cardBorderWidth) => set({ cardBorderWidth })}
                />
              </>
            )}
            <ColorChipRow
              label="Header background"
              hint="Fill behind the logo & progress bar. Applies to every layout."
              value={branding.headerColor ?? branding.cardColor}
              onChange={(headerColor) => set({ headerColor })}
            />
            <p className="text-[11px] leading-relaxed text-slate-400">
              {isFullPage
                ? 'The card fill, card border & border width only apply to the Modal layout — switch layouts to edit them.'
                : 'The page background only applies to the Full-page layouts — switch layouts to edit it.'}
            </p>
          </div>

          {/* Brand colors — shared across every layout. */}
          <div className="space-y-3.5 border-t border-slate-100 pt-4">
            <SectionLabel title="Brand colors" badge="All layouts" />
            <ColorChipRow label="Primary" hint="Main buttons & highlights." value={branding.primaryColor} onChange={(primaryColor) => set({ primaryColor })} />
            <ColorChipRow label="Secondary" hint="Supporting surfaces." value={branding.secondaryColor} onChange={(secondaryColor) => set({ secondaryColor })} />
            <ColorChipRow label="Accent" hint="Save offers & links." value={branding.accentColor} onChange={(accentColor) => set({ accentColor })} />
            <ColorChipRow label="Title text" hint="Headings & step titles." value={branding.titleColor} onChange={(titleColor) => set({ titleColor })} />
            <ColorChipRow label="Body text" hint="Primary paragraph copy." value={branding.textColor} onChange={(textColor) => set({ textColor })} />
            <ColorChipRow label="Muted text" hint="Descriptions, captions & labels." value={branding.mutedColor} onChange={(mutedColor) => set({ mutedColor })} />
          </div>

          <div className="space-y-3.5 border-t border-slate-100 pt-4">
            <SectionLabel title="Button stroke" badge="All layouts" />
            <ColorChipRow
              label="Stroke color"
              hint="Border around primary & accent CTAs."
              value={branding.buttonBorderColor ?? branding.primaryColor}
              onChange={(buttonBorderColor) => set({ buttonBorderColor })}
            />
            <SliderRow
              label="Stroke width"
              hint="0 = no visible border on filled buttons."
              value={branding.buttonBorderWidth ?? 0}
              min={0}
              max={4}
              suffix="px"
              onChange={(buttonBorderWidth) => set({ buttonBorderWidth })}
            />
          </div>
        </div>
      )}

      {/* ---- Typography: Figma-style panel — family, weight+size, line-height+spacing, alignment ---- */}
      {current === 'type' && (
        <div className="space-y-3.5">
          {/* ---- Heading typography (independent of body) ---- */}
          <div className="pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Heading</div>
          <SelectField
            label="Font"
            value={branding.headingFontFamily ?? branding.fontFamily}
            options={FONT_OPTIONS}
            onChange={(headingFontFamily) => set({ headingFontFamily })}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Weight"
              value={String(branding.headingFontWeight ?? 700)}
              options={WEIGHT_OPTIONS}
              onChange={(v) => set({ headingFontWeight: Number(v) })}
            />
            <div>
              <div className="mb-1 text-[12px] font-semibold text-slate-600">Size</div>
              <NumField
                icon={<span className="text-[12px] font-bold leading-none">A</span>}
                value={branding.headingFontScale ?? 100}
                min={70}
                max={160}
                step={5}
                suffix="%"
                onChange={(n) => set({ headingFontScale: clampScale(n) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[12px] font-semibold text-slate-600">Line height</div>
              <NumField
                icon={GlyphLineHeight}
                value={branding.headingLineHeight ?? 1.2}
                min={1}
                max={2}
                step={0.1}
                onChange={(n) => set({ headingLineHeight: clampLine(n) })}
              />
            </div>
            <div>
              <div className="mb-1 text-[12px] font-semibold text-slate-600">Letter spacing</div>
              <NumField
                icon={GlyphLetterSpacing}
                value={branding.headingLetterSpacing ?? 0}
                min={-5}
                max={20}
                step={0.5}
                suffix="%"
                onChange={(n) => set({ headingLetterSpacing: clampSpacing(n) })}
              />
            </div>
          </div>

          {/* ---- Body typography (independent of heading) ---- */}
          <div className="pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Body</div>
          <SelectField
            label="Font"
            value={branding.bodyFontFamily ?? branding.fontFamily}
            options={FONT_OPTIONS}
            onChange={(bodyFontFamily) => set({ bodyFontFamily, fontFamily: bodyFontFamily })}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Weight"
              value={String(branding.fontWeight)}
              options={WEIGHT_OPTIONS}
              onChange={(v) => set({ fontWeight: Number(v) })}
            />
            <div>
              <div className="mb-1 text-[12px] font-semibold text-slate-600">Size</div>
              <NumField
                icon={<span className="text-[12px] font-bold leading-none">A</span>}
                value={branding.fontSizeBase}
                min={12}
                max={22}
                suffix="px"
                onChange={(n) => set({ fontSizeBase: clampSize(n) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[12px] font-semibold text-slate-600">Line height</div>
              <NumField
                icon={GlyphLineHeight}
                value={branding.fontLineHeight}
                min={1}
                max={2}
                step={0.1}
                onChange={(n) => set({ fontLineHeight: clampLine(n) })}
              />
            </div>
            <div>
              <div className="mb-1 text-[12px] font-semibold text-slate-600">Letter spacing</div>
              <NumField
                icon={GlyphLetterSpacing}
                value={branding.letterSpacing}
                min={-5}
                max={20}
                step={0.5}
                suffix="%"
                onChange={(n) => set({ letterSpacing: clampSpacing(n) })}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-[12px] font-semibold text-slate-600">Alignment</div>
            <AlignToggle value={branding.textAlign} onChange={(textAlign) => set({ textAlign })} />
          </div>
        </div>
      )}

      {/* ---- Buttons: fill, shape, clip, radius ---- */}
      {current === 'buttons' && (
        <div className="space-y-4">
          <FillControl
            label="Primary fill"
            hint="Solid uses the primary color. Gradient is two stops on the CTA."
            value={{
              type: branding.buttonFillType ?? 'solid',
              solid: branding.primaryColor,
              from: branding.buttonGradientFrom ?? branding.primaryColor,
              to: branding.buttonGradientTo ?? branding.primaryColor,
              angle: branding.buttonGradientAngle ?? 180,
            }}
            onChange={(v) =>
              set({
                buttonFillType: v.type,
                primaryColor: v.type === 'solid' ? v.solid : branding.primaryColor,
                buttonGradientFrom: v.from,
                buttonGradientTo: v.to,
                buttonGradientAngle: v.angle,
              })
            }
          />
          <ColorChipRow
            label="Button text"
            hint="Label color on filled primary CTAs."
            value={branding.buttonTextColor ?? '#ffffff'}
            onChange={(buttonTextColor) => set({ buttonTextColor })}
          />
          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-slate-600">Shape</div>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              {(['radius', 'pill', 'clip'] as const).map((shape) => {
                const on = (branding.buttonShape ?? 'radius') === shape
                return (
                  <button
                    key={shape}
                    type="button"
                    onClick={() =>
                      set({
                        buttonShape: shape,
                        buttonClipPath: shape === 'clip' ? branding.buttonClipPath || DEFAULT_BUTTON_CLIP : branding.buttonClipPath,
                      })
                    }
                    className="flex-1 rounded-md px-2 py-1 text-[12px] font-semibold capitalize"
                    style={{
                      background: on ? '#fff' : 'transparent',
                      color: on ? '#0f172a' : '#64748b',
                      boxShadow: on ? '0 1px 2px rgba(15,23,42,0.12)' : 'none',
                    }}
                  >
                    {shape}
                  </button>
                )
              })}
            </div>
          </div>
          {(branding.buttonShape ?? 'radius') === 'clip' && (
            <TextField
              label="Clip path"
              value={branding.buttonClipPath ?? ''}
              onChange={(buttonClipPath) => set({ buttonClipPath })}
              hint="CSS clip-path on primary CTAs. Applied inside the isolated surface only."
            />
          )}
          <SliderRow
            label="Corner radius"
            hint="Used when shape is radius. Pill ignores this; clip sets radius to 0."
            value={branding.cornerRadius}
            min={0}
            max={24}
            suffix="px"
            onChange={(cornerRadius) => set({ cornerRadius })}
          />
        </div>
      )}

      {/* ---- Advanced: font URLs, page image, scoped CSS hatch ---- */}
      {current === 'advanced' && (
        <div className="space-y-4">
          <TextField
            label="Font stylesheet URL"
            value={branding.fontUrl ?? ''}
            onChange={(v) => set({ fontUrl: v || undefined })}
            hint="A CSS file with @font-face (Google Fonts URL is fine)."
          />
          <TextField
            label="Heading font URL"
            value={branding.headingFontUrl ?? ''}
            onChange={(v) => set({ headingFontUrl: v || undefined })}
            hint="Leave blank to reuse the body stylesheet."
          />
          <TextField
            label="Page background image"
            value={branding.siteImageUrl ?? ''}
            onChange={(v) => set({ siteImageUrl: v || undefined })}
            hint="Full-page shells only. Modal still uses the card fill."
          />
          <div>
            <div className="mb-1 text-[12px] font-semibold text-slate-600">Scoped CSS</div>
            <textarea
              value={branding.customCss ?? ''}
              onChange={(e) => set({ customCss: e.target.value || undefined })}
              rows={8}
              spellCheck={false}
              placeholder=".brand-btn-primary:hover { filter: brightness(1.08); }"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700 outline-none focus:border-slate-400"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              Applied only inside .brand-surface. html/body selectors are rewritten; @import is stripped.
            </p>
          </div>
        </div>
      )}

      {/* ---- Logo & name ---- */}
      {current === 'logo' && (
        <div className="space-y-4">
          <TextField label="Brand name" value={branding.merchantName} onChange={(merchantName) => set({ merchantName })} />
          <LogoUploader logoUrl={branding.logoUrl} onChange={(logoUrl) => set({ logoUrl })} />
          <TextField
            label="…or paste an image URL"
            value={branding.logoUrl ?? ''}
            onChange={(v) => set({ logoUrl: v || undefined })}
            hint="Leave blank to use the brand name as a wordmark."
          />
        </div>
      )}

      {/* ---- Frame elements — spaced-out toggle rows ---- */}
      {current === 'frame' && (
        <div>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
            {FRAME_TOGGLES.map(({ key, label, description }) => (
              <div key={key} className="py-3">
                <SwitchField label={label} description={description} checked={frame[key]} onChange={(v) => updateFrame({ [key]: v })} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            The navigation bar is always visible — every step must expose a way to go back or continue.
          </p>
        </div>
      )}
    </div>
  )
}
