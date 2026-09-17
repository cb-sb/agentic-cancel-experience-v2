import { EMPTY_JOURNEY, type JourneyFile, type JourneyStepFile } from '../journey/types'
import { journeyFromUpload } from '../upload/apply'
import type { MerchantComponent, MerchantTemplate } from './types'
import { packFromChrome, toStepChrome } from './extract'

function componentsFor(saved: MerchantTemplate, catalog?: MerchantComponent[]): MerchantComponent[] {
  if (catalog?.length && saved.componentIds?.length) {
    return saved.componentIds
      .map((id) => catalog.find((c) => c.id === id))
      .filter((c): c is MerchantComponent => c != null)
  }
  return saved.components ?? []
}

/** Whole saved pack → hosted uploaded journey. Copilot still fills brand/targeting. */
export function applyMerchantJourney(
  base: JourneyFile,
  saved: MerchantTemplate,
  catalog?: MerchantComponent[],
): JourneyFile {
  const next = journeyFromUpload(base, saved.artifact, saved.manifest, componentsFor(saved, catalog))
  return { ...next, name: saved.name }
}

/**
 * Attach saved chrome onto a matching step. Reuses the same libraryComponentId.
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

/** Blank canvas: a single live step of that kind — not a prescribed Fair save wrap. */
export function startFromComponent(base: JourneyFile, component: MerchantComponent): JourneyFile {
  const acquire = component.kind === 'pricing_table' || component.kind === 'checkout'
  const step: JourneyStepFile = {
    id: component.sourceStepId || component.kind,
    kind: component.kind,
    live: true,
    headline: component.label,
    chrome: toStepChrome(component),
  }
  const pack = packFromChrome(step)
  return {
    ...EMPTY_JOURNEY,
    brand: base.brand,
    kind: acquire ? 'acquisition' : 'cancel',
    source: 'uploaded',
    name: component.label,
    template: 'none',
    artifact: pack?.artifact,
    manifest: pack?.manifest,
    steps: [step],
  }
}

export function matchingComponents(file: JourneyFile, components: MerchantComponent[]): MerchantComponent[] {
  const kinds = new Set(file.steps.map((s) => s.kind))
  return components.filter((c) => kinds.has(c.kind))
}
