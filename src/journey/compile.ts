import { compileBrand } from '../brand/theme'
import { DEFAULT_FRAME } from '../lib/blueprints'
import {
  makeCheckout,
  makeConfirmation,
  makeLossAversion,
  makeOffer,
  makeOutcome,
  makePricingTable,
  makeSavedOutcome,
  makeSurvey,
} from '../lib/factories'
import { offerVariantPatch } from '../lib/offerVariants'
import { uid } from '../lib/id'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { AUDIENCE_LIBRARY, conditionExpression, type Audience, type Play } from '../types/orchestration'
import type { BlueprintId, Experience, Step } from '../types/experience'
import type { JourneyFile, JourneyStepFile, OfferKey } from './types'

const TEMPLATE_BLUEPRINT: Record<JourneyFile['template'], BlueprintId> = {
  none: 'balanced',
  cancel_1: 'click_to_cancel',
  cancel_2: 'clean_exit_1',
  cancel_3: 'clean_exit_2',
  cancel_4: 'balanced',
  cancel_5: 'save_aggressive',
  cancel_plan_change: 'balanced',
  acquire_2: 'clean_exit_1',
}

function offerPatch(key: OfferKey | undefined) {
  return offerVariantPatch(key ?? 'discount')
}

function slugCode(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'reason'
}

/** Merge edited bullet labels onto factory items, keeping ids/metadata by index. */
function mergeLabeled<T extends { id: string; label: string }>(
  base: T[],
  labels: string[] | undefined,
  makeId: () => string,
): T[] {
  if (!labels) return base
  return labels
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, i) => (base[i] ? { ...base[i], label } : ({ id: makeId(), label } as T)))
}

function compileStep(s: JourneyStepFile): Step {
  const ghost = s.live === false
  const id = s.id
  const cid = `c:${id}`
  const base = { id, layout: 'single' as const, disabled: ghost }

  switch (s.kind) {
    case 'loss_aversion': {
      const la = makeLossAversion({ id: cid })
      return {
        ...base,
        stage: 'value_reinforcement',
        title: s.headline ?? 'Before you go',
        description: s.body ?? '',
        components: [
          {
            ...la,
            keepItems: mergeLabeled(la.keepItems ?? [], s.content?.keepItems, () => uid('kp')),
            loseItems: mergeLabeled(la.loseItems ?? [], s.content?.loseItems, () => uid('ls')),
          },
        ],
      }
    }
    case 'survey': {
      const sv = makeSurvey({ id: cid })
      const reasons = s.content?.surveyReasons
      const options = reasons
        ? reasons
            .map((label) => label.trim())
            .filter(Boolean)
            .map((label, i) =>
              sv.options[i]
                ? { ...sv.options[i], label }
                : { id: uid('rs'), label, code: slugCode(label), followUp: null, linkedOfferId: null },
            )
        : sv.options
      return {
        ...base,
        stage: 'route_detection',
        title: s.headline ?? 'Why are you cancelling?',
        description: s.body ?? 'Your feedback shapes what we build next.',
        components: [
          {
            ...sv,
            options,
            ...(s.content?.surveyPrompt ? { freeTextPrompt: s.content.surveyPrompt } : {}),
          },
        ],
      }
    }
    case 'offer':
      return {
        ...base,
        stage: s.id === 'entry' ? 'entry_offer' : 'save_mechanic',
        title: '',
        description: '',
        components: [
          makeOffer({
            id: cid,
            reasonLinked: s.id !== 'entry',
            media: { type: 'image' },
            ...offerPatch(s.offer),
            ...(s.headline ? { title: s.headline } : {}),
            ...(s.body ? { description: s.body } : {}),
          }),
        ],
      }
    case 'pricing_table':
      return {
        ...base,
        stage: 'save_mechanic',
        title: s.headline ?? 'Choose a plan',
        description: s.body ?? '',
        components: [makePricingTable({ id: cid })],
      }
    case 'checkout':
      return {
        ...base,
        stage: 'checkout',
        title: s.headline ?? 'Complete checkout',
        description: s.body ?? '',
        components: [
          makeCheckout({
            id: cid,
            title: s.headline ?? 'Complete your change',
            subtitle: s.body,
          }),
        ],
      }
    case 'confirmation':
      return {
        ...base,
        stage: 'confirmation',
        title: s.headline ?? 'Are you sure you want to cancel?',
        description: s.body ?? '',
        components: [
          makeConfirmation({
            id: cid,
            title: s.headline ?? 'Are you sure you want to cancel?',
            ...(s.body ? { subtitle: s.body } : {}),
          }),
        ],
      }
    case 'outcome_saved':
      return {
        ...base,
        stage: 'outcome',
        title: '',
        description: '',
        components: [
          makeSavedOutcome({
            id: cid,
            headline: s.headline ?? 'Great — your plan is staying active',
            body: s.body,
          }),
        ],
      }
    case 'outcome_cancelled':
      return {
        ...base,
        stage: 'outcome',
        title: '',
        description: '',
        components: [
          makeOutcome({
            id: cid,
            headline: s.headline ?? 'Your plan has been cancelled',
            body: s.body,
          }),
        ],
      }
  }
}

function audienceFor(file: JourneyFile): Audience {
  if (file.audience === 'all') {
    return {
      id: 'aud-all',
      name: 'All subscribers',
      ruleType: 'ALL_AUDIENCE',
      targetAll: true,
      savedAudienceId: null,
      conditions: [],
    }
  }
  const savedId =
    file.audience === 'paying'
      ? 'all_paying'
      : file.audience === 'high_value'
        ? 'high_value'
        : file.audience === 'high_risk'
          ? 'high_risk'
          : file.audience === 'annual'
            ? 'annual'
            : 'in_trial'
  const saved = AUDIENCE_LIBRARY.find((a) => a.id === savedId)
  if (!saved) {
    return {
      id: 'aud-paying',
      name: 'Paying subscribers',
      ruleType: 'TARGETING',
      targetAll: false,
    }
  }
  return {
    id: `aud-${saved.id}`,
    name: saved.name,
    ruleType: 'TARGETING',
    savedAudienceId: saved.id,
    match: saved.match,
    conditions: saved.conditions,
    expression: conditionExpression(saved.conditions, saved.match),
  }
}

export interface CompiledJourney {
  experience: Experience
  playPatch: Partial<Play>
}

/** Compile the logic document into the runtime Experience the canvas already knows. */
export function compileJourney(file: JourneyFile, experienceId = PRIMARY_EXPERIENCE_ID): CompiledJourney {
  const acquire = file.kind === 'acquisition'
  const experience: Experience = {
    id: experienceId,
    name: file.name,
    blueprint: TEMPLATE_BLUEPRINT[file.template],
    shell: file.shell,
    branding: compileBrand(file.brand),
    frame: { ...DEFAULT_FRAME },
    steps: file.steps.map(compileStep),
  }

  return {
    experience,
    playPatch: {
      name: file.name,
      playType: acquire ? 'ACQUISITION' : 'CHURN_PREVENTION',
      presentation: acquire ? 'pricing_page' : file.shell === 'modal' ? 'modal' : 'cancel_page',
      audience: audienceFor(file),
    },
  }
}
