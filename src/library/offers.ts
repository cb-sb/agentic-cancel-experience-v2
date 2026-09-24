import { offerVariantLabel, offerVariantPatch } from '../lib/offerVariants'
import { uid } from '../lib/id'
import { isTailKind, type JourneyFile, type JourneyStepFile, type OfferKey } from '../journey/types'
import { withLive } from '../journey/templates'
import { EMPTY_JOURNEY } from '../journey/types'
import type { SavedJourney, SharedOffer } from './types'

export interface OfferWording {
  offer: OfferKey
  title: string
  description: string
  primaryCta: string
}

export function offerHash(wording: OfferWording): string {
  return [wording.offer, wording.title.trim(), wording.description.trim(), wording.primaryCta.trim()].join('\u001f')
}

export function offerName(title: string, offer: OfferKey): string {
  const trimmed = title.trim()
  if (!trimmed) return offerVariantLabel(offer)
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed
}

/** What an offer step says right now, falling back to the variant defaults. */
export function wordingFromStep(step: JourneyStepFile, shared?: SharedOffer): OfferWording {
  const offer = step.offer ?? shared?.offer ?? 'discount'
  const variant = offerVariantPatch(offer)
  const typeChanged = Boolean(shared && step.offer && step.offer !== shared.offer)
  return {
    offer,
    title: step.headline ?? shared?.title ?? variant.title ?? '',
    description: step.body ?? shared?.description ?? variant.description ?? '',
    primaryCta: typeChanged ? (variant.primaryCta ?? '') : (shared?.primaryCta ?? variant.primaryCta ?? ''),
  }
}

export function journeysUsing(offerId: string, journeys: SavedJourney[], file?: JourneyFile): SavedJourney[] {
  const used = journeys.filter((j) => j.offerIds.includes(offerId))
  if (!file) return used
  const onFile = file.steps.some((s) => s.sharedOfferId === offerId)
  if (!onFile) return used
  if (file.libraryId && used.some((j) => j.id === file.libraryId)) return used
  return [
    ...used,
    {
      id: file.libraryId ?? '__current__',
      name: file.name || 'This journey',
      savedAt: 0,
      offerIds: [offerId],
      file,
    },
  ]
}

function paintStep(step: JourneyStepFile, offer: SharedOffer, adoptWording: boolean): JourneyStepFile {
  if (!adoptWording) {
    return { ...step, sharedOfferId: offer.id, offer: step.offer ?? offer.offer }
  }
  return {
    ...step,
    sharedOfferId: offer.id,
    offer: offer.offer,
    headline: offer.title,
    body: offer.description,
  }
}

/**
 * Pull every offer step into the shared catalog.
 * A step that already links updates that offer. A step that does not links to
 * an existing offer with the same wording, or becomes a new one.
 */
export function identifyOffers(
  file: JourneyFile,
  catalog: SharedOffer[],
): { file: JourneyFile; offers: SharedOffer[] } {
  const offers = catalog.map((o) => ({ ...o }))
  let changed = false
  const libraryId = file.libraryId ?? uid('jny')
  if (!file.libraryId) changed = true

  const steps = file.steps.map((step) => {
    if (step.kind !== 'offer') return step
    const linked = step.sharedOfferId ? offers.find((o) => o.id === step.sharedOfferId) : undefined
    const wording = wordingFromStep(step, linked)
    const hash = offerHash(wording)

    if (linked) {
      if (linked.contentHash === hash) return step
      linked.offer = wording.offer
      linked.title = wording.title
      linked.description = wording.description
      linked.primaryCta = wording.primaryCta
      linked.name = offerName(wording.title, wording.offer)
      linked.contentHash = hash
      linked.savedAt = Date.now()
      changed = true
      return paintStep(step, linked, false)
    }

    const existing = offers.find((o) => o.contentHash === hash)
    if (existing) {
      changed = true
      const sameWording = (step.headline ?? wording.title) === existing.title && (step.body ?? wording.description) === existing.description
      return paintStep(step, existing, !sameWording)
    }

    const created: SharedOffer = {
      id: uid('offer'),
      name: offerName(wording.title, wording.offer),
      offer: wording.offer,
      title: wording.title,
      description: wording.description,
      primaryCta: wording.primaryCta,
      contentHash: hash,
      savedAt: Date.now(),
    }
    offers.unshift(created)
    changed = true
    return paintStep(step, created, false)
  })

  if (!changed) return { file, offers: catalog }
  return { file: { ...file, libraryId, steps }, offers }
}

/** Write one shared offer's wording onto every step that links to it. */
export function paintOffer(file: JourneyFile, offer: SharedOffer): JourneyFile {
  let changed = false
  const steps = file.steps.map((step) => {
    if (step.kind !== 'offer' || step.sharedOfferId !== offer.id) return step
    if (step.offer === offer.offer && step.headline === offer.title && step.body === offer.description) return step
    changed = true
    return paintStep(step, offer, true)
  })
  return changed ? { ...file, steps } : file
}

export function offerIdsIn(file: JourneyFile): string[] {
  const ids: string[] = []
  for (const step of file.steps) {
    if (step.kind === 'offer' && step.sharedOfferId && !ids.includes(step.sharedOfferId)) {
      ids.push(step.sharedOfferId)
    }
  }
  return ids
}

export function upsertSavedJourney(journeys: SavedJourney[], file: JourneyFile): SavedJourney[] {
  if (!file.libraryId) return journeys
  const saved: SavedJourney = {
    id: file.libraryId,
    name: file.name || 'Untitled journey',
    savedAt: Date.now(),
    offerIds: offerIdsIn(file),
    file,
  }
  const existing = journeys.find((j) => j.id === file.libraryId)
  if (!existing) return [saved, ...journeys]
  return journeys.map((j) => (j.id === saved.id ? saved : j))
}

function insertBeforeTail(steps: JourneyStepFile[], step: JourneyStepFile): JourneyStepFile[] {
  const tailAt = steps.findIndex((s) => isTailKind(s.kind))
  if (tailAt < 0) return [...steps, step]
  return [...steps.slice(0, tailAt), step, ...steps.slice(tailAt)]
}

export function stepFromSharedOffer(offer: SharedOffer): JourneyStepFile {
  return {
    id: uid('step'),
    kind: 'offer',
    live: true,
    offer: offer.offer,
    headline: offer.title,
    body: offer.description,
    sharedOfferId: offer.id,
  }
}

/** Drop a shared offer into the journey that is open. Skips it when already linked. */
export function attachSharedOffer(file: JourneyFile, offer: SharedOffer): JourneyFile {
  if (file.steps.some((s) => s.sharedOfferId === offer.id)) return file
  return { ...file, steps: insertBeforeTail(file.steps, stepFromSharedOffer(offer)) }
}

export type OfferPlace =
  | { kind: 'start' }
  | { kind: 'show'; stepId: string }
  | { kind: 'add'; file: JourneyFile }

/**
 * Put this offer on the open journey without replacing it.
 * An unlinked offer step takes the wording. Otherwise a new step is inserted
 * before confirmation.
 */
export function placeSharedOffer(file: JourneyFile, offer: SharedOffer): OfferPlace {
  if (file.steps.length === 0) return { kind: 'start' }
  const linked = file.steps.find((s) => s.kind === 'offer' && s.sharedOfferId === offer.id)
  if (linked) return { kind: 'show', stepId: linked.id }
  const open = file.steps.find((s) => s.kind === 'offer' && !s.sharedOfferId)
  if (open) {
    return {
      kind: 'add',
      file: {
        ...file,
        steps: file.steps.map((s) => (s.id === open.id ? paintStep(s, offer, true) : s)),
      },
    }
  }
  return { kind: 'add', file: attachSharedOffer(file, offer) }
}

/** A new journey whose only save step is this shared offer. */
export function journeyFromSharedOffer(base: JourneyFile, offer: SharedOffer): JourneyFile {
  const tail: JourneyStepFile[] = [
    { id: 'confirm', kind: 'confirmation', headline: 'Are you sure you want to cancel?' },
    { id: 'saved', kind: 'outcome_saved', headline: 'Your plan is staying active' },
    { id: 'cancelled', kind: 'outcome_cancelled', headline: 'Your plan has been cancelled' },
  ]
  return {
    ...EMPTY_JOURNEY,
    brand: base.brand,
    libraryId: uid('jny'),
    name: offer.name,
    template: 'none',
    steps: withLive([stepFromSharedOffer(offer), ...tail], true),
  }
}
