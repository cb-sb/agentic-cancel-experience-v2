import type { JourneyStepKind, OfferKey } from '../journey/types'

/** How the cancel UI was authored. Default is Copilot / canvas (Chargebee-drawn). */
export type JourneySource = 'authored' | 'uploaded'

/** Bindable region inside uploaded markup. */
export type ManifestSlotType = 'offer' | 'survey' | 'field' | 'action'

/** Actions Growth understands on `[data-cb-action]`. */
export type CbAction =
  | 'continue'
  | 'back'
  | 'accept_offer'
  | 'decline_offer'
  | 'keep'
  | 'cancel'
  | 'exit'

export const CB_ACTIONS: readonly CbAction[] = [
  'continue',
  'back',
  'accept_offer',
  'decline_offer',
  'keep',
  'cancel',
  'exit',
]

export const CB_SLOT_TYPES: readonly ManifestSlotType[] = ['offer', 'survey', 'field', 'action']

export interface TemplateArtifactFile {
  path: string
  html: string
  css?: string
}

/** Versioned pack Chargebee hosts. Layout change = new upload + new checksum. */
export interface TemplateArtifact {
  id: string
  checksum: string
  version: number
  files: TemplateArtifactFile[]
}

export interface ManifestSlot {
  id: string
  type: ManifestSlotType
  /** OfferKey, reason-list id, field name, or CbAction. */
  bind?: string
}

export interface ManifestField {
  name: string
  sample?: string
}

export interface ManifestStep {
  id: string
  kind: JourneyStepKind
  /** Zip page path, or the single-file document path. */
  file?: string
  slots: ManifestSlot[]
  fields: ManifestField[]
}

export interface SurveyReasonBind {
  id: string
  label: string
}

/**
 * Logic document for an uploaded template. Copilot still owns workflow;
 * this only maps merchant chrome onto Growth entities.
 */
export interface TemplateManifest {
  steps: ManifestStep[]
  /** Scan guesses the merchant must confirm. Cleared after confirm. */
  warnings: string[]
  confirmed?: boolean
  subscriberContext?: Record<string, string>
  surveyReasons?: SurveyReasonBind[]
}

export const DEFAULT_SUBSCRIBER_CONTEXT: Record<string, string> = {
  credits_remaining: '1,240',
  plan_name: 'Pro annual',
  days_on_plan: '412',
  member_since: 'Mar 2024',
  next_renewal: '12 Oct',
  usage_hours: '92',
}

export function isCbAction(value: string): value is CbAction {
  return (CB_ACTIONS as readonly string[]).includes(value)
}

export function isOfferBind(value: string): value is OfferKey {
  return (
    value === 'discount' ||
    value === 'pause' ||
    value === 'plan_change' ||
    value === 'extension' ||
    value === 'skip' ||
    value === 'addon'
  )
}
