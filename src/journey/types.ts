import type { Branding, ShellLayout } from '../types/experience'
import type {
  JourneySource,
  ManifestField,
  ManifestSlot,
  TemplateArtifact,
  TemplateManifest,
} from '../upload/types'

/** Which product surface this file is. New journeys are new files, not new UIs. */
export type JourneyKind = 'cancel' | 'acquisition'

/**
 * The named template the chat picked. `none` is the blank canvas before a
 * prompt has chosen anything — the tree is empty on purpose.
 */
export type JourneyTemplate =
  | 'none'
  | 'cancel_1'
  | 'cancel_2'
  | 'cancel_3'
  | 'cancel_4'
  | 'cancel_5'
  | 'cancel_plan_change'
  | 'acquire_2'

export type JourneyStepKind =
  | 'loss_aversion'
  | 'survey'
  | 'offer'
  | 'pricing_table'
  | 'checkout'
  | 'confirmation'
  | 'outcome_saved'
  | 'outcome_cancelled'

/** Catalog keys the YAML names. They compile to offer variants. */
export type OfferKey = 'discount' | 'pause' | 'plan_change' | 'extension' | 'skip' | 'addon'

export type AudienceKey = 'all' | 'paying' | 'high_value' | 'high_risk' | 'annual' | 'in_trial'

/** Merchant identity shortcuts plus the full token theme the studio edits. */
export interface JourneyBrand {
  merchant: string
  primary: string
  corners: number
  /** Full Branding object. Compile copies this through instead of DEFAULT_BRANDING. */
  theme?: Partial<Branding>
  /**
   * True after the merchant matched the page the snippet will run on (URL,
   * screenshot/video, or description). Required for every authored cancel
   * and acquisition experience.
   */
  matched?: boolean
}

export const DEFAULT_JOURNEY_BRAND: JourneyBrand = {
  merchant: 'chargebee',
  primary: '#2563eb',
  corners: 12,
}

/**
 * One row in the logic document. `live: false` is the gray skeleton the tree
 * shows after a template is picked and before the prompt has filled it in.
 */
/**
 * Merchant-hosted HTML slice for one step. Chargebee postures stay authored;
 * this swaps only the chrome for that primitive (confirm, offer, survey, …).
 */
export interface JourneyStepChrome {
  libraryComponentId?: string
  html: string
  css?: string
  slots: ManifestSlot[]
  fields: ManifestField[]
}

/**
 * Component-level content the Context editor writes back onto a step. These are
 * overrides layered on top of the factory defaults at compile time, so the
 * JourneyFile stays the source of truth for what the subscriber actually sees.
 */
export interface JourneyStepContent {
  /** Loss aversion — "what you'll keep" bullet labels, in order. */
  keepItems?: string[]
  /** Loss aversion — "what you'll lose" bullet labels, in order. */
  loseItems?: string[]
  /** Survey — reason option labels, in order. */
  surveyReasons?: string[]
  /** Survey — free-text prompt under the reasons. */
  surveyPrompt?: string
}

export interface JourneyStepFile {
  id: string
  kind: JourneyStepKind
  live?: boolean
  headline?: string
  body?: string
  offer?: OfferKey
  /** Component-level copy the Context editor edits directly. */
  content?: JourneyStepContent
  /** Saved merchant chrome for this step. Compile still uses factories for the rest. */
  chrome?: JourneyStepChrome
}

/** How Growth actually processes the cancel once the page is done with it. */
export type CancelProcessing = 'billing_api' | 'override'

/** When the cancel takes effect after it is processed. */
export type CancelTiming = 'immediate' | 'end_of_term' | 'end_of_billing_term'

/**
 * Cancellation handling — the Cancel Page "Button Configurations" and "Billing
 * Configurations" in Growth: where Nevermind/Cancel route, and how the cancel
 * is processed and timed. Billing/compliance-critical, so it is tracked
 * explicitly rather than assumed.
 */
export interface JourneyCancelHandling {
  processing?: CancelProcessing
  timing?: CancelTiming
  /** Where "Never mind" returns the subscriber. */
  nevermindUrl?: string
  /** Where a confirmed cancel returns the subscriber. */
  cancelUrl?: string
}

/**
 * The file behind Prompt and Code. Chat patches it; Code edits it; the canvas
 * and the player are compiled from it.
 */
export interface JourneyFile {
  kind: JourneyKind
  template: JourneyTemplate
  name: string
  shell: ShellLayout
  audience: AudienceKey
  brand: JourneyBrand
  /** Share of traffic that sees no treatment. 0 means everyone is in. */
  holdout: number
  /** How the cancel is routed and processed once the page is done. */
  cancelHandling?: JourneyCancelHandling
  steps: JourneyStepFile[]
  /**
   * `uploaded` means the subscriber sees merchant markup hosted by Chargebee.
   * Copilot still authors Chargebee-drawn journeys (`authored`, the default).
   */
  source?: JourneySource
  artifact?: TemplateArtifact
  manifest?: TemplateManifest
}

export const EMPTY_JOURNEY: JourneyFile = {
  kind: 'cancel',
  template: 'none',
  name: 'Untitled journey',
  shell: 'modal',
  audience: 'all',
  brand: { ...DEFAULT_JOURNEY_BRAND },
  holdout: 0,
  steps: [],
}

export function isTailKind(kind: JourneyStepKind): boolean {
  return kind === 'confirmation' || kind === 'outcome_saved' || kind === 'outcome_cancelled'
}
