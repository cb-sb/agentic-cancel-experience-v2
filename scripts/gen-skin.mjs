// Builds src/skin/dls.css from the Sting tokens and Tailwind's default theme.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const repo = process.argv[2] ?? '.'
const theme = readFileSync(`${repo}/node_modules/tailwindcss/theme.css`, 'utf8')
const original = (name) => {
  const m = theme.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(name)
  return m[1].trim()
}

const N = { 0: '#ffffff', 25: '#f7f7f8', 50: '#f0f1f3', 100: '#e1e2e6', 200: '#c4c6cc', 300: '#a7aaaf', 400: '#8a8d93', 500: '#62676d', 600: '#505458', 700: '#3e4247', 800: '#2c3035', 900: '#1a1d21' }
const P = { 25: '#f2f6f7', 50: '#e6f2ff', 100: '#b4d9fe', 200: '#82bffd', 300: '#50a5fc', 400: '#1e8cfb', 500: '#0472e1', 600: '#0359af', 700: '#023f7d', 800: '#01264b', 900: '#000d19' }
const S = { 25: '#eefff3', 50: '#ddffe7', 100: '#a8f3be', 200: '#6bdd8c', 300: '#43bc62', 400: '#23a24a', 500: '#1b7e39', 600: '#0d6225', 700: '#014114', 800: '#012d18', 900: '#0b1a11' }
const W = { 25: '#fffaed', 50: '#fff5dc', 100: '#ffedb8', 200: '#ffe68d', 300: '#ffdf62', 400: '#ffd847', 500: '#dab029', 600: '#c39a26', 700: '#a57c1f', 800: '#88601a', 900: '#6b4612', 1000: '#4f350c' }
const D = { 25: '#fcf8f9', 50: '#faf1f4', 100: '#ffd6d9', 200: '#ffb4bc', 300: '#ff848b', 400: '#fd4d57', 500: '#de1827', 600: '#a5181c', 700: '#730811', 800: '#530009', 900: '#29060e' }

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const scales = {
  neutral: [N[25], N[50], N[100], N[200], N[400], N[500], N[600], N[700], N[800], N[900], N[900]],
  primary: [P[50], `color-mix(in srgb, ${P[100]} 40%, ${P[50]})`, P[100], P[200], P[300], P[400], P[500], P[600], P[700], P[800], P[900]],
  success: [S[25], S[50], S[100], S[200], S[300], S[400], S[500], S[600], S[700], S[800], S[900]],
  warn: [W[25], W[50], W[100], W[200], W[400], W[500], W[600], W[800], W[900], W[1000], W[1000]],
  danger: [D[25], D[50], D[100], D[200], D[300], D[400], D[500], D[600], D[700], D[800], D[900]],
}
const families = {
  slate: 'neutral', gray: 'neutral', zinc: 'neutral', neutral: 'neutral', stone: 'neutral',
  indigo: 'primary', blue: 'primary', violet: 'primary', purple: 'primary', sky: 'primary',
  emerald: 'success', green: 'success',
  amber: 'warn', yellow: 'warn',
  rose: 'danger', red: 'danger',
}

const skinVars = []
const keepVars = []
for (const [fam, scale] of Object.entries(families)) {
  steps.forEach((step, i) => {
    skinVars.push(`  --color-${fam}-${step}: ${scales[scale][i]};`)
    keepVars.push(`  --color-${fam}-${step}: ${original(`color-${fam}-${step}`)};`)
  })
}
const themed = [
  ['radius-2xl', '12px'],
  ['radius-3xl', '12px'],
  ['font-weight-bold', '600'],
  ['font-weight-extrabold', '600'],
]
for (const [k, v] of themed) {
  skinVars.push(`  --${k}: ${v};`)
  keepVars.push(`  --${k}: ${original(k)};`)
}

const dp = {
  1: '0px 0px 1px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1)), 0px 1px 2px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1)), 0px 2px 4px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1))',
  2: '0px 0px 2px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1)), 0px 2px 4px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1)), 0px 4px 8px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1))',
  3: '0px 0px 2px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1)), 0px 4px 8px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1)), 0px 8px 16px 0px var(--tw-shadow-color, rgba(0, 0, 30, 0.1))',
}
const shadows = { sm: 1, '': 1, md: 2, lg: 3, xl: 3, '2xl': 3 }

const sizes = {
  '9px': 10, '9.5px': 10, '10px': 10, '10.5px': 10,
  '11px': 12, '11.5px': 12, '12px': 12, '12.5px': 12,
  '13px': 14, '13.5px': 14, '14px': 14, '14.5px': 14,
  '15px': 16, '16px': 16, '17px': 16,
  '18px': 20, '20px': 20,
  '22px': 24, '24px': 24,
  '28px': 32, '30px': 32,
}
const radii = { '5px': '4px', '7px': '6px', '10px': '8px', '14px': '12px', '15px': '12px', '16px': '12px' }

// Hard-coded colours in the app chrome, with the token each one becomes.
const hex = [
  ['text-[#677488]', 'color', N[500]],
  ['text-[#19191f]', 'color', N[900]],
  ['text-[#111827]', 'color', N[900]],
  ['text-[#0b1f33]', 'color', N[900]],
  ['text-[#4b5563]', 'color', N[600]],
  ['text-[#9aa3b2]', 'color', N[400]],
  ['placeholder:text-[#9aa3b2]', 'color', N[400], '::placeholder'],
  ['placeholder:text-[#4b5563]', 'color', N[600], '::placeholder'],
  ['border-[#e5e7eb]', 'border-color', N[100]],
  ['focus-within:border-[#c5cdd8]', 'border-color', N[200], ':focus-within'],
  ['bg-[#f9fafb]', 'background-color', N[25]],
  ['hover:bg-[#fbfcfd]', 'background-color', N[25], ':hover'],
  ['hover:bg-[#f3f4f6]', 'background-color', N[50], ':hover'],
  ['hover:!bg-[#e6ebf2]', 'background-color', `${N[50]} !important`, ':hover'],
  ['bg-[#9ca3af]', 'background-color', N[400]],
  ['ring-offset-[#f8fafc]', '--tw-ring-offset-color', N[25]],
  ['text-[#4f46e5]', 'color', P[500]],
  ['text-[#2563eb]', 'color', P[500]],
  ['text-[#6d28d9]', 'color', P[600]],
  ['text-[#183d7a]', 'color', P[700]],
  ['hover:text-[#4338ca]', 'color', P[600], ':hover'],
  ['hover:text-[#1d4ed8]', 'color', P[600], ':hover'],
  ['group-hover:text-[#183d7a]', 'color', P[700], '', '.group:hover '],
  ['bg-[#eef2ff]', 'background-color', P[50]],
  ['bg-[#f5f3ff]', 'background-color', P[50]],
  ['bg-[#e7f1fe]', 'background-color', P[50]],
  ['bg-[#2563eb]', 'background-color', P[500]],
  ['bg-[#377dff]', 'background-color', P[400]],
  ['hover:bg-[#1d4ed8]', 'background-color', P[600], ':hover'],
  ['hover:bg-[#2f6eeb]', 'background-color', P[600], ':hover'],
  ['border-[#6366f1]', 'border-color', P[400]],
  ['decoration-[#c7d2fe]', 'text-decoration-color', P[100]],
  ['group-focus-visible:ring-[#4f46e5]', '--tw-ring-color', P[500], '', '.group:focus-visible '],
]

const esc = (cls) => cls.replace(/([:[\]#./!%(),])/g, '\\$1')
const chrome = ':not(.brand-surface, .brand-surface *)'
// Canvas cards are laid out from their measured size at the old type, so their text keeps it.
const chromeType = ':not(.brand-surface, .brand-surface *, .react-flow *)'
const S_ = '[data-skin="dls"]'

let out = `/*
 * Sting skin. Generated from @chargebee/sting-tokens (cb-react-dls) and
 * Tailwind's default theme by scripts/gen-skin.mjs, so edit the mapping there
 * rather than by hand. It only applies under html[data-skin="dls"], which
 * src/skin/skin.ts sets for V8. Merchant screens (.brand-surface) get the
 * original values back so they keep the merchant's own look.
 */

${S_} {
${skinVars.join('\n')}
}

${S_} .brand-surface {
${keepVars.join('\n')}
}

${S_} body {
  color: ${N[900]};
  background: ${N[50]};
}
`

out += '\n/* Shadows: Tailwind writes these into each class, so they are replaced per class. */\n'
for (const [name, level] of Object.entries(shadows)) {
  const cls = name ? `shadow-${name}` : 'shadow'
  out += `${S_} .${esc(cls)}${chrome} {\n  --tw-shadow: ${dp[level]};\n}\n`
}

out += '\n/* Type: one-off sizes snap to the Sting scale (10, 12, 14, 16, 20, 24, 32). */\n'
for (const [from, to] of Object.entries(sizes)) {
  if (`${to}px` === from) continue
  out += `${S_} .${esc(`text-[${from}]`)}${chromeType} {\n  font-size: ${to}px;\n}\n`
}

out += '\n/* Corners: Sting tops out at 12px for cards; larger radii are device frames and stay. */\n'
for (const [from, to] of Object.entries(radii)) {
  out += `${S_} .${esc(`rounded-[${from}]`)}${chrome} {\n  border-radius: ${to};\n}\n`
}

out += '\n/* Hard-coded colours in the app chrome. */\n'
for (const [cls, prop, value, pseudo = '', parent = ''] of hex) {
  const sel = parent
    ? `${S_} ${parent}.${esc(cls)}${chrome}`
    : `${S_} .${esc(cls)}${chrome}${pseudo}`
  out += `${sel} {\n  ${prop}: ${value};\n}\n`
}

out += `
/* Chat bubbles are running text, so they take the body size rather than the heading one. */
${S_} .${esc('rounded-[20px]')}.${esc('text-[15px]')}${chrome} {
  font-size: 14px;
}
`

mkdirSync(`${repo}/src/skin`, { recursive: true })
writeFileSync(`${repo}/src/skin/dls.css`, out)
console.log(`wrote ${out.split('\n').length} lines`)
