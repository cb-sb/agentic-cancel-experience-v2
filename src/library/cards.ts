import { makeLossAversion, makeSurvey } from '../lib/factories'
import { uid } from '../lib/id'
import { isTailKind, EMPTY_JOURNEY, type JourneyFile, type JourneyStepFile } from '../journey/types'
import { withLive } from '../journey/templates'
import type { SavedJourney, SharedCard } from './types'

const DEFAULT_SURVEY_HEADLINE = 'Why are you cancelling?'
const DEFAULT_SURVEY_BODY = 'Your feedback shapes what we build next.'

export type CardPlace =
  | { kind: 'start' }
  | { kind: 'show'; stepId: string }
  | { kind: 'add'; file: JourneyFile }
  | { kind: 'blocked'; reason: string }

function cardHash(card: Pick<SharedCard, 'kind' | 'title' | 'description' | 'keepItems' | 'loseItems' | 'surveyReasons' | 'surveyPrompt'>): string {
  return [
    card.kind,
    card.title.trim(),
    card.description.trim(),
    card.keepItems.join('\u001e'),
    card.loseItems.join('\u001e'),
    card.surveyReasons.join('\u001e'),
    card.surveyPrompt.trim(),
  ].join('\u001f')
}

function clip(text: string, max = 48): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

function fromLoss(step: JourneyStepFile): Omit<SharedCard, 'id' | 'contentHash' | 'savedAt'> {
  const fallback = makeLossAversion()
  const title = step.headline?.trim() || 'Before you go'
  const keepItems = step.content?.keepItems ?? fallback.keepItems.map((item) => item.label)
  const loseItems = step.content?.loseItems ?? fallback.loseItems.map((item) => item.label)
  const description = step.body?.trim() || fallback.message
  return {
    kind: 'loss_aversion',
    name: clip(title) || 'What you keep',
    title,
    description,
    keepItems,
    loseItems,
    surveyReasons: [],
    surveyPrompt: '',
  }
}

function fromSurvey(step: JourneyStepFile): Omit<SharedCard, 'id' | 'contentHash' | 'savedAt'> {
  const fallback = makeSurvey()
  const title = step.headline?.trim() || DEFAULT_SURVEY_HEADLINE
  const surveyReasons =
    step.content?.surveyReasons?.map((label) => label.trim()).filter(Boolean) ??
    fallback.options.map((option) => option.label)
  const surveyPrompt = step.content?.surveyPrompt?.trim() || fallback.freeTextPrompt
  const description = surveyReasons.slice(0, 3).join(' · ') || DEFAULT_SURVEY_BODY
  return {
    kind: 'survey',
    name: clip(title) || 'Why they leave',
    title,
    description,
    keepItems: [],
    loseItems: [],
    surveyReasons,
    surveyPrompt,
  }
}

function paintStep(step: JourneyStepFile, card: SharedCard): JourneyStepFile {
  if (card.kind === 'survey') {
    return {
      ...step,
      sharedCardId: card.id,
      headline: card.title,
      body: step.body,
      content: {
        ...step.content,
        surveyReasons: card.surveyReasons,
        surveyPrompt: card.surveyPrompt,
      },
    }
  }
  return {
    ...step,
    sharedCardId: card.id,
    headline: card.title,
    body: card.description,
    content: {
      ...step.content,
      keepItems: card.keepItems,
      loseItems: card.loseItems,
    },
  }
}

function stepFromCard(card: SharedCard): JourneyStepFile {
  const id = uid('step')
  if (card.kind === 'survey') {
    return {
      id,
      kind: 'survey',
      live: true,
      headline: card.title,
      sharedCardId: card.id,
      content: { surveyReasons: card.surveyReasons, surveyPrompt: card.surveyPrompt },
    }
  }
  return {
    id,
    kind: 'loss_aversion',
    live: true,
    headline: card.title,
    body: card.description,
    sharedCardId: card.id,
    content: { keepItems: card.keepItems, loseItems: card.loseItems },
  }
}

function insertBeforeTail(steps: JourneyStepFile[], step: JourneyStepFile): JourneyStepFile[] {
  const tailAt = steps.findIndex((s) => isTailKind(s.kind))
  if (tailAt < 0) return [...steps, step]
  return [...steps.slice(0, tailAt), step, ...steps.slice(tailAt)]
}

/** A survey that already has its own wording cannot be replaced by another. */
export function surveyIsCustom(step: JourneyStepFile): boolean {
  if (step.kind !== 'survey') return false
  if (step.sharedCardId) return true
  const reasons = step.content?.surveyReasons?.map((label) => label.trim()).filter(Boolean) ?? []
  if (reasons.length > 0) return true
  if (step.content?.surveyPrompt?.trim()) return true
  if (step.headline && step.headline !== DEFAULT_SURVEY_HEADLINE) return true
  if (step.body?.trim() && step.body.trim() !== DEFAULT_SURVEY_BODY) return true
  return false
}

/**
 * Pull every loss-aversion and survey step into the shared catalog.
 * A linked step updates that card. An unlinked step joins a card with the
 * same wording, or becomes a new one.
 */
export function identifyCards(
  file: JourneyFile,
  catalog: SharedCard[],
): { file: JourneyFile; cards: SharedCard[] } {
  const cards = catalog.map((card) => ({ ...card }))
  let changed = false
  const steps = file.steps.map((step) => {
    if (step.kind !== 'loss_aversion' && step.kind !== 'survey') return step
    const draft = step.kind === 'survey' ? fromSurvey(step) : fromLoss(step)
    const hash = cardHash(draft)
    const linked = step.sharedCardId ? cards.find((card) => card.id === step.sharedCardId) : undefined
    if (linked) {
      if (linked.contentHash === hash) return step
      Object.assign(linked, draft, { contentHash: hash, savedAt: Date.now() })
      changed = true
      return paintStep(step, linked)
    }
    const existing = cards.find((card) => card.contentHash === hash)
    if (existing) {
      changed = true
      return paintStep(step, existing)
    }
    const created: SharedCard = {
      ...draft,
      id: uid(step.kind === 'survey' ? 'survey' : 'card'),
      contentHash: hash,
      savedAt: Date.now(),
    }
    cards.unshift(created)
    changed = true
    return paintStep(step, created)
  })
  if (!changed) return { file, cards: catalog }
  return { file: { ...file, steps }, cards }
}

/** Write one shared card onto every step that links to it. */
export function paintCard(file: JourneyFile, card: SharedCard): JourneyFile {
  let changed = false
  const steps = file.steps.map((step) => {
    if (step.sharedCardId !== card.id) return step
    changed = true
    return paintStep(step, card)
  })
  return changed ? { ...file, steps } : file
}

export function journeysUsingCard(cardId: string, journeys: SavedJourney[], file?: JourneyFile): SavedJourney[] {
  const used = journeys.filter((journey) => journey.file.steps.some((step) => step.sharedCardId === cardId))
  if (!file) return used
  const onFile = file.steps.some((step) => step.sharedCardId === cardId)
  if (!onFile) return used
  if (file.libraryId && used.some((journey) => journey.id === file.libraryId)) return used
  return [
    ...used,
    {
      id: file.libraryId ?? '__current__',
      name: file.name || 'This journey',
      savedAt: 0,
      offerIds: [],
      file,
    },
  ]
}

/**
 * Put this card on the open journey without replacing it.
 * Loss aversion fills an unlinked step, or is inserted at the front.
 * A survey fills an untouched survey. A survey that already has its own
 * wording is left alone.
 */
export function placeSharedCard(file: JourneyFile, card: SharedCard): CardPlace {
  if (file.steps.length === 0) return { kind: 'start' }
  const linked = file.steps.find((step) => step.sharedCardId === card.id)
  if (linked) return { kind: 'show', stepId: linked.id }

  if (card.kind === 'survey') {
    const existing = file.steps.find((step) => step.kind === 'survey')
    if (existing && surveyIsCustom(existing)) {
      return { kind: 'blocked', reason: 'This journey already has a survey.' }
    }
    if (existing) {
      return {
        kind: 'add',
        file: {
          ...file,
          steps: file.steps.map((step) => (step.id === existing.id ? paintStep(step, card) : step)),
        },
      }
    }
    return { kind: 'add', file: { ...file, steps: insertBeforeTail(file.steps, stepFromCard(card)) } }
  }

  const open = file.steps.find((step) => step.kind === 'loss_aversion' && !step.sharedCardId)
  if (open) {
    return {
      kind: 'add',
      file: {
        ...file,
        steps: file.steps.map((step) => (step.id === open.id ? paintStep(step, card) : step)),
      },
    }
  }
  return { kind: 'add', file: { ...file, steps: [stepFromCard(card), ...file.steps] } }
}

/** A new journey whose first step is this shared card. */
export function journeyFromSharedCard(base: JourneyFile, card: SharedCard): JourneyFile {
  const tail: JourneyStepFile[] = [
    { id: 'confirm', kind: 'confirmation', headline: 'Are you sure you want to cancel?' },
    { id: 'saved', kind: 'outcome_saved', headline: 'Your plan is staying active' },
    { id: 'cancelled', kind: 'outcome_cancelled', headline: 'Your plan has been cancelled' },
  ]
  return {
    ...EMPTY_JOURNEY,
    brand: base.brand,
    libraryId: uid('jny'),
    name: card.name,
    template: 'none',
    steps: withLive([stepFromCard(card), ...tail], true),
  }
}
