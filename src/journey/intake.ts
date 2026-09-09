import { applyOffers, startFromTemplate, templateForCount, templateLabel, withLive } from './templates'
import type {
  AudienceKey,
  JourneyFile,
  JourneyKind,
  JourneyTemplate,
  OfferKey,
} from './types'
import type { ShellLayout } from '../types/experience'

/**
 * Free text, read as a patch to the journey file.
 *
 * The dock's buttons and this share one destination: both end up writing
 * `steps:`, `shell:` and `audience:`. Typing is the way around the guided turns
 * for someone who already knows what they want — "5-step cancel with pause and
 * discount, full page" is one line instead of four clicks — and what it cannot
 * read it says so rather than guessing.
 */
export interface Interpretation {
  file: JourneyFile
  /** What the assistant says back: what landed, and what it could not read. */
  reply: string
  /** True when the file changed, so the dock knows whether to offer a review. */
  changed: boolean
  /** True when the steps were (re)built, rather than only tweaked. */
  rebuilt: boolean
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
}

const OFFER_WORDS: { key: OfferKey; test: RegExp; label: string }[] = [
  { key: 'discount', test: /\bdiscount|\b% ?off|\bhalf price\b/, label: 'discount' },
  { key: 'pause', test: /\bpause|\bfreeze|\bhold\b/, label: 'pause' },
  { key: 'plan_change', test: /\bplan change|\bdowngrade|\bcheaper plan|\bswitch plan/, label: 'plan change' },
  { key: 'extension', test: /\bextension|\bfree month|\bextra month|\bmore time\b/, label: 'extension' },
  { key: 'skip', test: /\bskip\b/, label: 'skip a cycle' },
  { key: 'addon', test: /\badd-?on|\bonboarding|\bpriority support/, label: 'add-on' },
]

function readKind(t: string): JourneyKind | null {
  if (/\bacquisition|\bacquire|\bsign ?up|\bpricing (table|page)|\bcheckout|\bupsell\b/.test(t)) {
    return 'acquisition'
  }
  if (/\bcancel|\bchurn|\bsave flow|\bretention|\bwin ?back\b/.test(t)) return 'cancel'
  return null
}

function readStepCount(t: string): number | null {
  const digits = t.match(/\b([1-9])[ -]?(?:step|steps)\b/)
  if (digits) return Number(digits[1])
  const words = t.match(/\b(one|two|three|four|five|six)[ -]?(?:step|steps)\b/)
  if (words) return NUMBER_WORDS[words[1]]
  return null
}

function readShell(t: string): ShellLayout | null {
  if (/\bscroll/.test(t)) return 'fullpage_scroll'
  if (/\bfull ?page|\bhosted page|\bfull-screen|\bfullscreen\b/.test(t)) return 'fullpage'
  if (/\bmodal|\bdialog|\bpop ?up\b/.test(t)) return 'modal'
  return null
}

function readAudience(t: string): AudienceKey | null {
  if (/\bhigh[- ]value|\benterprise|\bbig accounts?\b/.test(t)) return 'high_value'
  if (/\bpaying|\bactive subscribers?|\bpaid\b/.test(t)) return 'paying'
  if (/\beveryone|\ball subscribers?|\ball customers?|\ball traffic\b/.test(t)) return 'all'
  return null
}

/** Offers come back in the order they were spoken, since that is the step order. */
function readOffers(t: string): { keys: OfferKey[]; labels: string[] } {
  const hits = OFFER_WORDS.map((o) => ({ o, at: t.search(o.test) }))
    .filter((h) => h.at >= 0)
    .sort((a, b) => a.at - b.at)
  return { keys: hits.map((h) => h.o.key), labels: hits.map((h) => h.o.label) }
}

const SHELL_WORDS: Record<ShellLayout, string> = {
  modal: 'a modal',
  fullpage: 'a full page',
  fullpage_scroll: 'a full page that scrolls',
}

/** Cancel templates that hold a survey, for "with a survey" without a count. */
const SURVEY_MIN: JourneyTemplate = 'cancel_3'
const OFFER_MIN: JourneyTemplate = 'cancel_4'

const RANK: JourneyTemplate[] = ['none', 'cancel_1', 'cancel_2', 'cancel_3', 'cancel_4', 'cancel_5']

function atLeast(a: JourneyTemplate, b: JourneyTemplate): JourneyTemplate {
  return RANK.indexOf(a) >= RANK.indexOf(b) ? a : b
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function interpret(text: string, current: JourneyFile): Interpretation {
  const t = text.toLowerCase()
  const kind = readKind(t)
  const count = readStepCount(t)
  const shell = readShell(t)
  const audience = readAudience(t)
  const { keys: offers, labels: offerLabels } = readOffers(t)
  const wantsSurvey = /\bsurvey|\breason|\bwhy they|\bfeedback\b/.test(t)

  let file = current
  const did: string[] = []
  let rebuilt = false

  const nextKind = kind ?? (current.template === 'none' ? null : current.kind)

  // --- Structure: kind, step count, template ------------------------------
  if (nextKind === 'acquisition') {
    if (current.kind !== 'acquisition' || current.template !== 'acquire_2') {
      file = startFromTemplate(file, 'acquire_2')
      rebuilt = true
      did.push('built a 2-step acquire: pricing table, then checkout')
    }
  } else if (nextKind === 'cancel') {
    let template: JourneyTemplate | null = count ? templateForCount(count) : null
    if (!template && (offers.length || wantsSurvey) && current.template === 'none') {
      template = offers.length ? OFFER_MIN : SURVEY_MIN
    }
    if (template) {
      // Asking for offers or a survey cannot land on a template too short to
      // hold them, whatever number came with it.
      if (offers.length) template = atLeast(template, OFFER_MIN)
      else if (wantsSurvey) template = atLeast(template, SURVEY_MIN)
      if (template !== current.template || current.kind !== 'cancel') {
        file = startFromTemplate({ ...file, kind: 'cancel' }, template)
        rebuilt = true
        did.push(`built the ${templateLabel(template).toLowerCase()} cancel flow`)
        if (count && count > 5) did.push('capped it at five steps, which is as long as this gets')
      }
    }
  }

  // A typed request is a decision, so the steps go live rather than staying
  // as the gray skeleton the buttons walk you through.
  if (rebuilt) file = { ...file, steps: withLive(file.steps, true) }

  // --- Content: offers, shell, audience -----------------------------------
  if (offers.length && file.steps.some((s) => s.kind === 'offer')) {
    const before = file.steps
    // Skeleton headlines are written for the skeleton's offer ("50% off for 3
    // months"), so a swapped offer drops the headline and lets the variant
    // speak for itself.
    file = {
      ...file,
      steps: applyOffers(before, offers).map((step, i) =>
        step.kind === 'offer' && step.offer !== before[i]?.offer
          ? { ...step, headline: undefined }
          : step,
      ),
    }
    const slots = file.steps.filter((s) => s.kind === 'offer').length
    const used = offerLabels.slice(0, slots)
    did.push(`set ${list(used)} as the offer${used.length === 1 ? '' : 's'}`)
    if (offerLabels.length > slots) {
      did.push(`there ${slots === 1 ? 'is' : 'are'} only ${slots} offer step${slots === 1 ? '' : 's'}, so ${list(offerLabels.slice(slots))} did not land`)
    }
  } else if (offers.length) {
    did.push(`this flow has no offer step, so ${list(offerLabels)} had nowhere to go`)
  }

  if (shell && shell !== file.shell) {
    file = { ...file, shell }
    did.push(`put it in ${SHELL_WORDS[shell]}`)
  }

  if (audience && audience !== file.audience) {
    file = { ...file, audience }
    did.push(`targeted ${audience === 'all' ? 'all subscribers' : audience.replace(/_/g, '-')}`)
  }

  const changed = file !== current

  if (!changed) {
    return {
      file: current,
      changed: false,
      rebuilt: false,
      reply:
        current.template === 'none'
          ? 'I can read a journey out of one line — try “4-step cancel with a pause, full page” or “acquisition, full page”. Or pick an option above.'
          : 'I could not read a change out of that. Use the plan below for offers, audience, shell, and brand — or type a step count, an offer name, the shell, or the audience.',
    }
  }

  return {
    file,
    changed: true,
    rebuilt,
    reply: `${list(did.map((d, i) => (i === 0 ? d.charAt(0).toUpperCase() + d.slice(1) : d)))}. Defaults are in — walk it as a subscriber, or open a row on the plan to change a default.`,
  }
}
