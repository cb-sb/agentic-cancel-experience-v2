import { V8 } from '../layout/layoutMode'
import { applyOffers, hasPlanChangeBlocks, insertPlanChangeBlocks, startFromTemplate, templateForCount, templateLabel, withLive } from './templates'
import type {
  AudienceKey,
  JourneyFile,
  JourneyKind,
  JourneyTemplate,
  OfferKey,
} from './types'
import { compileBrand, journeyBrandFrom } from '../brand/theme'
import { brandingFromSpeech, isBrandIntent } from '../brand/matchSite'
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
  /**
   * Shown when the sentence matched nothing. Each one is a sentence this
   * reader already knows how to build.
   */
  goals?: GoalChoice[]
}

/** Three goals offered when a sentence does not match. No model picks among them. */
export interface GoalChoice {
  id: 'revenue' | 'insight' | 'clean'
  label: string
  prompt: string
}

export const GOAL_CHOICES: GoalChoice[] = [
  { id: 'revenue', label: 'Save revenue', prompt: 'Save subscribers with a discount' },
  { id: 'insight', label: 'Learn why they leave', prompt: 'Just ask why they are leaving' },
  { id: 'clean', label: 'Keep the exit clean', prompt: 'FTC-safe cancel, no offers' },
]

/** Sentences under the chat box. Each one builds a journey. */
export const EXAMPLE_PROMPTS = [
  'Save high-value subscribers with a pause',
  'Just ask why they are leaving',
  'FTC-safe cancel, no offers',
] as const

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

function wantsAcquire(t: string): boolean {
  return /\bacquisition|\bacquire|\bsign ?up|\bnew subscriber/.test(t)
}

function wantsCancel(t: string): boolean {
  return /\bcancel|\bchurn|\bsave flow|\bretention|\bwin ?back|\bbefore (they|you) (go|leave)|\bsave\b|\bsubscriber|\bleaving\b|\bftc\b|\bwhy they\b|\bexpensive\b|\bprice\b/.test(t)
}

/** Pricing table + hosted checkout as blocks — not the same as acquiring. */
function wantsPlanPicker(t: string): boolean {
  return /\bpricing(\s+table|\s+page)?\b|\bcheckout\b|\bplan picker\b/.test(t)
}

function readKind(t: string, current: JourneyFile): JourneyKind | null {
  const acquire = wantsAcquire(t)
  const cancel = wantsCancel(t)
  if (V8) return acquire || cancel || wantsPlanPicker(t) ? 'cancel' : null
  if (cancel && !acquire) return 'cancel'
  if (acquire && !cancel) return 'acquisition'
  if (cancel && acquire) return 'cancel'
  if (wantsPlanPicker(t) && current.kind === 'cancel' && current.steps.length > 0) return 'cancel'
  if (wantsPlanPicker(t) && current.template === 'none') return 'acquisition'
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

function goalSentence(
  t: string,
  offerLabels: string[],
  wantsSurvey: boolean,
  cleanExit: boolean,
  audience: AudienceKey | null,
  acquire: boolean,
): string {
  if (acquire) return 'You want to acquire a subscriber. I will start with a pricing table and checkout.'
  if (/\btoo expensive|\bexpensive\b|\bprice\b/.test(t)) {
    return 'You want to save people who say it is too expensive. I will start with a discount offer.'
  }
  if (offerLabels.includes('pause')) {
    const who = audience === 'high_value' ? 'high-value subscribers' : 'subscribers'
    return `You want to save ${who} with a pause. I will start with a pause offer.`
  }
  if (offerLabels.includes('discount')) return 'You want to save revenue. I will start with a discount offer.'
  if (cleanExit) return 'You want an FTC-safe cancel with no offers. I will keep the exit clean.'
  if (wantsSurvey) return 'You want to learn why they are leaving. I will ask before they confirm.'
  if (audience === 'high_value') return 'You want this for high-value subscribers.'
  return 'You want a cancel flow.'
}

function changeSentence(offerLabels: string[], cleanExit: boolean, wantsSurvey: boolean, did: string[], acquire: boolean): string {
  if (did.some((line) => line.includes('nowhere'))) {
    const first = did[0] ?? 'Updated this journey'
    return `${first.charAt(0).toUpperCase()}${first.slice(1)}.`
  }
  if (acquire) return 'Built a pricing table, then checkout.'
  if (offerLabels.includes('pause')) return 'Added a pause offer before confirm.'
  if (offerLabels.includes('discount')) return 'Added a discount offer before confirm.'
  if (offerLabels.includes('plan change')) return 'Added a plan change before confirm.'
  if (offerLabels.includes('extension')) return 'Added an extension offer before confirm.'
  if (offerLabels.includes('skip a cycle')) return 'Added a skip offer before confirm.'
  if (offerLabels.includes('add-on')) return 'Added an add-on offer before confirm.'
  if (cleanExit) return 'Built a confirm-only cancel, with no offers.'
  if (wantsSurvey) return 'Added a short reason survey before confirm.'
  const first = did[0]
  if (!first) return 'Updated this journey.'
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}.`
}

const OTHER_FLOW = /\bdunning\b|\bfailed payment|\bat[- ]risk\b|\bupsell\b|\bexpansion\b/

export function interpret(text: string, current: JourneyFile): Interpretation {
  const t = text.toLowerCase()
  if (OTHER_FLOW.test(t)) {
    return {
      file: current,
      changed: false,
      rebuilt: false,
      reply: 'This demo only builds cancel. Pick the closest cancel path.',
      goals: GOAL_CHOICES,
    }
  }
  const kind = readKind(t, current)
  const count = readStepCount(t)
  const shell = readShell(t)
  const audience = readAudience(t)
  let { keys: offers, labels: offerLabels } = readOffers(t)
  if (/\btoo expensive|\bexpensive\b|\bprice\b/.test(t) && !offers.includes('discount')) {
    offers = ['discount', ...offers]
    offerLabels = ['discount', ...offerLabels]
  }
  const wantsSurvey = /\bsurvey|\breason|\bwhy they|\bfeedback\b|\bleaving\b/.test(t)
  const cleanExit = /\bftc\b|\bno offers?\b|\bclean exit\b|\bkeep the exit\b/.test(t)
  const planPicker = wantsPlanPicker(t) && !cleanExit

  let file = current
  const did: string[] = []
  let rebuilt = false

  const nextKind = kind ?? (current.template === 'none' ? null : current.kind)
  const uploaded = current.source === 'uploaded'

  // --- Structure: kind, step count, template ------------------------------
  // Uploaded screens are the pack. Never rebuild them from a Chargebee template.
  if (uploaded) {
    // Targeting, shell, offers, and brand still apply below.
  } else if (nextKind === 'acquisition') {
    if (current.kind !== 'acquisition' || current.template !== 'acquire_2') {
      file = startFromTemplate(file, 'acquire_2')
      rebuilt = true
      did.push('built a 2-step acquire: pricing table, then checkout')
    }
  } else if (nextKind === 'cancel' && planPicker) {
    if (hasPlanChangeBlocks(file)) {
      // Already a cancel with a plan picker — leave the spine, apply knobs below.
    } else if (current.kind === 'cancel' && current.steps.length > 0) {
      file = insertPlanChangeBlocks(file)
      rebuilt = true
      did.push('put a plan picker and checkout before they confirm they can still leave')
    } else {
      file = startFromTemplate({ ...file, kind: 'cancel' }, 'cancel_plan_change')
      rebuilt = true
      did.push('built the plan-change-to-save cancel flow')
    }
  } else if (nextKind === 'cancel') {
    let template: JourneyTemplate | null = count ? templateForCount(count) : null
    if (cleanExit && !count) template = 'cancel_1'
    else if (!template && (offers.length || wantsSurvey) && current.template === 'none') {
      template = offers.length ? OFFER_MIN : SURVEY_MIN
    }
    if (template && !cleanExit) {
      // Asking for offers or a survey cannot land on a template too short to
      // hold them, whatever number came with it.
      if (offers.length) template = atLeast(template, OFFER_MIN)
      else if (wantsSurvey) template = atLeast(template, SURVEY_MIN)
    }
    if (template && (template !== current.template || current.kind !== 'cancel')) {
      file = startFromTemplate({ ...file, kind: 'cancel' }, template)
      rebuilt = true
      did.push(`built the ${templateLabel(template).toLowerCase()} cancel flow`)
      if (count && count > 5) did.push('capped it at five steps, which is as long as this gets')
    }
  }

  // A typed request is a decision, so the steps go live rather than staying
  // as the gray skeleton the buttons walk you through.
  if (rebuilt) file = { ...file, steps: withLive(file.steps, true) }

  // --- Content: offers, shell, audience -----------------------------------
  if (!cleanExit && offers.length && file.steps.some((s) => s.kind === 'offer')) {
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
  } else if (!cleanExit && offers.length) {
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

  if (isBrandIntent(text)) {
    const spoken = brandingFromSpeech(text, compileBrand(file.brand))
    if (spoken.notes.length) {
      file = { ...file, brand: journeyBrandFrom(spoken.branding, true) }
      did.push(spoken.notes.join('; '))
    }
  }

  const changed = file !== current

  if (!changed) {
    return {
      file: current,
      changed: false,
      rebuilt: false,
      reply: "I'll assume you want to save revenue on a cancel flow.",
      goals: GOAL_CHOICES,
    }
  }

  const acquire = file.kind === 'acquisition'
  const goal = goalSentence(t, offerLabels, wantsSurvey && !cleanExit, cleanExit, audience ?? file.audience, acquire)
  const change = changeSentence(offerLabels, cleanExit, wantsSurvey && !cleanExit, did, acquire)
  return {
    file,
    changed: true,
    rebuilt,
    reply: `${goal}\n${change}`,
  }
}
