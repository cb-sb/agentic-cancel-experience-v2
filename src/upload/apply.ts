import { EMPTY_JOURNEY, type JourneyFile, type JourneyStepFile, type OfferKey } from '../journey/types'
import { toStepChrome } from '../library/extract'
import type { MerchantComponent } from '../library/types'
import { isOfferBind, type ManifestStep, type TemplateArtifact, type TemplateManifest } from './types'

function headlineFor(step: ManifestStep): string {
  switch (step.kind) {
    case 'loss_aversion':
      return 'Before you go'
    case 'survey':
      return 'Why are you cancelling?'
    case 'offer':
      return 'A different path'
    case 'confirmation':
      return 'Are you sure you want to cancel?'
    case 'outcome_saved':
      return 'Your plan is staying active'
    case 'outcome_cancelled':
      return 'Your plan has been cancelled'
    default:
      return step.id
  }
}

function offerOf(step: ManifestStep): OfferKey | undefined {
  const bind = step.slots.find((s) => s.type === 'offer' && s.bind)?.bind
  return bind && isOfferBind(bind) ? bind : step.kind === 'offer' ? 'discount' : undefined
}

export function stepsFromManifest(
  manifest: TemplateManifest,
  components?: MerchantComponent[],
): JourneyStepFile[] {
  return manifest.steps.map((s, i) => {
    const match =
      components?.find((c) => c.sourceStepId === s.id) ??
      components?.find((c) => c.kind === s.kind && !manifest.steps.slice(0, i).some((prev) => prev.kind === s.kind)) ??
      components?.[i]
    const step: JourneyStepFile = {
      id: s.id,
      kind: s.kind,
      live: true,
      headline: headlineFor(s),
      offer: offerOf(s),
    }
    return match ? { ...step, chrome: toStepChrome(match) } : step
  })
}

export function journeyFromUpload(
  base: JourneyFile,
  artifact: TemplateArtifact,
  manifest: TemplateManifest,
  components?: MerchantComponent[],
): JourneyFile {
  const confirmed: TemplateManifest = { ...manifest, confirmed: true }
  const name = !base.name || base.name === EMPTY_JOURNEY.name ? 'Uploaded template' : base.name
  const acquire =
    confirmed.steps.some((s) => s.kind === 'pricing_table') &&
    !confirmed.steps.some((s) => s.kind === 'confirmation')
  return {
    ...base,
    source: 'uploaded',
    name,
    kind: acquire ? 'acquisition' : 'cancel',
    shell: 'fullpage',
    artifact,
    manifest: confirmed,
    steps: stepsFromManifest(confirmed, components),
  }
}
