import { EMPTY_JOURNEY, type JourneyFile, type JourneyStepFile, type OfferKey } from '../journey/types'
import { toStepChrome } from '../library/extract'
import type { MerchantComponent } from '../library/types'
import { offerKeyFor, type ManifestSettings } from './manifestSettings'
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

/** Copy reviewed settings onto the page steps. Shared library records stay untouched. */
export function stepsWithSettings(steps: JourneyStepFile[], settings: ManifestSettings | undefined): JourneyStepFile[] {
  if (!settings) return steps
  const selected = settings.survey.reasons.filter((row) => row.selected)
  const card = settings.lossAversion.enabled
    ? settings.lossAversion.cards.find((item) => item.id === settings.lossAversion.selectedId)
    : undefined
  const offer = settings.offers[0]
  return steps.map((step) => {
    if (step.kind === 'survey') {
      const pageOffer = settings.survey.offerStrategy === 'page'
      return {
        ...step,
        sharedCardId: undefined,
        headline: settings.survey.label || step.headline,
        content: {
          ...step.content,
          surveyPrompt: settings.survey.label,
          surveyReasons: selected.map((row) => row.label),
          surveyDetails: selected.map((row) => ({
            id: row.id,
            label: row.label,
            linkedOfferId: pageOffer ? settings.survey.pageOfferId : row.offerId,
            feedback: row.feedbackEnabled,
          })),
          surveyRandomize: settings.survey.order === 'random',
        },
      }
    }
    if (step.kind === 'loss_aversion') {
      if (!card) return { ...step, sharedCardId: undefined }
      return {
        ...step,
        sharedCardId: undefined,
        headline: card.title || step.headline,
        content: {
          ...step.content,
          keepItems: [...card.keep],
          loseItems: [...card.lose],
          stats: card.stats.filter((row) => row.enabled).map((row) => ({ id: row.id, value: row.value, label: row.label })),
        },
      }
    }
    if (step.kind === 'offer' && offer) {
      return {
        ...step,
        sharedOfferId: undefined,
        headline: offer.headline,
        body: offer.body,
        offer: offerKeyFor(offer) ?? step.offer,
        content: { ...step.content, offerCta: offer.buttons[0]?.buttonLabel },
      }
    }
    return step
  })
}

export function journeyFromUpload(
  base: JourneyFile,
  artifact: TemplateArtifact,
  manifest: TemplateManifest,
  components?: MerchantComponent[],
): JourneyFile {
  const confirmed: TemplateManifest = { ...manifest, confirmed: manifest.confirmed !== false }
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
    steps: stepsWithSettings(stepsFromManifest(confirmed, components), confirmed.settings),
  }
}
