/**
 * Domain model for a cancel experience.
 *
 * Mirrors "Guidelines to design a cancel experience" — an Experience is an
 * ordered list of at most 6 Steps (FTC click-to-cancel cap). Each Step is a
 * [Step frame] + [Stage content], where stage content is one or more
 * Components working toward that stage's job.
 */

// ---------------------------------------------------------------------------
// Blueprints & stages
// ---------------------------------------------------------------------------

export type BlueprintId =
  | 'click_to_cancel' // 1 step  — Impact + confirmation only
  | 'clean_exit_1' //    2 steps — Value reinforcement -> confirmation
  | 'clean_exit_2' //    3 steps — Value reinforcement -> survey -> confirmation
  | 'balanced' //        4 steps — LA -> survey -> offer -> confirmation
  | 'save_aggressive' // 5 steps — LA -> entry offer -> survey -> offer -> confirmation
  | 'custom_6' //        6 steps — extended (FTC max)

export type StageId =
  | 'value_reinforcement'
  | 'entry_offer'
  | 'route_detection'
  | 'save_mechanic'
  | 'checkout'
  | 'confirmation'
  | 'outcome'

export interface BlueprintMeta {
  id: BlueprintId
  name: string
  stepCount: number
  posture: 'clean_exit' | 'balanced' | 'save_aggressive'
  description: string
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export type ComponentKind =
  | 'loss_aversion'
  | 'survey'
  | 'offer'
  | 'pricing_table'
  | 'checkout'
  | 'confirmation'
  | 'outcome'

export interface MediaAsset {
  type: 'image' | 'video'
  url?: string
  /** Image focal point (0–100%) — maps to CSS object-position. */
  focalX?: number
  focalY?: number
}

/** Loss Aversion card — account_activity | feature_list | message. */
export type LACardType = 'account_activity' | 'feature_list' | 'message'

export interface LAListItem {
  id: string
  label: string
  detail?: string
}

export interface LAStat {
  id: string
  value: string
  label: string
}

export interface LossAversionComponent {
  id: string
  kind: 'loss_aversion'
  cardType: LACardType
  /** Media forces the card to be standalone in its step. */
  media?: MediaAsset | null
  /** feature_list: what the user keeps. */
  keepTitle?: string
  keepItems?: LAListItem[]
  /** feature_list: what the user loses. */
  loseTitle?: string
  loseItems?: LAListItem[]
  /** account_activity: usage stats. */
  statsTitle?: string
  stats?: LAStat[]
  /** message: brand-voice message body. */
  message?: string
}

/** Survey Reason — route detection.
 *  - inline_reason: radio list that, on selection, fades/collapses the other
 *    reasons and expands a free-text follow-up in the vacated space so the
 *    modal height never grows. */
export type SurveyPresentation = 'radio' | 'dropdown' | 'free_text' | 'inline_reason'

export interface SurveyFollowUp {
  enabled: boolean
  prompt: string
  placeholder?: string
  /** optional=true means the user is never forced to fill it. */
  optional: boolean
}

export interface SurveyReasonOption {
  id: string
  label: string
  /** Canonical ReasonForLeaving code for analytics. */
  code: string
  isOther?: boolean
  followUp?: SurveyFollowUp | null
  /** Reason-linked offer, rendered on a following step. */
  linkedOfferId?: string | null
}

/** Drop-shadow presets for editable surfaces. */
export type ShadowLevel = 'none' | 'sm' | 'md' | 'lg'

/** Per-component surface styling — stroke (border), fill (background) & shadow.
 *  All fields optional; unset values fall back to the component's defaults. */
export interface SurfaceStyle {
  /** Background fill color. */
  fillColor?: string
  /** Border / stroke color. */
  strokeColor?: string
  /** Border / stroke width in px (0 = no stroke). */
  strokeWidth?: number
  /** Drop-shadow preset. */
  shadow?: ShadowLevel
}

export interface SurveyComponent {
  id: string
  kind: 'survey'
  presentation: SurveyPresentation
  randomize: boolean
  options: SurveyReasonOption[]
  /** Prompt used when presentation === 'free_text'. */
  freeTextPrompt?: string
  /** inline_reason: shared follow-up prompt shown after any reason is picked. */
  inlinePrompt?: string
  /** inline_reason: placeholder for the shared follow-up textarea. */
  inlinePlaceholder?: string
  /** Stroke / fill / shadow applied to each reason option row. */
  optionStyle?: SurfaceStyle
}

/** Offer categories (Offer Variations in the guidelines). */
export type OfferCategory =
  | 'discount'
  | 'plan_change'
  | 'addon'
  | 'one_time_charge'
  | 'skip'
  | 'extension'
  | 'pause'
  | 'support_train'
  | 'product_feedback'
  | 'multi_action'

/** Fulfillment routes. checkout/billing-altering offers open dummy checkout. */
export type FulfillmentType = 'billing' | 'checkout' | 'url' | 'webhook' | 'email'

export interface OfferComponent {
  id: string
  kind: 'offer'
  category: OfferCategory
  eyebrow?: string
  title: string
  description: string
  /** Standalone offers carry media; a step with two offers strips it from both. */
  media?: MediaAsset | null
  /** Which side the media sits on within the card (default 'left'). */
  mediaSide?: 'left' | 'right'
  primaryCta: string
  secondaryCta?: string
  downgradeLink?: string
  /** @deprecated Replaced by consent box — kept for backward compatibility. */
  socialProof?: string
  /** When true, subscriber must tick the consent checkbox before accepting. */
  consentEnabled?: boolean
  consentStatement?: string
  fulfillment: FulfillmentType
  reasonLinked: boolean
  billingEntity?: {
    couponId?: string
    planId?: string
    addonId?: string
  }
  /** Stroke / fill / shadow applied to the offer card surface. */
  cardStyle?: SurfaceStyle
}

export interface PricingPlan {
  id: string
  name: string
  price: string
  cadence: string
  features: string[]
  highlighted?: boolean
  ctaLabel: string
}

export interface PricingTableComponent {
  id: string
  kind: 'pricing_table'
  plans: PricingPlan[]
  fulfillment: 'checkout' | 'url'
}

/** A first-class checkout step — the same dummy checkout that used to overlay. */
export interface CheckoutComponent {
  id: string
  kind: 'checkout'
  title: string
  subtitle?: string
}

/** Confirmation -> Outcome. */
export type ConfirmationVariant = 'simple' | 'consent' | 'type_confirm'
export type OutcomeVariant = 'success' | 'reactivation' | 'feedback'

export interface ImpactItem {
  id: string
  label: string
  detail?: string
  severity: 'amber' | 'red'
}

export interface ConfirmationComponent {
  id: string
  kind: 'confirmation'
  variant: ConfirmationVariant
  title: string
  subtitle: string
  consentText?: string
  confirmKeyword?: string
  impact: ImpactItem[]
  endDateLabel?: string
  keepCta: string
  cancelCta: string
}

/**
 * Outcome (post-confirmation result). Lives on its own step/tab so the merchant
 * edits it inline like every other card. The variant is a structural choice;
 * headline/body/undoCta/feedbackPrompt are edited directly on the card.
 */
export interface OutcomeComponent {
  id: string
  kind: 'outcome'
  variant: OutcomeVariant
  /**
   * Which end of the journey this card is. Accepting an offer or keeping the
   * subscription lands on the `saved` outcome; going through with cancelling
   * lands on the `cancelled` one.
   *
   * A flow has one of each, so the canvas can draw where a decision leads
   * instead of pointing every path at a single card that then quietly changed
   * its own copy depending on how it was reached.
   */
  forResult: 'saved' | 'cancelled'
  headline: string
  body?: string
  /** reactivation: label for the one-click restore CTA. */
  undoCta?: string
  /** feedback: prompt shown above the feedback textarea. */
  feedbackPrompt?: string
}

export type ExperienceComponent =
  | LossAversionComponent
  | SurveyComponent
  | OfferComponent
  | PricingTableComponent
  | CheckoutComponent
  | ConfirmationComponent
  | OutcomeComponent

// ---------------------------------------------------------------------------
// Steps & experience
// ---------------------------------------------------------------------------

export type StepLayout = 'single' | 'two_column'

export interface Step {
  id: string
  stage: StageId
  title: string
  description: string
  layout: StepLayout
  components: ExperienceComponent[]
  /** Editable label for the primary navigation CTA (falls back to a computed default). */
  navContinueLabel?: string
  /** Two-column split: share of width given to the left/first component (0..1). */
  splitRatio?: number
  /** Disabled steps stay in the composer but are skipped in the live flow. */
  disabled?: boolean
}

export type TonePreset = 'Formal' | 'Friendly-professional' | 'Playful' | 'Direct'

/** A paint can be a flat color or a two-stop linear gradient. */
export type FillType = 'solid' | 'gradient'
export type TextAlign = 'left' | 'center' | 'right'

export interface Branding {
  merchantName: string
  logoUrl?: string
  /** Modal surface background (Stripe: websiteColor). */
  siteColor: string
  /** Content / card background (Stripe: colorBackground). Solid fallback. */
  cardColor: string
  /** Header bar background. Undefined = transparent (inherits the card fill). */
  headerColor?: string
  /** Card fill: solid uses cardColor; gradient uses the stops below. */
  cardFillType: FillType
  cardGradientFrom: string
  cardGradientTo: string
  cardGradientAngle: number
  /** Card border paint. Solid uses cardBorderColor; gradient uses stops. */
  cardBorderColor: string
  cardBorderType: FillType
  cardBorderGradientFrom: string
  cardBorderGradientTo: string
  cardBorderGradientAngle: number
  /** Card border stroke width in px (0 = no border). */
  cardBorderWidth: number
  primaryColor: string
  secondaryColor: string
  accentColor: string
  /** Heading / title text color. */
  titleColor: string
  /** Body text color. */
  textColor: string
  /** Secondary / muted text color (descriptions, captions, labels). */
  mutedColor: string
  fontFamily: string
  /** Heading / title typeface stack. Falls back to fontFamily when unset. */
  headingFontFamily?: string
  /** Body copy typeface stack. Falls back to fontFamily when unset. */
  bodyFontFamily?: string
  /** Heading font weight (300–800). Independent of the body weight. */
  headingFontWeight?: number
  /** Heading size as a percentage scale of each heading's base size (100 = unchanged). */
  headingFontScale?: number
  /** Heading line-height multiplier. Independent of the body line-height. */
  headingLineHeight?: number
  /** Heading letter spacing as a percentage of the font size. */
  headingLetterSpacing?: number
  /** CTA button border color (stroke). */
  buttonBorderColor?: string
  /** CTA button border width in px (0 = no stroke). */
  buttonBorderWidth?: number
  /** Body font size in px. */
  fontSizeBase: number
  /** Body line-height multiplier. */
  fontLineHeight: number
  /** Body font weight (300–700). */
  fontWeight: number
  /** Body letter spacing as a percentage of the font size (Figma-style). */
  letterSpacing: number
  /** Base text alignment for flowing content. */
  textAlign: TextAlign
  cornerRadius: number
  tone: TonePreset
}

/** Frame element visibility — set once at the experience level. Nav bar is always on. */
export interface FrameVisibility {
  logo: boolean
  exitX: boolean
  progress: boolean
  title: boolean
  description: boolean
}

/** How the whole experience is presented to the subscriber. */
export type ShellLayout = 'modal' | 'fullpage' | 'fullpage_scroll'

export interface Experience {
  /** Stable id — referenced by flow nodes in orchestration. */
  id: string
  /** Merchant-facing label shown on the canvas enclosure. */
  name: string
  blueprint: BlueprintId
  /** 'modal' = floating dialog; 'fullpage' = hosted full-page experience. */
  shell: ShellLayout
  branding: Branding
  frame: FrameVisibility
  steps: Step[]
}

// ---------------------------------------------------------------------------
// Guardrail constants
// ---------------------------------------------------------------------------

export const MAX_STEPS = 6
export const COMPONENT_CAPS: Record<'loss_aversion' | 'offer' | 'survey', number> = {
  loss_aversion: 2,
  // Interchangeable, reason-routed save offers — up to one per survey reason.
  // They occupy a single logical step (the subscriber only ever sees one).
  offer: 5,
  survey: 1,
}
export const SURVEY_MIN_OPTIONS = 3
export const SURVEY_MAX_OPTIONS = 5
/** Max benefits per feature-list section (keep / lose) — cognitive-overload cap. */
export const LA_MAX_ITEMS = 3

/** Canonical reason codes for analytics (ReasonForLeaving). */
export const REASON_CODES = [
  'price',
  'not_using',
  'taking_break',
  'missing_features',
  'switching_competitor',
  'technical_issues',
  'too_complex',
  'other',
] as const
export type ReasonCode = (typeof REASON_CODES)[number]
