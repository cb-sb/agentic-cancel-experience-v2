import type { Branding, ShellLayout } from '../types/experience'
import type { JourneySource, TemplateArtifact, TemplateManifest } from '../upload/types'

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
export interface JourneyStepFile {
  id: string
  kind: JourneyStepKind
  live?: boolean
  headline?: string
  body?: string
  offer?: OfferKey
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
