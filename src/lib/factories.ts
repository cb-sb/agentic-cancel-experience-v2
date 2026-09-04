import { uid } from './id'
import type {
  CheckoutComponent,
  ConfirmationComponent,
  LossAversionComponent,
  OfferComponent,
  OutcomeComponent,
  PricingTableComponent,
  SurveyComponent,
  SurveyReasonOption,
} from '../types/experience'

/** Default "What you'll keep / What you'll lose" feature-list card. */
export function makeLossAversion(
  overrides: Partial<LossAversionComponent> = {},
): LossAversionComponent {
  return {
    id: uid('la'),
    kind: 'loss_aversion',
    cardType: 'feature_list',
    media: null,
    keepTitle: "What you'll keep",
    keepItems: [
      { id: uid('kp'), label: 'Unlimited projects & team seats' },
      { id: uid('kp'), label: 'Advanced analytics & reporting' },
      { id: uid('kp'), label: 'Priority support (avg. 2hr response)' },
    ],
    loseTitle: "What you'll lose",
    loseItems: [
      { id: uid('ls'), label: 'All saved dashboards and reports' },
      { id: uid('ls'), label: 'Team collaboration history' },
      { id: uid('ls'), label: 'Custom automation workflows' },
    ],
    statsTitle: "What you've accomplished",
    stats: [
      { id: uid('st'), value: '128', label: 'projects shipped' },
      { id: uid('st'), value: '3,400', label: 'credits used' },
      { id: uid('st'), value: '92 hrs', label: 'saved this year' },
    ],
    message:
      "You've built something real here. Before you go, take a moment — we'd genuinely hate to see all of it go dark.",
    ...overrides,
  }
}

export function defaultSurveyOptions(): SurveyReasonOption[] {
  return [
    { id: uid('rs'), label: "It's too expensive", code: 'price', followUp: null, linkedOfferId: null },
    { id: uid('rs'), label: 'Too complicated or hard to use', code: 'too_complex', followUp: null, linkedOfferId: null },
    { id: uid('rs'), label: 'Missing features or integrations', code: 'missing_features', followUp: null, linkedOfferId: null },
    { id: uid('rs'), label: "I'm not using it enough to justify the cost", code: 'not_using', followUp: null, linkedOfferId: null },
    { id: uid('rs'), label: 'Switching to a competitor', code: 'switching_competitor', followUp: null, linkedOfferId: null },
  ]
}

export function makeSurvey(overrides: Partial<SurveyComponent> = {}): SurveyComponent {
  return {
    id: uid('sv'),
    kind: 'survey',
    presentation: 'radio',
    randomize: false,
    options: defaultSurveyOptions(),
    freeTextPrompt: 'Tell us what led to this decision',
    ...overrides,
  }
}

export function makeOffer(overrides: Partial<OfferComponent> = {}): OfferComponent {
  return {
    id: uid('of'),
    kind: 'offer',
    category: 'discount',
    eyebrow: 'EXCLUSIVE DISCOUNT',
    title: '50% off for 3 months',
    description:
      'Same plan, half the price for your next three billing cycles. No action needed after — it simply resumes at your normal rate.',
    // Standalone offers carry media by default; pairing two offers strips it.
    media: { type: 'image' },
    mediaSide: 'right',
    primaryCta: 'Claim 50% discount',
    secondaryCta: 'No thanks, continue cancelling',
    downgradeLink: 'Or downgrade to a smaller plan instead',
    consentEnabled: false,
    fulfillment: 'billing',
    reasonLinked: false,
    billingEntity: { couponId: 'HALFOFF3' },
    ...overrides,
  }
}

export function makePricingTable(
  overrides: Partial<PricingTableComponent> = {},
): PricingTableComponent {
  return {
    id: uid('pt'),
    kind: 'pricing_table',
    fulfillment: 'checkout',
    plans: [
      {
        id: uid('pl'),
        name: 'Starter',
        price: '$12',
        cadence: '/mo',
        features: ['3 projects', '1 seat', 'Community support'],
        ctaLabel: 'Switch to Starter',
      },
      {
        id: uid('pl'),
        name: 'Growth',
        price: '$29',
        cadence: '/mo',
        features: ['Unlimited projects', '5 seats', 'Priority support'],
        highlighted: true,
        ctaLabel: 'Switch to Growth',
      },
    ],
    ...overrides,
  }
}

export function makeCheckout(overrides: Partial<CheckoutComponent> = {}): CheckoutComponent {
  return {
    id: uid('ck'),
    kind: 'checkout',
    title: 'Complete your change',
    subtitle: "You won't be charged extra — this updates the subscription.",
    ...overrides,
  }
}

export function makeConfirmation(
  overrides: Partial<ConfirmationComponent> = {},
): ConfirmationComponent {
  return {
    id: uid('cf'),
    kind: 'confirmation',
    variant: 'simple',
    title: 'Are you sure you want to cancel?',
    subtitle:
      "Your subscription will end on March 15, 2026. You'll lose access to all Pro features immediately after.",
    consentText: 'I understand I will lose access to all Pro features.',
    confirmKeyword: 'CANCEL',
    endDateLabel: 'March 15, 2026',
    impact: [
      { id: uid('im'), label: 'You lose 340 remaining credits', severity: 'amber' },
      { id: uid('im'), label: 'Saved dashboards become read-only', severity: 'amber' },
      { id: uid('im'), label: 'SSO connection is disabled immediately', severity: 'red' },
    ],
    keepCta: 'Keep my subscription',
    cancelCta: 'Yes, cancel my subscription',
    ...overrides,
  }
}

export function makeOutcome(overrides: Partial<OutcomeComponent> = {}): OutcomeComponent {
  return {
    id: uid('oc'),
    kind: 'outcome',
    variant: 'reactivation',
    forResult: 'cancelled',
    headline: 'Your plan has been cancelled',
    body: 'You have access until March 15, 2026. We saved your data for 30 days in case you change your mind.',
    undoCta: 'Undo — restore my plan',
    feedbackPrompt: 'Anything we could have done better? (optional)',
    ...overrides,
  }
}

/** The other terminal: reached by taking an offer, or by keeping the plan. */
export function makeSavedOutcome(overrides: Partial<OutcomeComponent> = {}): OutcomeComponent {
  return makeOutcome({
    variant: 'success',
    forResult: 'saved',
    headline: 'Great — your plan is staying active',
    body: 'We applied your offer. Nothing else changes and you keep everything you had.',
    // Nothing to undo on this side of the fork.
    undoCta: undefined,
    ...overrides,
  })
}
