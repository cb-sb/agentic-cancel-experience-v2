import type { JourneyFile, JourneyStepFile, OfferKey } from '../journey/types'
import type { SharedCard, SharedOffer } from '../library/types'
import { makeLossAversion, makeSurvey } from '../lib/factories'
import { offerVariantPatch } from '../lib/offerVariants'
import type { SurveyReasonBind, TemplateManifest } from './types'

export type ReasonOrder = 'random' | 'listed'
export type OfferStrategy = 'page' | 'reason'
export type QuestionBlock = 'reasons' | 'competitors' | 'return' | 'feedback'
export type CompetitorOrder = 'list' | 'random'

export interface ManifestReason {
  id: string
  label: string
  selected: boolean
  shared: boolean
  feedbackEnabled: boolean
  offerId: string | null
  active: boolean
}

export interface CompetitorOption {
  id: string
  label: string
}

export interface SurveyConfiguration {
  reasonsEnabled: boolean
  reasonRequired: boolean
  label: string
  order: ReasonOrder
  offerStrategy: OfferStrategy
  pageOfferId: string | null
  reasons: ManifestReason[]
  sectionOrder: QuestionBlock[]
  competitors: {
    enabled: boolean
    required: boolean
    freeform: boolean
    label: string
    options: CompetitorOption[]
    order: CompetitorOrder
    inputPlaceholder: string
    otherPlaceholder: string
  }
  returnLikelihood: {
    enabled: boolean
    required: boolean
    label: string
    lowText: string
    highText: string
    scale: number
  }
  feedback: {
    enabled: boolean
    required: boolean
    label: string
    placeholder: string
  }
}

export interface LossStat {
  id: string
  label: string
  value: string
  enabled: boolean
}

export interface LossCard {
  id: string
  shared: boolean
  name: string
  title: string
  keep: string[]
  lose: string[]
  stats: LossStat[]
}

export interface LossAversionConfiguration {
  enabled: boolean
  selectedId: string | null
  cards: LossCard[]
}

export type OfferProcessing = 'url' | 'email' | 'billing' | 'webhook'
export type OfferLayout = 'regular' | 'horizontal'
export type BrandScope = 'this_brand' | 'all_brands'
export type MaxRedemptions = 'unlimited' | '1' | '2' | '3' | '4' | '5'
export type OfferKind =
  | 'discount'
  | 'pause_skip'
  | 'extension'
  | 'subscription_change'
  | 'support'
  | 'feedback'
  | 'gifts'
  | 'one_time'
  | 'cancel_nevermind'
  | 'multi_offer'
  | 'multi_action'
export type SimpleOfferKind = Exclude<OfferKind, 'multi_offer' | 'multi_action'>
export type DiscountBasis = 'percent' | 'amount' | 'quantity'
export type PauseMode = 'indefinite' | 'skip_cycles' | 'custom'

export interface OfferAction {
  kind: SimpleOfferKind
  processing: OfferProcessing
  discountBasis: DiscountBasis | ''
  pauseMode: PauseMode | ''
  duration: string
  interval: string
  subcategory: string
  addDiscount: boolean
  addedDiscountBasis: DiscountBasis | ''
}

export interface OfferButton {
  action: OfferAction
  successAction: 'link' | 'nevermind'
  destinationUrl: string
  buttonLabel: string
}

export interface ManifestOffer {
  id: string
  /** Library-backed offer; shown with the Shared badge in pickers. */
  shared?: boolean
  name: string
  variantLabel: string
  layout: OfferLayout
  headline: string
  body: string
  brandScope: BrandScope
  kind: OfferKind
  cardName: string
  offerName: string
  maxRedemptions: MaxRedemptions
  buttons: OfferButton[]
  secondAction?: OfferAction
}

export interface ManifestSettings {
  survey: SurveyConfiguration
  lossAversion: LossAversionConfiguration
  offers: ManifestOffer[]
}

export const QUESTION_LABELS: Record<QuestionBlock, string> = {
  reasons: 'Survey questions',
  competitors: 'Competitors',
  return: 'Return likelihood',
  feedback: 'Feedback',
}

export const OFFER_KIND_LABELS: Record<OfferKind, string> = {
  discount: 'Discount',
  pause_skip: 'Pause | Skip',
  extension: 'Extension',
  subscription_change: 'Subscription change',
  support: 'Support & training',
  feedback: 'Customer feedback',
  gifts: 'Gifts & credits',
  one_time: 'One time charge',
  cancel_nevermind: 'Cancel | Nevermind',
  multi_offer: 'Multi-offer',
  multi_action: 'Multi-action',
}

export const PROCESSING_LABELS: Record<OfferProcessing, string> = {
  url: 'Url redirect',
  email: 'Email',
  billing: 'Billing integration',
  webhook: 'Webhook',
}

const SUBCATEGORY_KINDS = new Set<SimpleOfferKind>(['subscription_change', 'support', 'feedback', 'gifts'])

export function actionNeedsSubcategory(kind: SimpleOfferKind): boolean {
  return SUBCATEGORY_KINDS.has(kind)
}

export function actionNeedsDuration(action: OfferAction): boolean {
  if (action.kind === 'extension') return true
  return action.kind === 'pause_skip' && action.pauseMode !== '' && action.pauseMode !== 'indefinite'
}

export function offerGaps(offer: ManifestOffer): string[] {
  const gaps: string[] = []
  offer.buttons.forEach((button, index) => {
    const name = offer.kind === 'multi_offer' ? `Button ${index + 1}` : 'Button'
    gaps.push(...actionGaps(button.action, name))
    if (!button.destinationUrl.trim()) gaps.push(`${name} destination URL`)
  })
  if (offer.kind === 'multi_action' && offer.secondAction) {
    gaps.push(...actionGaps(offer.secondAction, 'Button action 2'))
  }
  return gaps
}

function actionGaps(action: OfferAction, name: string): string[] {
  const gaps: string[] = []
  if (action.kind === 'discount' && !action.discountBasis) gaps.push(`${name} discount option`)
  if (action.kind === 'pause_skip' && !action.pauseMode) gaps.push(`${name} pause action`)
  if (actionNeedsDuration(action) && !action.duration.trim()) gaps.push(`${name} duration`)
  if (actionNeedsSubcategory(action.kind) && !action.subcategory.trim()) gaps.push(`${name} subcategory`)
  if (action.addDiscount && !action.addedDiscountBasis) gaps.push(`${name} added discount`)
  return gaps
}

function reason(id: string, label: string, selected: boolean, feedbackEnabled = false): ManifestReason {
  return { id, label, selected, shared: true, feedbackEnabled, offerId: null, active: false }
}

function stat(id: string, label: string, value: string): LossStat {
  return { id, label, value, enabled: true }
}

export function offerAction(kind: SimpleOfferKind, patch: Partial<OfferAction> = {}): OfferAction {
  return {
    kind,
    processing: 'url',
    discountBasis: '',
    pauseMode: '',
    duration: '',
    interval: '',
    subcategory: '',
    addDiscount: false,
    addedDiscountBasis: '',
    ...patch,
  }
}

function button(kind: SimpleOfferKind, label: string, patch: Partial<OfferAction> = {}): OfferButton {
  return {
    action: offerAction(kind, patch),
    successAction: kind === 'cancel_nevermind' ? 'nevermind' : 'link',
    destinationUrl: '',
    buttonLabel: label,
  }
}

export function blankOffer(kind: OfferKind, index: number): ManifestOffer {
  const simple: SimpleOfferKind = kind === 'multi_offer' || kind === 'multi_action' ? 'discount' : kind
  const buttons =
    kind === 'multi_offer'
      ? [button('discount', 'Accept offer'), button('pause_skip', 'Pause instead')]
      : [button(simple, simple === 'cancel_nevermind' ? 'Nevermind' : 'Accept offer')]
  return {
    id: `offer_${kind}_${index}`,
    name: `${OFFER_KIND_LABELS[kind]} (1)`,
    variantLabel: 'Default',
    layout: 'regular',
    headline: 'Stay with us',
    body: '',
    brandScope: 'this_brand',
    kind,
    cardName: `${OFFER_KIND_LABELS[kind]} card`,
    offerName: OFFER_KIND_LABELS[kind],
    maxRedemptions: 'unlimited',
    buttons,
    secondAction: kind === 'multi_action' ? offerAction('pause_skip') : undefined,
  }
}

function blankSurvey(reasons: ManifestReason[]): SurveyConfiguration {
  return {
    reasonsEnabled: true,
    reasonRequired: true,
    label: 'Please share your reason for leaving',
    order: 'random',
    offerStrategy: 'reason',
    pageOfferId: null,
    reasons,
    sectionOrder: ['reasons', 'competitors', 'return', 'feedback'],
    competitors: {
      enabled: true,
      required: true,
      freeform: false,
      label: 'Which other solution will you use now?',
      options: [
        { id: 'cmp_none', label: 'None' },
        { id: 'cmp_other', label: 'Other' },
      ],
      order: 'list',
      inputPlaceholder: 'Choose one',
      otherPlaceholder: 'Start typing...',
    },
    returnLikelihood: {
      enabled: true,
      required: true,
      label: 'How likely are you to return?',
      lowText: 'No chance!',
      highText: 'Absolutely will!',
      scale: 10,
    },
    feedback: {
      enabled: true,
      required: false,
      label: "Anything else you'd like to share about your experience?",
      placeholder: 'Start typing...',
    },
  }
}

function blankLoss(present: boolean): LossAversionConfiguration {
  return {
    enabled: present,
    selectedId: present ? 'card_lose' : null,
    cards: present
      ? [
          {
            id: 'card_lose',
            shared: false,
            name: 'What you lose',
            title: 'Before you go',
            keep: [],
            lose: [],
            stats: [
              stat('stat_saved_revenue', 'Saved Revenue', ''),
              stat('stat_risk', 'Revenue at Risk', ''),
              stat('stat_saved_customers', 'Saved Customers', ''),
              stat('stat_sessions', 'Monthly Sessions', ''),
            ],
          },
        ]
      : [],
  }
}

function manifestOfferKind(key: OfferKey | undefined): OfferKind {
  if (key === 'pause' || key === 'skip') return 'pause_skip'
  if (key === 'extension') return 'extension'
  if (key === 'plan_change') return 'subscription_change'
  if (key === 'addon') return 'gifts'
  return 'discount'
}

function journeyOffer(step: JourneyStepFile, index: number, offers: SharedOffer[]): ManifestOffer {
  const key = step.offer ?? 'discount'
  const variant = offerVariantPatch(key)
  const shared = step.sharedOfferId ? offers.find((item) => item.id === step.sharedOfferId) : undefined
  const offer = blankOffer(manifestOfferKind(key), index)
  const button = offer.buttons[0]
  offer.id = `offer_${step.id}`
  offer.shared = Boolean(shared)
  offer.name = shared?.name ?? offer.name
  offer.headline = shared?.title || step.headline || variant.title || offer.headline
  offer.body = shared?.description || step.body || variant.description || ''
  offer.cardName = shared?.name ?? offer.cardName
  offer.offerName = shared?.name ?? offer.offerName
  if (button) {
    offer.buttons = [
      {
        ...button,
        buttonLabel: shared?.primaryCta || step.content?.offerCta || variant.primaryCta || button.buttonLabel,
        action: {
          ...button.action,
          processing: 'billing',
          discountBasis: key === 'discount' ? 'percent' : button.action.discountBasis,
          pauseMode: key === 'skip' ? 'skip_cycles' : key === 'pause' ? 'indefinite' : button.action.pauseMode,
        },
      },
    ]
  }
  return offer
}

/** The MVP configuration, filled from the screens this experience already has. */
export function settingsFromJourney(file: JourneyFile, library: { offers: SharedOffer[]; cards: SharedCard[] } = { offers: [], cards: [] }): ManifestSettings {
  const lossStep = file.steps.find((step) => step.kind === 'loss_aversion')
  const surveyStep = file.steps.find((step) => step.kind === 'survey')
  const loss = blankLoss(Boolean(lossStep))
  if (lossStep && loss.cards[0]) {
    const defaults = makeLossAversion()
    const shared = lossStep.sharedCardId ? library.cards.find((item) => item.id === lossStep.sharedCardId) : undefined
    const stats = lossStep.content?.stats ?? defaults.stats ?? []
    loss.cards[0] = {
      ...loss.cards[0],
      shared: Boolean(shared),
      name: shared?.name || loss.cards[0].name,
      title: shared?.title || lossStep.headline || 'Before you go',
      keep: shared?.keepItems?.length ? shared.keepItems : lossStep.content?.keepItems ?? (defaults.keepItems ?? []).map((item) => item.label),
      lose: shared?.loseItems?.length ? shared.loseItems : lossStep.content?.loseItems ?? (defaults.loseItems ?? []).map((item) => item.label),
      stats: stats.map((row) => ({ id: row.id, label: row.label, value: row.value, enabled: true })),
    }
  }
  const details = surveyStep?.content?.surveyDetails
  const labels = surveyStep?.content?.surveyReasons?.map((label) => label.trim()).filter(Boolean)
  const reasons: ManifestReason[] = details?.length
    ? details.map((row) => ({
        id: row.id,
        label: row.label,
        selected: true,
        shared: false,
        feedbackEnabled: Boolean(row.feedback),
        offerId: row.linkedOfferId ?? null,
        active: Boolean(row.linkedOfferId),
      }))
    : labels?.length
      ? labels.map((label, index) => ({ id: `reason_${index}`, label, selected: true, shared: false, feedbackEnabled: false, offerId: null, active: false }))
      : file.manifest?.surveyReasons?.length
        ? file.manifest.surveyReasons.map((row) => ({ id: row.id, label: row.label, selected: true, shared: false, feedbackEnabled: false, offerId: null, active: false }))
        : surveyStep
          ? makeSurvey().options.map((option) => ({ id: option.id, label: option.label, selected: true, shared: false, feedbackEnabled: false, offerId: null, active: false }))
          : []
  const survey = blankSurvey(reasons)
  if (!surveyStep) survey.reasonsEnabled = false
  else {
    survey.label = surveyStep.headline || 'Why are you cancelling?'
    survey.order = surveyStep.content?.surveyRandomize ? 'random' : 'listed'
  }
  return {
    survey,
    lossAversion: loss,
    offers: file.steps.filter((step) => step.kind === 'offer').map((step, index) => journeyOffer(step, index, library.offers)),
  }
}

export function settingsForManifest(manifest: TemplateManifest): ManifestSettings {
  if (manifest.settings) return manifest.settings
  const hasSurvey = manifest.steps.some((step) => step.kind === 'survey')
  const hasLoss = manifest.steps.some((step) => step.kind === 'loss_aversion')
  const hasOffer = manifest.steps.some((step) => step.kind === 'offer')
  const reasons = hasSurvey ? (manifest.surveyReasons ?? []).map((row) => reason(row.id, row.label, true)) : []
  return {
    survey: blankSurvey(reasons.length > 0 ? reasons : hasSurvey ? [reason('r_other', 'None of the above', true, true)] : []),
    lossAversion: blankLoss(hasLoss),
    offers: hasOffer ? [blankOffer('discount', 1)] : [],
  }
}

/** The screenshot configuration the demo upload asks the merchant to review. */
export function demoSettings(): ManifestSettings {
  const discount = blankOffer('discount', 1)
  discount.id = 'offer_loyalty'
  discount.shared = true
  discount.name = '50% Loyalty Discount v4 (1)'
  discount.headline = 'Chat with a Growth Expert'
  discount.body = 'Get a personalized plan to grow your business.'
  discount.cardName = 'Loyalty discount'
  discount.offerName = '50% Loyalty Discount v4'
  discount.buttons = [
    {
      ...button('discount', 'Apply x% Discount', { discountBasis: 'percent' }),
      destinationUrl: 'https://example.com/stay',
    },
  ]
  const pause = blankOffer('pause_skip', 2)
  pause.id = 'offer_pause'
  pause.name = 'Pause | Skip (1)'
  pause.headline = 'Take a break instead'
  pause.buttons = [button('pause_skip', 'Pause subscription')]
  return {
    survey: {
      ...blankSurvey([
        reason('r_device', "Couldn't get it working on my device", false),
        reason('r_missing_1', 'Missing content or not enough content', false),
        reason('r_missing_2', 'Missing content or not enough content', false),
        reason('r_too_much', 'I have too much product', true),
        reason('r_issues', 'Issues w/ Product', true),
        reason('r_usage_1', 'Not using it enough', false),
        reason('r_usage_2', 'Not using it enough', false),
        reason('r_economy', 'Global economic reasons', true),
        reason('r_break', "I'm just taking a break, will be back", true),
        reason('r_price', 'Too expensive for value provided', true),
        reason('r_none', 'None of the above', true, true),
      ]),
      pageOfferId: 'offer_loyalty',
    },
    lossAversion: {
      enabled: true,
      selectedId: 'card_lose',
      cards: [
        {
          id: 'card_lose',
          shared: true,
          name: "What You'll Lose Card",
          title: "Hey, we're sorry to see you go!",
          keep: ['Revenue Dash', 'Trends Reports'],
          lose: ['Saved reporting history'],
          stats: [
            stat('stat_saved_revenue', 'Saved Revenue', '550K'),
            stat('stat_risk', 'Revenue at Risk', '50K'),
            stat('stat_saved_customers', 'Saved Customers', '2500'),
            stat('stat_sessions', 'Monthly Sessions', '5000'),
          ],
        },
      ],
    },
    offers: [discount, pause],
  }
}

export function reasonBinds(settings: ManifestSettings): SurveyReasonBind[] {
  return settings.survey.reasons.filter((row) => row.selected).map((row) => ({ id: row.id, label: row.label }))
}

export function offerKeyFor(offer: ManifestOffer | undefined): OfferKey | undefined {
  const kind = offer?.kind === 'multi_action' ? offer.secondAction?.kind : offer?.buttons[0]?.action.kind
  if (kind === 'discount') return 'discount'
  if (kind === 'extension') return 'extension'
  if (kind === 'subscription_change') return 'plan_change'
  if (kind === 'pause_skip') return offer?.buttons[0]?.action.pauseMode === 'skip_cycles' ? 'skip' : 'pause'
  return undefined
}

export function cloneLossCard(card: LossCard): LossCard {
  return {
    ...card,
    id: `${card.id}_local`,
    shared: false,
    name: `${card.name} copy`,
    keep: [...card.keep],
    lose: [...card.lose],
    stats: card.stats.map((row) => ({ ...row })),
  }
}
