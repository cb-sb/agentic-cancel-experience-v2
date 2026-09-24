import type { JourneyFile, JourneyKind, JourneyStepKind, OfferKey } from '../journey/types'
import type { ManifestField, ManifestSlot, TemplateArtifact, TemplateManifest } from '../upload/types'

/**
 * An offer the merchant owns, stored once and linked from any journey.
 * The wording lives here. A journey step only keeps `sharedOfferId`.
 */
export interface SharedOffer {
  id: string
  name: string
  offer: OfferKey
  title: string
  description: string
  primaryCta: string
  contentHash: string
  savedAt: number
}

/**
 * A loss-aversion card or a survey the merchant owns, stored once and linked
 * from any journey. The wording lives here. A step only keeps `sharedCardId`.
 */
export interface SharedCard {
  id: string
  kind: 'loss_aversion' | 'survey'
  name: string
  title: string
  description: string
  keepItems: string[]
  loseItems: string[]
  surveyReasons: string[]
  surveyPrompt: string
  contentHash: string
  savedAt: number
}

/** An authored journey saved beside the shared offers it uses. */
export interface SavedJourney {
  id: string
  name: string
  savedAt: number
  offerIds: string[]
  file: JourneyFile
}

/** One reusable primitive in the shared catalog. Upserted by chrome hash. */
export interface MerchantComponent {
  id: string
  kind: JourneyStepKind
  label: string
  html: string
  css?: string
  slots: ManifestSlot[]
  fields: ManifestField[]
  sourceStepId: string
  contentHash: string
  /** When this chrome first landed in the catalog. Older rows may omit it. */
  savedAt?: number
}

/** Confirmed composed experience. Points at shared catalog ids. */
export interface MerchantTemplate {
  id: string
  name: string
  savedAt: number
  kind: JourneyKind
  contractVersion: string
  checksum: string
  artifact: TemplateArtifact
  manifest: TemplateManifest
  stepLabels: string[]
  componentIds: string[]
  /** @deprecated Nested copy from library v1. Prefer componentIds + catalog. */
  components?: MerchantComponent[]
}
