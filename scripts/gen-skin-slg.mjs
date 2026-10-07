// Builds the SLG skin for V9.
//
//   node scripts/gen-skin-slg.mjs [repo] [cb-react-dls checkout]
//
// With a cb-react-dls checkout (slg-dev branch), src/skin/slg-tokens.css is
// refreshed from packages/sting-slg/src/styles/globals.css first. Then
// src/skin/slg.css is written from those tokens, Tailwind's default theme and
// a scan of src for hard-coded colours and shadows, so edit the mapping here
// rather than the output.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const repo = process.argv[2] ?? '.'
const dls = process.argv[3]

if (dls) {
  const src = join(dls, 'packages/sting-slg/src/styles/globals.css')
  if (!existsSync(src)) throw new Error(`no SLG tokens at ${src}`)
  writeFileSync(
    join(repo, 'src/skin/slg-tokens.css'),
    `/*\n * SLG design tokens, copied unchanged from cb-react-dls\n * packages/sting-slg/src/styles/globals.css (slg-dev). Refresh with\n * scripts/gen-skin-slg.mjs rather than editing here.\n */\n${readFileSync(src, 'utf8')}`,
  )
}

const theme = readFileSync(join(repo, 'node_modules/tailwindcss/theme.css'), 'utf8')
const original = (name) => {
  const m = theme.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(name)
  return m[1].trim()
}

const v = (name) => `var(--slg-${name})`
const mix = (a, b, p = 50) => `color-mix(in oklch, ${a} ${p}%, ${b})`
const N900 = v('neutral-900')

// Tailwind steps 50..950 drawn from the SLG ramps. SLG ships fewer steps than
// Tailwind, so the in-between steps are mixes of their two SLG neighbours.
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const n = (s) => v(`neutral-${s}`)
const ramp = (c) => [
  v(`${c}-50`), mix(v(`${c}-50`), v(`${c}-200`)), v(`${c}-200`), mix(v(`${c}-200`), v(`${c}-500`), 60),
  mix(v(`${c}-200`), v(`${c}-500`), 25), v(`${c}-500`), mix(v(`${c}-500`), v(`${c}-700`)), v(`${c}-700`),
  mix(v(`${c}-700`), N900, 75), mix(v(`${c}-700`), N900, 55), mix(v(`${c}-700`), N900, 40),
]
const blue = [
  v('blue-50'), mix(v('blue-50'), v('blue-200')), v('blue-200'), mix(v('blue-200'), v('blue-500'), 60),
  mix(v('blue-200'), v('blue-500'), 25), v('blue-500'), v('blue-700'), mix(v('blue-700'), N900, 80),
  mix(v('blue-700'), N900, 62), mix(v('blue-700'), N900, 48), mix(v('blue-700'), N900, 35),
]
const aiEnd = v('ai-gradient-end')
const aiMid = v('ai-shine-accent-end')
const white = v('white')
const scales = {
  neutral: [n(50), n(100), n(200), mix(n(200), n(400)), n(400), n(500), mix(n(500), n(700)), n(700), mix(n(700), n(900)), n(900), n(900)],
  blue,
  ai: [mix(aiEnd, white, 6), mix(aiEnd, white, 12), mix(aiEnd, white, 24), mix(aiEnd, white, 40), mix(aiMid, white, 75), aiMid, mix(aiMid, aiEnd), aiEnd, mix(aiEnd, N900, 80), mix(aiEnd, N900, 62), mix(aiEnd, N900, 45)],
  green: ramp('green'),
  amber: ramp('amber'),
  red: ramp('red'),
  orange: [
    v('orange-50'), mix(v('orange-50'), v('orange-300'), 65), mix(v('orange-50'), v('orange-300'), 30), v('orange-300'),
    mix(v('orange-300'), v('orange-500')), v('orange-500'), mix(v('orange-500'), v('orange-700')), v('orange-700'),
    mix(v('orange-700'), v('orange-900')), v('orange-900'), v('orange-900'),
  ],
}
const families = {
  slate: 'neutral', gray: 'neutral', zinc: 'neutral', neutral: 'neutral', stone: 'neutral',
  indigo: 'blue', blue: 'blue', sky: 'blue',
  violet: 'ai', purple: 'ai', fuchsia: 'ai',
  emerald: 'green', green: 'green', teal: 'green',
  amber: 'amber', yellow: 'amber',
  rose: 'red', red: 'red', pink: 'red',
  orange: 'orange',
}

const skinVars = []
const keepVars = []
for (const [fam, scale] of Object.entries(families)) {
  steps.forEach((step, i) => {
    skinVars.push(`  --color-${fam}-${step}: ${scales[scale][i]};`)
    keepVars.push(`  --color-${fam}-${step}: ${original(`color-${fam}-${step}`)};`)
  })
}
// Inline styles read these with their old hex as the fallback, so only this skin moves them.
for (const fam of Object.keys(families)) {
  for (const step of steps) skinVars.push(`  --sk-${fam}-${step}: var(--color-${fam}-${step});`)
}
const themed = [
  ['color-white', white],
  ['font-sans', v('font-family-ui')],
  ['font-mono', v('font-family-mono')],
  ['radius-md', v('radius-sm')],
  ['radius-lg', v('radius-md')],
  ['radius-xl', v('radius-lg')],
  ['radius-2xl', v('radius-lg')],
  ['radius-3xl', v('radius-lg')],
  ['text-xs', v('text-caption-font-size')],
  ['text-xs--line-height', v('text-caption-line-height')],
  ['text-sm', v('text-body-font-size')],
  ['text-sm--line-height', v('text-body-line-height')],
  ['text-base', v('text-sub-section-title-font-size')],
  ['text-base--line-height', v('text-sub-section-title-line-height')],
  ['text-lg', v('font-size-16')],
  ['text-lg--line-height', v('line-height-24')],
  ['text-xl', v('text-section-title-font-size')],
  ['text-xl--line-height', v('text-section-title-line-height')],
  ['text-2xl', v('font-size-24')],
  ['text-2xl--line-height', v('line-height-32')],
  ['text-3xl', v('text-page-title-font-size')],
  ['text-3xl--line-height', v('text-page-title-line-height')],
  ['default-transition-timing-function', 'ease'],
]
for (const [k, val] of themed) {
  skinVars.push(`  --${k}: ${val};`)
  keepVars.push(`  --${k}: ${original(k)};`)
}

// ---------------------------------------------------------------------------
// Source scan: hard-coded colours and shadows in class names.

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(tsx|ts)$/.test(name)) files.push(p)
  }
}
walk(join(repo, 'src'))
// The subscriber's cancel page and the merchant's brand presets keep their own colours.
const merchant = /^src\/(render|brand|eval|journey)\/|^src\/lib\/(blueprints|mapping)\.ts$|^src\/upload\/UploadTemplate\.tsx$|^src\/composer\/BrandingPanel\.tsx$/
const source = files
  .filter((f) => !merchant.test(relative(repo, f)))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

// Tailwind v3 palette hex, plus the near-misses the chrome picked by eye.
const PALETTE = {
  slate: { 50: 'f8fafc', 100: 'f1f5f9', 200: 'e2e8f0', 300: 'cbd5e1', 400: '94a3b8', 500: '64748b', 600: '475569', 700: '334155', 800: '1e293b', 900: '0f172a' },
  gray: { 50: 'f9fafb', 100: 'f3f4f6', 200: 'e5e7eb', 300: 'd1d5db', 400: '9ca3af', 500: '6b7280', 600: '4b5563', 700: '374151', 800: '1f2937', 900: '111827' },
  indigo: { 50: 'eef2ff', 100: 'e0e7ff', 200: 'c7d2fe', 300: 'a5b4fc', 400: '818cf8', 500: '6366f1', 600: '4f46e5', 700: '4338ca', 800: '3730a3', 900: '312e81' },
  blue: { 50: 'eff6ff', 100: 'dbeafe', 200: 'bfdbfe', 300: '93c5fd', 400: '60a5fa', 500: '3b82f6', 600: '2563eb', 700: '1d4ed8', 800: '1e40af', 900: '1e3a8a' },
  violet: { 50: 'f5f3ff', 100: 'ede9fe', 200: 'ddd6fe', 300: 'c4b5fd', 400: 'a78bfa', 500: '8b5cf6', 600: '7c3aed', 700: '6d28d9' },
  emerald: { 50: 'ecfdf5', 100: 'd1fae5', 200: 'a7f3d0', 500: '10b981', 600: '059669', 700: '047857' },
  green: { 50: 'f0fdf4', 100: 'dcfce7', 200: 'bbf7d0', 500: '22c55e', 600: '16a34a', 700: '15803d' },
  amber: { 50: 'fffbeb', 100: 'fef3c7', 200: 'fde68a', 400: 'fbbf24', 500: 'f59e0b', 600: 'd97706', 700: 'b45309' },
  red: { 50: 'fef2f2', 100: 'fee2e2', 200: 'fecaca', 500: 'ef4444', 600: 'dc2626', 700: 'b91c1c' },
  rose: { 50: 'fff1f2', 500: 'f43f5e', 600: 'e11d48' },
  sky: { 50: 'f0f9ff', 500: '0ea5e9', 600: '0284c7' },
  orange: { 50: 'fff7ed', 500: 'f97316', 600: 'ea580c' },
}
const HEX = {}
for (const [fam, scale] of Object.entries(PALETTE)) {
  for (const [step, hex] of Object.entries(scale)) HEX[hex] = `${fam}-${step}`
}
Object.assign(HEX, {
  '19191f': 'slate-900', '111729': 'slate-900', '0b1f33': 'slate-900', '002b38': 'slate-900',
  '0d1f1e': 'slate-900', '16302e': 'slate-800', '012a38': 'slate-900', 'effeff': 'slate-50',
  '677488': 'slate-500', '9aa3b2': 'slate-400',
  'c5cdd8': 'slate-300', 'd5dae1': 'slate-300', 'd5dde8': 'slate-300',
  'e6e9ef': 'slate-200', 'eef0f3': 'slate-100', 'eef2f6': 'slate-100', 'eef2f7': 'slate-100',
  'e6ebf2': 'slate-100', 'f2f4f8': 'slate-100', 'f4f6f9': 'slate-100',
  'fbfcfd': 'slate-50', 'f5f7fa': 'slate-50',
  'ff3300': 'orange-500', 'c45c26': 'orange-700', 'e36a5a': 'red-500',
  '1a56db': 'blue-600', '377dff': 'blue-600', '2f6eeb': 'blue-700', '183d7a': 'blue-800', 'e7f1fe': 'blue-50',
})
const tokenFor = (hex) => {
  const h = hex.toLowerCase()
  return HEX[h.length === 3 ? [...h].map((c) => c + c).join('') : h]
}

const PROPS = {
  text: 'color', bg: 'background-color', border: 'border-color',
  'border-t': 'border-top-color', 'border-b': 'border-bottom-color', 'border-l': 'border-left-color', 'border-r': 'border-right-color',
  ring: '--tw-ring-color', 'ring-offset': '--tw-ring-offset-color', decoration: 'text-decoration-color',
  accent: 'accent-color', caret: 'caret-color', fill: 'fill', stroke: 'stroke', outline: 'outline-color',
  shadow: '--tw-shadow-color',
}
const PSEUDO = {
  hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible', 'focus-within': ':focus-within',
  active: ':active', disabled: ':disabled',
}
const PARENT = { 'group-hover': '.group:hover ', 'group-focus-visible': '.group:focus-visible ' }

const esc = (cls) => cls.replace(/([:[\]#./!%(),'&*+=>~])/g, '\\$1')
const S_ = '[data-skin="slg"]'
const chrome = ':not(.brand-surface, .brand-surface *)'
// Canvas cards are laid out from their measured size at the old type, so their text keeps it.
const chromeType = ':not(.brand-surface, .brand-surface *, .react-flow *)'

/** Selector for a class with Tailwind variants, or null when a variant is not one this skin handles. */
function selectorFor(cls, variants, scope = chrome) {
  let parent = ''
  let pseudo = ''
  let element = ''
  for (const vnt of variants) {
    if (PSEUDO[vnt]) pseudo += PSEUDO[vnt]
    else if (PARENT[vnt]) parent = PARENT[vnt]
    else if (vnt === 'placeholder') element = '::placeholder'
    else return null
  }
  return `${S_} ${parent}.${esc(cls)}${scope}${pseudo}${element}`
}

const colourRules = []
const skipped = new Set()
const seen = new Set()
for (const m of source.matchAll(/(?<![\w-])((?:[a-z-]+:)*)(!?)([a-z]+(?:-[a-z]+)?)-\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\](?:\/(\d+))?(!?)/g)) {
  const [cls, vs, bang, util, hex, alpha, bang2] = m
  if (seen.has(cls)) continue
  seen.add(cls)
  const prop = PROPS[util]
  const token = tokenFor(hex)
  if (!prop || !token) {
    if (!token) skipped.add(`#${hex}`)
    continue
  }
  const sel = selectorFor(cls, vs.split(':').filter(Boolean))
  if (!sel) continue
  let value = `var(--color-${token})`
  if (alpha) value = `color-mix(in oklch, ${value} ${alpha}%, transparent)`
  if (bang || bang2) value += ' !important'
  colourRules.push(`${sel} {\n  ${prop}: ${value};\n}`)
}

// Shadows: tint the old slate and black shadows with the SLG neutral, and give
// floating menus and dialogs the SLG overlay shadow outright.
const tint = (body) =>
  body
    .replace(/rgba?\(\s*15\s*,\s*23\s*,\s*42\s*,\s*([\d.]+)\s*\)/g, (_, a) => mix(N900, 'transparent', +(a * 100).toFixed(1)))
    .replace(/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/g, (_, a) => mix(N900, 'transparent', +(a * 100).toFixed(1)))
    .replace(/rgba?\(\s*(79\s*,\s*70\s*,\s*229|99\s*,\s*102\s*,\s*241|37\s*,\s*99\s*,\s*235)\s*,\s*([\d.]+)\s*\)/g, (_, _c, a) => mix(v('blue-700'), 'transparent', +(a * 100).toFixed(1)))
    .replace(/rgba?\(\s*148\s*,\s*163\s*,\s*184\s*,\s*([\d.]+)\s*\)/g, (_, a) => mix(n(400), 'transparent', +(a * 100).toFixed(1)))
const floating = (body) => {
  const m = body.match(/^0_(\d+)px_(\d+)px/)
  return m && +m[1] >= 12 && +m[2] >= 32
}
const shadowRules = []
const seenShadow = new Set()
for (const m of source.matchAll(/(?<![\w-])((?:[a-z-]+:)*)(!?)shadow-\[([^\]\s'"`]+)\]/g)) {
  const [cls, vs, , body] = m
  if (seenShadow.has(cls)) continue
  seenShadow.add(cls)
  const sel = selectorFor(cls, vs.split(':').filter(Boolean))
  if (!sel) continue
  const value = floating(body) ? v('shadow-overlay') : tint(body.replace(/_/g, ' '))
  if (value === body.replace(/_/g, ' ')) continue
  shadowRules.push(`${sel} {\n  --tw-shadow: ${value};\n}`)
}

const shade = (a) => mix(N900, 'transparent', a)
const shadows = {
  'shadow-2xs': `0 1px ${shade(5)}`,
  'shadow-xs': `0 1px 2px 0 ${shade(5)}`,
  'shadow-sm': `0 1px 3px 0 ${shade(10)}, 0 1px 2px -1px ${shade(10)}`,
  shadow: `0 1px 3px 0 ${shade(10)}, 0 1px 2px -1px ${shade(10)}`,
  'shadow-md': v('shadow-md'),
  'shadow-lg': v('shadow-md'),
  'shadow-xl': v('shadow-overlay'),
  'shadow-2xl': v('shadow-overlay'),
}

// One-off type sizes snap to the SLG scale: 10, 11, 12, 13, 14, 16, 20, 24, 32.
const sizes = {
  '9px': 10, '9.5px': 10, '10.5px': 11, '11.5px': 12, '12.5px': 13, '13.5px': 14, '14.5px': 14,
  '15px': 16, '17px': 16, '18px': 20, '22px': 24, '28px': 32, '30px': 32,
}
// SLG corners are 6, 8 and 12. Larger radii are device frames and stay.
const radii = { '5px': 6, '7px': 6, '10px': 8, '14px': 12, '15px': 12, '16px': 12, '20px': 12 }

let out = `/*
 * SLG skin for V9. Generated by scripts/gen-skin-slg.mjs from the sting-slg
 * tokens in ./slg-tokens.css (cb-react-dls, slg-dev) and Tailwind's default
 * theme, so edit the mapping there rather than here. It only applies under
 * html[data-skin="slg"], which src/skin/skin.ts sets for V9. Merchant screens
 * (.brand-surface) get the original values back so they keep the merchant's
 * own look.
 */

${S_} {
${skinVars.join('\n')}
}

${S_} .brand-surface {
${keepVars.join('\n')}
}

${S_} body {
  color: ${v('color-text-primary')};
  background: ${v('color-bg-page')};
  font-family: ${v('font-family-ui')};
}

/* Page titles follow the SLG page header: Sora, semibold, 20 on 24. */
${S_} :is(h1, h1[class])${chrome} {
  font-family: ${v('font-family-emphasis')};
  font-size: ${v('font-size-20')};
  line-height: ${v('line-height-24')};
  font-weight: ${v('font-weight-semibold')};
  letter-spacing: ${v('letter-spacing-default')};
}
`

out += '\n/* Shadows: Tailwind writes these into each class, so they are replaced per class. */\n'
for (const [cls, value] of Object.entries(shadows)) {
  out += `${S_} .${cls}${chrome} {\n  --tw-shadow: ${value};\n}\n`
}
out += shadowRules.join('\n') + '\n'

out += '\n/* Type. */\n'
for (const [from, to] of Object.entries(sizes)) {
  out += `${S_} .${esc(`text-[${from}]`)}${chromeType} {\n  font-size: ${v(`font-size-${to}`)};\n}\n`
}
out += `/* Chat bubbles are running text, so they take the body size rather than the heading one. */
${S_} .${esc('rounded-[20px]')}.${esc('text-[15px]')}${chromeType} {
  font-size: ${v('text-body-font-size')};
}
`

out += '\n/* Corners. */\n'
const radiusToken = { 6: 'radius-sm', 8: 'radius-md', 12: 'radius-lg' }
for (const [from, to] of Object.entries(radii)) {
  for (const side of ['', '-t', '-b', '-l', '-r', '-tl', '-tr', '-bl', '-br']) {
    const cls = `rounded${side}-[${from}]`
    if (!source.includes(cls)) continue
    const props = {
      '': ['border-radius'],
      '-t': ['border-top-left-radius', 'border-top-right-radius'],
      '-b': ['border-bottom-left-radius', 'border-bottom-right-radius'],
      '-l': ['border-top-left-radius', 'border-bottom-left-radius'],
      '-r': ['border-top-right-radius', 'border-bottom-right-radius'],
      '-tl': ['border-top-left-radius'], '-tr': ['border-top-right-radius'],
      '-bl': ['border-bottom-left-radius'], '-br': ['border-bottom-right-radius'],
    }[side]
    const body = props.map((p) => `  ${p}: ${v(radiusToken[to])};`).join('\n')
    out += `${S_} .${esc(cls)}${chrome}:not(.device-frame) {\n${body}\n}\n`
    out += `${S_} .${esc(`!${cls}`)}${chrome}:not(.device-frame) {\n${body.replace(/;/g, ' !important;')}\n}\n`
  }
}

// SLG components are square: Button, IconButton, Pill, Tag, Tabs, inputs, Modal,
// Drawer, Tooltip, Alert. Cards and menus keep their corners, and so do circles
// (dots, avatars, switches), which are round with no inline padding.
const controls = ':is(button, a, [role=button], [role=tab], [role=radio], [role=radiogroup], [role=tablist])'
// Spans are chips when their corners are small; larger ones are icon wells and cards.
const smallRadius = [
  'rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-t-lg', 'rounded-t-xl', 'rounded-l-lg', 'rounded-r-lg',
  ...['4px', '5px', '6px', '7px', '8px', '10px'].map((r) => `rounded-[${r}]`),
]
const field = 'input:not([type=checkbox], [type=radio], [type=range], [type=file], [type=color], [type=hidden])'
const square = [
  `${S_} ${controls}[class*="rounded"]:not(.rounded-full)${chrome}`,
  `${S_} span:is(${smallRadius.map((c) => `.${esc(c)}`).join(', ')})${chrome}`,
  `${S_} :is(${controls}, span).rounded-full[class*="px-"]${chrome}`,
  `${S_} [role=tablist] > :is(div, button)${chrome}`,
  `${S_} :has(> [role=radio])${chrome}`,
  `${S_} :is(${field}, textarea, select)${chrome}`,
  `${S_} :is(div, label):has(> :is(${field}, textarea))${chrome}`,
  `${S_} :is([role=dialog], [role=alertdialog], [role=tooltip], [role=alert])${chrome}`,
  `${S_} [role=dialog] > [class*="rounded"]${chrome}`,
  `${S_} :is(.s-btn, .s-input-wrapper, .s-select-trigger, .s-textarea-base, .s-tab-trigger, .s-card)`,
]
// `:not(.device-frame)` also lifts each selector above the one-off corner rules above.
out += `\n/* Square corners, as on SLG components. */\n${square.map((s) => (s.endsWith(':not(.device-frame)') ? s : `${s}:not(.device-frame)`)).join(',\n')} {\n  border-radius: 0;\n}\n`

out += '\n/* Hard-coded colours in the app chrome. */\n'
out += colourRules.join('\n') + '\n'

out += `
/* Sting components: actions take the SLG blue and neutrals, focus takes the SLG ring. */
${S_} .s-btn {
  transition-timing-function: ease;
}
${S_} .s-btn.s-btn-primary {
  --btn-bg: ${v('blue-700')};
  --btn-bg-hover: ${v('blue-500')};
  --btn-text: ${v('color-text-on-solid')};
}
${S_} .s-btn.s-btn-primary-outline {
  --btn-text: ${v('blue-700')};
  --btn-border: 1px solid ${v('blue-200')};
  --btn-bg-hover: ${v('blue-50')};
}
${S_} .s-btn.s-btn-primary-ghost {
  --btn-text: ${v('blue-700')};
  --btn-bg-hover: ${v('blue-50')};
}
${S_} .s-btn.s-btn-neutral {
  --btn-bg: ${v('color-bg-surface-muted')};
  --btn-bg-hover: ${v('color-bg-surface-hover')};
  --btn-text: ${v('color-text-primary')};
}
${S_} .s-btn.s-btn-neutral-outline {
  --btn-bg: ${v('color-bg-surface')};
  --btn-bg-hover: ${v('color-bg-surface-hover')};
  --btn-text: ${v('color-text-primary')};
  --btn-border: 1px solid ${v('color-border-default')};
  --btn-border-hover: 1px solid ${v('neutral-400')};
}
${S_} .s-btn.s-btn-neutral-ghost {
  --btn-text: ${v('color-text-secondary')};
  --btn-text-hover: ${v('color-text-primary')};
  --btn-bg-hover: ${v('color-bg-surface-hover')};
}
${S_} .s-btn.s-btn-danger {
  --btn-bg: ${v('color-danger')};
  --btn-bg-hover: ${v('color-danger-hover')};
}
${S_} .s-btn:is(.s-btn-danger-outline, .s-btn-danger-ghost) {
  --btn-text: ${v('color-danger')};
  --btn-text-hover: ${v('color-danger-hover')};
  --btn-bg-hover: ${v('red-50')};
}
${S_} .s-btn.s-btn-danger-outline {
  --btn-border: 1px solid ${v('color-danger')};
}
${S_} .s-btn.s-btn-success {
  --btn-bg: ${v('color-success')};
  --btn-bg-hover: ${v('green-700')};
}
${S_} .s-btn.s-btn-warning {
  --btn-bg: ${v('color-warning')};
  --btn-bg-hover: ${v('amber-700')};
}
${S_} :is(.s-btn, .s-switch-root, .s-tab-trigger, .s-accordion-trigger, .radio-option-item, .dropdown-trigger, .s-input-clear-button, .s-select-clear-button):focus-visible,
${S_} :is(.s-input-wrapper, .s-select-trigger):focus-within,
${S_} .s-textarea-base:focus {
  --tw-ring-color: ${v('color-focus-ring')};
}
${S_} .s-textarea-base:focus,
${S_} .dropdown-trigger:focus-visible {
  border-color: ${v('color-focus-ring')};
}
${S_} .s-switch-root {
  --switch-bg: ${v('neutral-400')};
  --switch-bg-checked: ${v('blue-700')};
}
${S_} .s-checkbox-root {
  --checkbox-border: ${v('neutral-400')};
  --checkbox-text: ${v('color-text-primary')};
  --checkbox-bg-hover: ${v('color-bg-surface-hover')};
}
${S_} .s-checkbox-root:is([data-state=checked], [data-indeterminate=true]) {
  --checkbox-bg: ${v('blue-700')};
  --checkbox-border: ${v('blue-700')};
}
${S_} .s-tab-list-horizontal {
  border-color: ${v('color-border-default')};
}
${S_} .s-tab-trigger-contained[data-state=active] {
  border-color: ${v('blue-700')};
  color: ${v('blue-700')};
}
${S_} .s-progress-primary {
  background-color: ${v('blue-700')};
  color: ${v('blue-700')};
}
${S_} .s-link:focus-visible {
  outline-color: ${v('color-focus-ring')};
}

/* Chrome drawn in src/index.css. Editing affordances sit on the merchant page but belong to the builder. */
${S_} .rt-toolbar,
${S_} .rt-toolbar::after {
  background: ${v('color-bg-surface')};
  border-color: ${v('color-border-default')};
}
${S_} .rt-toolbar {
  border-radius: ${v('radius-md')};
  box-shadow: ${v('shadow-overlay')};
}
${S_} .rt-toolbar button {
  border-radius: ${v('radius-sm')};
  color: ${v('color-text-secondary')};
  transition: background-color ${v('transition-fast')}, color ${v('transition-fast')};
}
${S_} .rt-toolbar button:hover {
  background: ${v('color-bg-surface-hover')};
  color: ${v('color-text-primary')};
}
${S_} .rt-toolbar button.is-active {
  background: ${v('blue-50')};
  color: ${v('blue-700')};
}
${S_} .rt-toolbar .rt-sep {
  background: ${v('color-border-default')};
}
${S_} .editable:hover {
  box-shadow: 0 0 0 1.5px ${mix(v('blue-700'), 'transparent', 35)};
  background: ${mix(v('blue-700'), 'transparent', 5)};
}
${S_} :is(.editable:focus, .editable:focus-within) {
  box-shadow: 0 0 0 2px ${v('blue-700')};
  background: ${mix(v('blue-700'), 'transparent', 6)};
}
${S_} .editable:empty {
  border-color: ${mix(v('blue-700'), 'transparent', 35)};
}
${S_} :is(.editable:empty, .rich-text:empty)::before {
  color: ${n(400)};
}
${S_} .editable-wrap .editable-counter {
  color: ${v('color-text-muted')};
  border-color: ${v('color-border-default')};
}
${S_} .editable-wrap:focus-within .editable-counter {
  color: ${v('blue-700')};
  border-color: ${v('blue-200')};
}
${S_} .bp-pill {
  color: ${v('color-text-muted')};
}
${S_} .bp-stack .bp-pill:hover {
  color: ${v('blue-700')};
  background: ${v('blue-50')};
}
${S_} .bp-pill--active,
${S_} .bp-stack:hover .bp-pill--active {
  border-color: ${v('blue-200')};
  background: ${v('blue-50')};
  color: ${v('blue-700')};
  box-shadow: 0 10px 26px -10px ${mix(v('blue-700'), 'transparent', 45)};
}
${S_} .cb-spotlight-ring {
  outline-color: ${mix(v('blue-700'), 'transparent', 72)};
  animation-name: slg-spotlight-pulse;
}
${S_} .cb-spotlight-label {
  background: ${v('blue-700')};
  box-shadow: 0 4px 12px ${mix(v('blue-700'), 'transparent', 28)};
}
@keyframes slg-spotlight-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 2px ${mix(v('blue-700'), 'transparent', 55)}, 0 0 0 8px ${mix(v('blue-700'), 'transparent', 14)};
  }
  50% {
    box-shadow: 0 0 0 3px ${mix(v('blue-700'), 'transparent', 85)}, 0 0 0 14px ${mix(v('blue-700'), 'transparent', 22)};
  }
}
@media (prefers-reduced-motion: reduce) {
  ${S_} .cb-spotlight-ring {
    animation: none;
  }
}
`

writeFileSync(join(repo, 'src/skin/slg.css'), out)
console.log(`wrote ${out.split('\n').length} lines, ${colourRules.length} colour and ${shadowRules.length} shadow rules`)
if (skipped.size) console.log(`left as they are (no SLG match): ${[...skipped].join(' ')}`)
