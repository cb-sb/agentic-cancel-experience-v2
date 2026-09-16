import { EMPTY_JOURNEY, type JourneyFile } from '../journey/types'
import { startFromTemplate, withLive } from '../journey/templates'
import { journeyFromUpload } from '../upload/apply'
import type { MerchantComponent, MerchantTemplate } from './types'
import { toStepChrome } from './extract'

/** Whole saved pack → hosted uploaded journey. Copilot still fills brand/targeting. */
export function applyMerchantJourney(base: JourneyFile, saved: MerchantTemplate): JourneyFile {
  const next = journeyFromUpload(base, saved.artifact, saved.manifest)
  return { ...next, name: saved.name }
}

/**
 * Attach saved chrome onto a matching Chargebee posture step.
 * Components never become a play on their own — they compile into a template.
 */
export function attachComponent(file: JourneyFile, component: MerchantComponent): JourneyFile {
  const idx = file.steps.findIndex((s) => s.kind === component.kind && !s.chrome)
  const at = idx >= 0 ? idx : file.steps.findIndex((s) => s.kind === component.kind)
  if (at < 0) return file
  const chrome = toStepChrome(component)
  return {
    ...file,
    source: file.source === 'uploaded' ? 'uploaded' : 'authored',
    steps: file.steps.map((s, i) => (i === at ? { ...s, chrome, live: true } : s)),
  }
}

/** No chain yet: land Fair save (or acquire if the primitive is checkout/pricing), then attach. */
export function startFromComponent(base: JourneyFile, component: MerchantComponent): JourneyFile {
  const acquire = component.kind === 'pricing_table' || component.kind === 'checkout'
  const next = startFromTemplate(
    { ...EMPTY_JOURNEY, brand: base.brand },
    acquire ? 'acquire_2' : 'cancel_4',
  )
  return attachComponent({ ...next, steps: withLive(next.steps, true) }, component)
}

export function matchingComponents(file: JourneyFile, components: MerchantComponent[]): MerchantComponent[] {
  const kinds = new Set(file.steps.map((s) => s.kind))
  return components.filter((c) => kinds.has(c.kind))
}
