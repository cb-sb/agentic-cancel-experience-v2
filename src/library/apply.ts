import { EMPTY_JOURNEY, isTailKind, type JourneyFile, type JourneyStepFile } from '../journey/types'
import { uid } from '../lib/id'
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

function stepFromComponent(component: MerchantComponent): JourneyStepFile {
  return {
    id: uid('step'),
    kind: component.kind,
    live: true,
    headline: component.label,
    chrome: toStepChrome(component),
  }
}

function insertBeforeTail(steps: JourneyStepFile[], step: JourneyStepFile): JourneyStepFile[] {
  const tailAt = steps.findIndex((s) => isTailKind(s.kind))
  if (tailAt < 0) return [...steps, step]
  return [...steps.slice(0, tailAt), step, ...steps.slice(tailAt)]
}

function alreadyOn(steps: JourneyStepFile[], component: MerchantComponent): boolean {
  return steps.some((s) => s.chrome?.libraryComponentId === component.id)
}

function acquireKind(steps: JourneyStepFile[], fallback: JourneyFile['kind']): JourneyFile['kind'] {
  const pricing = steps.some((s) => s.kind === 'pricing_table' || s.kind === 'checkout')
  const confirm = steps.some((s) => s.kind === 'confirmation')
  if (pricing && !confirm) return 'acquisition'
  return fallback
}

/**
 * Paint empty matching steps, or insert a new live step before Confirm / outcomes.
 * Same chrome already on the file is skipped. Existing chrome is never overwritten.
 */
export function attachComponents(file: JourneyFile, components: MerchantComponent[]): JourneyFile {
  let steps = [...file.steps]
  let changed = false
  for (const component of components) {
    if (alreadyOn(steps, component)) continue
    const empty = steps.findIndex((s) => s.kind === component.kind && !s.chrome)
    if (empty >= 0) {
      steps = steps.map((s, i) =>
        i === empty ? { ...s, chrome: toStepChrome(component), live: true } : s,
      )
      changed = true
      continue
    }
    steps = insertBeforeTail(steps, stepFromComponent(component))
    changed = true
  }
  if (!changed) return file
  return {
    ...file,
    source: file.source === 'uploaded' ? 'uploaded' : 'authored',
    kind: acquireKind(steps, file.kind),
    steps,
  }
}

/** Attach saved chrome onto a matching step. Reuses the same libraryComponentId. */
export function attachComponent(file: JourneyFile, component: MerchantComponent): JourneyFile {
  return attachComponents(file, [component])
}

/** Blank canvas: live steps in pick order — not a prescribed Fair save wrap. */
export function startFromComponents(base: JourneyFile, components: MerchantComponent[]): JourneyFile {
  if (components.length === 0) return { ...EMPTY_JOURNEY, brand: base.brand }
  const steps = components.map((c) => stepFromComponent(c))
  const pack = packFromChrome(steps[0])
  return {
    ...EMPTY_JOURNEY,
    brand: base.brand,
    kind: acquireKind(steps, 'cancel'),
    source: 'uploaded',
    name: components.map((c) => c.label).join(' → '),
    template: 'none',
    artifact: pack?.artifact,
    manifest: pack?.manifest,
    steps,
  }
}

/** Blank canvas: a single live step of that kind — not a prescribed Fair save wrap. */
export function startFromComponent(base: JourneyFile, component: MerchantComponent): JourneyFile {
  return startFromComponents(base, [component])
}

export function matchingComponents(file: JourneyFile, components: MerchantComponent[]): MerchantComponent[] {
  const kinds = new Set(file.steps.map((s) => s.kind))
  return components.filter((c) => kinds.has(c.kind))
}
