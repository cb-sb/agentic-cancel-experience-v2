import type { LossAversionComponent } from '../types/experience'

/**
 * The four canonical loss-aversion templates. Media is baked into the template
 * (not a toggle) — selecting a variant swaps the card completely. A single step
 * may not carry two cards of the same variant.
 */
export type LAVariant = 'feature_media' | 'feature' | 'activity' | 'message_media'

export const LA_VARIANTS: { value: LAVariant; label: string }[] = [
  { value: 'feature_media', label: "What you lose vs What you've gained — with media" },
  { value: 'feature', label: "What you lose vs What you've gained — without media" },
  { value: 'activity', label: 'Account activity — without media' },
  { value: 'message_media', label: 'Messaging — with media' },
]

export function laVariantOf(component: LossAversionComponent): LAVariant {
  if (component.cardType === 'account_activity') return 'activity'
  if (component.cardType === 'message') return 'message_media'
  return component.media ? 'feature_media' : 'feature'
}

export function laVariantPatch(
  component: LossAversionComponent,
  variant: LAVariant,
): Partial<LossAversionComponent> {
  const keepMedia = component.media ?? { type: 'image' as const }
  switch (variant) {
    case 'feature_media':
      return { cardType: 'feature_list', media: keepMedia }
    case 'feature':
      return { cardType: 'feature_list', media: null }
    case 'activity':
      return { cardType: 'account_activity', media: null }
    case 'message_media':
      return { cardType: 'message', media: keepMedia }
  }
}

/** Pick a sensible variant for a newly-added card that complements what's
 * already on the step (benefits pairs with messaging/activity, and vice-versa).
 * Returns null when every variant is taken. */
export function complementaryVariant(used: Set<LAVariant>): LAVariant | null {
  const hasBenefits = used.has('feature') || used.has('feature_media')
  const order: LAVariant[] = hasBenefits
    ? ['message_media', 'activity', 'feature_media', 'feature']
    : ['feature', 'message_media', 'activity', 'feature_media']
  return order.find((v) => !used.has(v)) ?? null
}

/** Variants already used by loss-aversion cards in a step, excluding one id. */
export function usedLAVariants(
  components: { id: string; kind: string }[],
  exceptId?: string,
): Set<LAVariant> {
  const used = new Set<LAVariant>()
  for (const c of components) {
    if (c.kind === 'loss_aversion' && c.id !== exceptId) {
      used.add(laVariantOf(c as unknown as LossAversionComponent))
    }
  }
  return used
}
