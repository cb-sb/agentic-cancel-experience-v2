import type { OfferCategory, OfferComponent } from '../types/experience'

/**
 * Offer variants — each is a distinct *type* of save offer with its own default
 * copy. Switching a variant re-templates the card (eyebrow / title / description
 * / CTA / fulfillment) so the merchant can see the offer change type, mirroring
 * the loss-aversion card's variant switch.
 */
export interface OfferVariantDef {
  category: OfferCategory
  label: string
  eyebrow: string
  title: string
  description: string
  primaryCta: string
  fulfillment: OfferComponent['fulfillment']
}

export const OFFER_VARIANTS: OfferVariantDef[] = [
  {
    category: 'discount',
    label: 'Discount',
    eyebrow: 'EXCLUSIVE DISCOUNT',
    title: '50% off for 3 months',
    description:
      'Same plan, half the price for your next three billing cycles. It simply resumes at your normal rate after.',
    primaryCta: 'Claim 50% discount',
    fulfillment: 'billing',
  },
  {
    category: 'pause',
    label: 'Pause',
    eyebrow: 'TAKE A BREAK',
    title: 'Pause instead of cancelling',
    description:
      'Freeze your plan for up to 3 months. Come back whenever you like — your data and settings stay exactly as you left them.',
    primaryCta: 'Pause my subscription',
    fulfillment: 'billing',
  },
  {
    category: 'plan_change',
    label: 'Plan change',
    eyebrow: 'A LIGHTER PLAN',
    title: 'Switch to Starter — $12/mo',
    description:
      'Keep the essentials at a fraction of the price. Downgrade now and stop paying for the features you are not using.',
    primaryCta: 'Move to Starter',
    fulfillment: 'billing',
  },
  {
    category: 'extension',
    label: 'Extension',
    eyebrow: 'MORE TIME',
    title: 'Get 30 more days, on us',
    description: 'Extend your current plan by a month at no charge — no strings attached.',
    primaryCta: 'Add 30 free days',
    fulfillment: 'billing',
  },
  {
    category: 'skip',
    label: 'Skip a cycle',
    eyebrow: 'SKIP A PAYMENT',
    title: 'Skip your next payment',
    description: 'Take this billing cycle off. We’ll pick things back up automatically next month.',
    primaryCta: 'Skip next payment',
    fulfillment: 'billing',
  },
  {
    category: 'addon',
    label: 'Add-on',
    eyebrow: 'ON THE HOUSE',
    title: 'Free onboarding + priority support',
    description: 'Add white-glove onboarding and priority support to your plan free for 3 months.',
    primaryCta: 'Add it free',
    fulfillment: 'billing',
  },
]

const byCategory = new Map(OFFER_VARIANTS.map((v) => [v.category, v]))

/** Human label for an offer category (falls back to a title-cased code). */
export function offerVariantLabel(category: OfferCategory): string {
  return byCategory.get(category)?.label ?? category.replace(/_/g, ' ')
}

/** Patch re-templating an offer to a variant's default copy + category. */
export function offerVariantPatch(category: OfferCategory): Partial<OfferComponent> {
  const v = byCategory.get(category)
  if (!v) return { category }
  return {
    category: v.category,
    eyebrow: v.eyebrow,
    title: v.title,
    description: v.description,
    primaryCta: v.primaryCta,
    fulfillment: v.fulfillment,
  }
}
