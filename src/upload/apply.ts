import { EMPTY_JOURNEY, type JourneyFile, type JourneyStepFile, type OfferKey } from '../journey/types'
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

export function stepsFromManifest(manifest: TemplateManifest): JourneyStepFile[] {
  return manifest.steps.map((s) => ({
    id: s.id,
    kind: s.kind,
    live: true,
    headline: headlineFor(s),
    offer: offerOf(s),
  }))
}

export function journeyFromUpload(
  base: JourneyFile,
  artifact: TemplateArtifact,
  manifest: TemplateManifest,
): JourneyFile {
  const confirmed: TemplateManifest = { ...manifest, confirmed: true }
  const name = !base.name || base.name === EMPTY_JOURNEY.name ? 'Uploaded template' : base.name
  return {
    ...base,
    source: 'uploaded',
    name,
    shell: 'fullpage',
    artifact,
    manifest: confirmed,
    steps: stepsFromManifest(confirmed),
  }
}
