import { patchBrandShortcuts } from '../brand/theme'
import { offerVariantLabel } from '../lib/offerVariants'
import type { ShellLayout } from '../types/experience'
import { CB_KIND_LABELS, type CbKind } from '../upload/contract'
import { interpret } from './intake'
import {
  applyOffers,
  LIBRARY,
  startFromTemplate,
  templateForCount,
  templateLabel,
  withLive,
} from './templates'
import type { AudienceKey, JourneyFile, JourneyTemplate, OfferKey } from './types'

const SHELLS: { id: ShellLayout; label: string; hint: string }[] = [
  { id: 'modal', label: 'Modal', hint: 'overlay on the merchant site' },
  { id: 'fullpage', label: 'Full page', hint: 'hosted cancel page' },
  { id: 'fullpage_scroll', label: 'Scrolling page', hint: 'full page that scrolls' },
]

const AUDIENCE_LABEL: Record<AudienceKey, string> = {
  all: 'All subscribers',
  paying: 'Paying subscribers',
  high_value: 'High-value subscribers',
  high_risk: 'High risk customers',
  annual: 'Annual customers',
  in_trial: 'In-trial (active)',
}

const AUDIENCES: { id: AudienceKey; needle: RegExp }[] = [
  { id: 'high_value', needle: /high[- ]value|enterprise/i },
  { id: 'high_risk', needle: /high[- ]risk/i },
  { id: 'in_trial', needle: /in[- ]trial|\btrial\b/i },
  { id: 'annual', needle: /\bannual\b/i },
  { id: 'paying', needle: /\bpaying|\bpaid\b/i },
  { id: 'all', needle: /\ball subscribers?|\beveryone\b|\ball customers?/i },
]

const OFFER_KEYS: OfferKey[] = ['discount', 'pause', 'plan_change', 'extension', 'skip', 'addon']

const LABELED = /^(audience|shell|holdout|brand|offers?)\s*:/i

function shellLine(id: ShellLayout): string {
  const s = SHELLS.find((x) => x.id === id)
  return s ? `${s.label} — ${s.hint}` : id
}

function holdoutLine(holdout: number): string {
  return holdout === 0 ? 'Everyone is in treatment' : `${holdout}% see nothing`
}

function flowLabels(file: JourneyFile): string[] {
  const entry = LIBRARY.find((e) => e.id === file.template)
  if (entry) return entry.stepLabels.map((l) => l.toLowerCase())
  return file.steps
    .filter((s) => s.kind !== 'confirmation' && !s.kind.startsWith('outcome'))
    .map((s) => s.kind.replace(/_/g, ' '))
}

/** Screen list for an uploaded pack — same labels as confirm. */
export function uploadedScreenChain(file: JourneyFile): string {
  return file.steps
    .map((s) => CB_KIND_LABELS[s.kind as CbKind] ?? s.kind.replace(/_/g, ' '))
    .join(' → ')
}

function contextTitle(file: JourneyFile): string {
  if (file.source === 'uploaded' && (!file.name || file.name === 'Untitled journey')) {
    return 'Uploaded template'
  }
  return file.name || 'Untitled journey'
}

function offerLine(file: JourneyFile): string | null {
  const offers = file.steps.filter((s) => s.kind === 'offer')
  if (!offers.length) return null
  return offers.map((s) => offerVariantLabel(s.offer ?? 'discount')).join(', ')
}

/**
 * Deterministic view of the journey file. Copilot and Code share these
 * sentences so a beat change and a Code edit talk about the same knobs.
 */
export function renderContext(file: JourneyFile): string {
  if (file.steps.length === 0) {
    return [
      file.name || 'Untitled journey',
      '',
      'No flow yet. Ask Copilot to start a cancel or acquisition journey, or describe it here.',
    ].join('\n')
  }

  const uploaded = file.source === 'uploaded'
  const flow = uploaded ? uploadedScreenChain(file) : flowLabels(file).join(' → ')
  const lines = uploaded
    ? [
        contextTitle(file),
        `${flow}.`,
        'Chrome: uploaded — layout stays; remap slots or upload a new file to change screens.',
        '',
        `Audience: ${AUDIENCE_LABEL[file.audience]}.`,
        `Shell: ${shellLine(file.shell)}.`,
        `Holdout: ${holdoutLine(file.holdout)}.`,
        `Brand: ${file.brand.merchant}, ${file.brand.primary.toUpperCase()}, ${file.brand.corners}px corners.`,
      ]
    : [
        file.name,
        `${templateLabel(file.template)} — ${flow}.`,
        '',
        `Audience: ${AUDIENCE_LABEL[file.audience]}.`,
        `Shell: ${shellLine(file.shell)}.`,
        `Holdout: ${holdoutLine(file.holdout)}.`,
        `Brand: ${file.brand.merchant}, ${file.brand.primary.toUpperCase()}, ${file.brand.corners}px corners.`,
      ]
  const offers = offerLine(file)
  if (offers) {
    lines.push('', `Offers: ${offers}.`)
  }
  return lines.join('\n')
}

function field(text: string, name: string): string | null {
  const re = new RegExp(`^${name}\\s*:\\s*(.+)$`, 'im')
  const m = text.match(re)
  return m ? m[1].replace(/\.$/, '').trim() : null
}

function firstLineName(text: string, current: JourneyFile): string | null {
  const nonempty = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const line = nonempty.find(
    (l) => l && !LABELED.test(l) && !/^no flow yet/i.test(l) && !/^chrome\s*:/i.test(l),
  )
  if (!line) return null
  if (/—/.test(line) && /\bstep\b/i.test(line)) return null
  if (/→/.test(line)) return null
  // A lone sentence on a blank file is a prompt, not a title.
  if (current.template === 'none' && current.source !== 'uploaded' && nonempty.length <= 1) return null
  return line.replace(/\.$/, '').trim()
}

function parseAudience(raw: string): AudienceKey | null {
  const hit = AUDIENCES.find((a) => a.needle.test(raw))
  return hit?.id ?? null
}

function parseShell(raw: string): ShellLayout | null {
  const t = raw.toLowerCase()
  if (/scroll/.test(t)) return 'fullpage_scroll'
  if (/full ?page|hosted/.test(t)) return 'fullpage'
  if (/modal|overlay|dialog|pop ?up/.test(t)) return 'modal'
  return null
}

function parseHoldout(raw: string): number | null {
  const t = raw.toLowerCase()
  if (/everyone|none|no holdout|in treatment/.test(t) && !/\d/.test(t)) return 0
  const m = t.match(/(\d+)\s*%/)
  if (m) return Math.max(0, Math.min(50, Number(m[1])))
  const n = t.match(/(\d+)/)
  if (n) return Math.max(0, Math.min(50, Number(n[1])))
  return null
}

function parseBrand(raw: string, current: JourneyFile['brand']): JourneyFile['brand'] {
  const hex = raw.match(/#?[0-9a-f]{6}\b/i)
  const corners = raw.match(/(\d+)\s*px/i)
  const merchant = raw
    .split(',')
    .map((p) => p.trim())
    .find((p) => p && !/#|[0-9a-f]{6}|px|corners?/i.test(p))
  return patchBrandShortcuts(current, {
    merchant: merchant || current.merchant,
    primary: hex ? (hex[0].startsWith('#') ? hex[0] : `#${hex[0]}`) : current.primary,
    corners: corners ? Number(corners[1]) : current.corners,
  })
}

function parseOffers(raw: string): OfferKey[] {
  return OFFER_KEYS.filter((key) => {
    const label = offerVariantLabel(key).toLowerCase()
    return raw.toLowerCase().includes(label) || raw.toLowerCase().includes(key.replace(/_/g, ' '))
  }).sort((a, b) => raw.toLowerCase().indexOf(offerVariantLabel(a).toLowerCase()) - raw.toLowerCase().indexOf(offerVariantLabel(b).toLowerCase()))
}

function parseTemplate(text: string, current: JourneyFile): JourneyTemplate | null {
  const t = text.toLowerCase()
  const pricingAndCheckout = /\bpric(?:e|ing)\b/.test(t) && /\bcheckout\b/.test(t)
  const acquire = /\bacquisition|\bacquire subscribers\b|\bnew subscriber/.test(t)
  const cancel = /\bcancel|\bchurn|\bretention|\bplan change to save/.test(t)

  if (pricingAndCheckout && (current.kind === 'cancel' || cancel) && !acquire) {
    return 'cancel_plan_change'
  }
  if (pricingAndCheckout && current.template === 'none' && !cancel) return 'acquire_2'
  if (acquire && current.kind !== 'cancel') return 'acquire_2'

  for (const entry of LIBRARY) {
    if (
      t.includes(templateLabel(entry.id).toLowerCase()) ||
      t.includes(entry.posture.toLowerCase()) ||
      t.includes(entry.title.toLowerCase())
    ) {
      return entry.id
    }
  }
  if (t.includes('4-step balanced') || t.includes('4-step')) return templateForCount(4)
  if (t.includes('1-step click')) return 'cancel_1'
  if (t.includes('2-step clean')) return 'cancel_2'
  if (t.includes('3-step with survey')) return 'cancel_3'
  if (t.includes('5-step save')) return 'cancel_5'

  const digits = t.match(/\b([1-5])[ -]?step/)
  if (digits) {
    if (current.kind === 'acquisition' || (acquire && !cancel)) return 'acquire_2'
    if (pricingAndCheckout || (current.kind === 'cancel' && /\bpricing|\bcheckout\b/.test(t))) {
      return 'cancel_plan_change'
    }
    return templateForCount(Number(digits[1]))
  }
  return null
}

function sameFile(a: JourneyFile, b: JourneyFile): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Structured-output seam: natural language in, JourneyFile out. No model call.
 * Labeled lines win; leftover prose goes through `interpret` so typos still land.
 */
export function parseContext(
  text: string,
  current: JourneyFile,
): { file: JourneyFile; error?: string } {
  const trimmed = text.trim()
  if (!trimmed) {
    return { file: current, error: 'The context is empty. Keep the sentences, or describe the journey you want.' }
  }
  if (trimmed === renderContext(current).trim()) return { file: current }

  const unlabeled = trimmed
    .split('\n')
    .filter((line) => !LABELED.test(line.trim()))
    .join('\n')
  const uploaded = current.source === 'uploaded'
  const fallback = interpret(unlabeled, current)
  let file = fallback.changed && !(uploaded && fallback.rebuilt) ? fallback.file : current

  const name = firstLineName(trimmed, current)
  const audienceRaw = field(trimmed, 'audience')
  const shellRaw = field(trimmed, 'shell')
  const holdoutRaw = field(trimmed, 'holdout')
  const brandRaw = field(trimmed, 'brand')
  const offersRaw = field(trimmed, 'offers?')
  const template = uploaded ? null : parseTemplate(trimmed, current)

  const audience = audienceRaw ? parseAudience(audienceRaw) : null
  const shell = shellRaw ? parseShell(shellRaw) : null
  const holdout = holdoutRaw ? parseHoldout(holdoutRaw) : null
  const brand = brandRaw ? parseBrand(brandRaw, file.brand) : null
  const offers = offersRaw ? parseOffers(offersRaw) : []

  const structured =
    !!name ||
    !!audience ||
    !!shell ||
    holdout !== null ||
    !!brandRaw ||
    offers.length > 0 ||
    !!template

  if (template && template !== file.template && !uploaded) {
    file = startFromTemplate(
      {
        ...file,
        audience: audience ?? file.audience,
        shell: shell ?? file.shell,
        holdout: holdout ?? file.holdout,
        brand: brand ?? file.brand,
      },
      template,
    )
    file = { ...file, name: name || current.name, steps: withLive(file.steps, true) }
    if (offers.length) file = { ...file, steps: applyOffers(file.steps, offers) }
  } else {
    if (name && name !== file.name) file = { ...file, name }
    if (audience) file = { ...file, audience }
    if (shell) file = { ...file, shell }
    if (holdout !== null) file = { ...file, holdout }
    if (brand) file = { ...file, brand }
    if (offers.length && file.steps.some((s) => s.kind === 'offer')) {
      file = { ...file, steps: applyOffers(file.steps, offers) }
    }
  }

  if (sameFile(file, current)) {
    if (fallback.changed || structured) return { file: current }
    return {
      file: current,
      error: uploaded
        ? 'The screens came from the pack you uploaded. You can edit audience, shell, holdout, brand, or the offer bind — not the screens.'
        : 'Could not read a change out of that. Keep the labeled lines (Audience, Shell, Holdout, Brand) or name a step count, offer, shell, or audience.',
    }
  }

  return { file }
}
