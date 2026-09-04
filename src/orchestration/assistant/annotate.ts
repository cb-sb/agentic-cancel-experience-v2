import { blueprintMeta } from '../../lib/blueprints'
import { useExperience } from '../../store/useExperience'
import { useOrchestration } from '../../store/useOrchestration'
import type { AnnotationTarget } from '../../store/useOrchestration'
import { blueprintForStepCount, stepDown, stepUp } from './recommend'
import type { MessageAction } from './types'
import { AUDIENCE_LIBRARY, conditionExpression } from '../../types/orchestration'
import type { SplitNode, TriggerMoment } from '../../types/orchestration'

export interface AnnotateReply {
  text: string
  action?: MessageAction
}

const TRIGGER_PRESETS: {
  moment: TriggerMoment
  label: string
  expression?: string
  short: string
  match: RegExp
}[] = [
  { moment: 'custom_page', label: 'Custom page load', expression: '/account/cancel', short: 'the cancel page load', match: /page|url|\/cancel|visit|custom/ },
  { moment: 'any_page', label: 'Any page load', short: 'any page load', match: /any page|anywhere|any load/ },
]

const AUDIENCE_PRESETS: { op: Extract<MessageAction['ops'][number], { t: 'audience' }>; short: string; match: RegExp }[] = [
  {
    op: { t: 'audience', name: 'All subscribers', ruleType: 'ALL_AUDIENCE', targetAll: true, savedAudienceId: null, conditions: [] },
    short: 'all subscribers',
    match: /all|everyone|every subscriber/,
  },
  ...AUDIENCE_LIBRARY.map((a) => ({
    op: {
      t: 'audience' as const,
      name: a.name,
      ruleType: 'TARGETING' as const,
      savedAudienceId: a.id,
      match: a.match,
      conditions: a.conditions,
      expression: conditionExpression(a.conditions, a.match),
    },
    short: a.name,
    match:
      a.id === 'all_paying'
        ? /pay|active|mrr|billing/
        : a.id === 'high_value'
        ? /high.?value|vip|top|whale|enterprise/
        : a.id === 'high_risk'
        ? /risk|churn|starter/
        : a.id === 'annual'
        ? /annual|yearly/
        : /trial/,
  })),
]

function currentSplit(): SplitNode | null {
  const { play } = useOrchestration.getState()
  return play.targeting.kind === 'split' ? (play.targeting as SplitNode) : null
}

function splitPercents(): { treatment: number; holdout: number } {
  const split = currentSplit()
  if (!split) return { treatment: 100, holdout: 0 }
  const treatment = split.branches.filter((b) => b.node.kind === 'flow').reduce((s, b) => s + b.percent, 0)
  const holdout = split.branches.find((b) => b.node.kind === 'holdout')?.percent ?? 0
  return { treatment, holdout }
}

/** Parse a treatment/holdout split out of free text, if present. */
function parseSplit(q: string): { treatment: number; holdout: number } | null {
  if (/no holdout|100%? treatment|all traffic/.test(q)) return { treatment: 100, holdout: 0 }
  const pair = q.match(/(\d{1,3})\s*[/\-x: ]\s*(\d{1,3})/)
  if (pair) {
    const a = Number(pair[1])
    const b = Number(pair[2])
    if (a + b === 100) return { treatment: a, holdout: b }
    if (a <= 100 && b <= 100) return { treatment: Math.max(a, b), holdout: Math.min(a, b) }
  }
  const hold = q.match(/holdout[^\d]*(\d{1,3})|(\d{1,3})\s*%?\s*holdout/)
  if (hold) {
    const h = Number(hold[1] ?? hold[2])
    if (h >= 0 && h <= 50) return { treatment: 100 - h, holdout: h }
  }
  return null
}

function pct(v: number): string {
  return `${Math.round(v)}%`
}

function splitReply(q: string): AnnotateReply {
  const parsed = parseSplit(q)
  if (parsed) {
    return {
      text: `I can set the split to ${pct(parsed.treatment)} treatment / ${pct(parsed.holdout)} holdout.${
        parsed.holdout === 0
          ? ' No holdout means faster rollout but no measured lift — you can add one back later.'
          : ` A ${pct(parsed.holdout)} holdout keeps a clean control so the save-rate gap between the two is your true lift.`
      }`,
      action: { label: `Apply ${pct(parsed.treatment)} / ${pct(parsed.holdout)} split`, ops: [{ t: 'split', treatment: parsed.treatment, holdout: parsed.holdout }] },
    }
  }
  const { treatment, holdout } = splitPercents()
  return {
    text: `Right now it's ${pct(treatment)} treatment / ${pct(holdout)} holdout. The holdout is a control group that sees no cancel experience, so the difference in save rate between the groups is your measured lift. Tell me a ratio like "80/20" and I'll adjust it.`,
  }
}

function holdoutReply(q: string): AnnotateReply {
  const parsed = parseSplit(q)
  if (parsed) {
    return {
      text: `Sure — I'll size the holdout at ${pct(parsed.holdout)} (so ${pct(parsed.treatment)} sees the flow).`,
      action: { label: `Set ${pct(parsed.holdout)} holdout`, ops: [{ t: 'split', treatment: parsed.treatment, holdout: parsed.holdout }] },
    }
  }
  const { holdout } = splitPercents()
  return {
    text: `This is the control group — currently ${pct(holdout)} of traffic sees no cancel experience. It's how we prove the flow actually lifts saves versus doing nothing. A larger holdout tightens the read; a smaller one exposes more traffic to the flow. Say e.g. "15% holdout" to change it.`,
  }
}

function triggerReply(q: string): AnnotateReply {
  const preset = TRIGGER_PRESETS.find((p) => p.match.test(q))
  const { play } = useOrchestration.getState()
  if (preset && preset.label !== play.trigger.label) {
    return {
      text: `Got it — I can fire the play on ${preset.short}.`,
      action: { label: `Switch trigger to ${preset.short}`, ops: [{ t: 'trigger', triggerType: 'page_load', moment: preset.moment, label: preset.label, expression: preset.expression }] },
    }
  }
  return {
    text: `This is the trigger — it decides when the play fires. It's set to "${play.trigger.label}". Page load is the only live trigger today: I can fire it on any page load or a specific cancel-page URL. Which would you like?`,
  }
}

function audienceReply(q: string): AnnotateReply {
  const preset = AUDIENCE_PRESETS.find((p) => p.match.test(q))
  const { play } = useOrchestration.getState()
  if (preset && preset.op.name !== play.audience.name) {
    return {
      text: `I can target "${preset.short}" for this play.`,
      action: { label: `Target ${preset.short}`, ops: [preset.op] },
    }
  }
  return {
    text: `This is the audience — who's eligible to enter the flow. It's set to "${play.audience.name}". I can narrow it to paying or high-value subscribers, or open it to everyone. Which would you like?`,
  }
}

function flowReply(q: string, target: AnnotationTarget): AnnotateReply {
  const { experience } = useExperience.getState()
  const meta = blueprintMeta(experience.blueprint)
  const steps = meta.stepCount
  const posture = meta.posture.replace('_', ' ')
  const label = target.kind === 'step' ? target.label : `${meta.name} flow`

  const numberMatch = q.match(/\b([1-6])\b/)
  const wantsFewer = /fewer|less|shorter|reduce|trim|simpler|leaner|remove a step/.test(q)
  const wantsMore = /more|add|longer|extra|aggressive|stronger|another step/.test(q)
  const copyIntent = /shorter copy|punch|headline|wording|rewrite|reword|tone|cta|button text|microcopy|voice/.test(q)

  let targetId = experience.blueprint
  if (numberMatch) targetId = blueprintForStepCount(Number(numberMatch[1]))
  else if (wantsFewer) targetId = stepDown(experience.blueprint)
  else if (wantsMore) targetId = stepUp(experience.blueprint)

  if (targetId !== experience.blueprint) {
    const next = blueprintMeta(targetId)
    return {
      text: `I can reshape this into ${next.name} — ${next.stepCount} step${next.stepCount > 1 ? 's' : ''}, ${next.posture.replace('_', ' ')} posture. This replaces the current steps.`,
      action: { label: `Reshape to ${next.stepCount} step${next.stepCount > 1 ? 's' : ''}`, ops: [{ t: 'blueprint', id: targetId }] },
    }
  }

  if (copyIntent) {
    return {
      text: `I can't rewrite in-card copy automatically yet, but for ${label}: lead the headline with a single concrete benefit and keep the primary CTA a clear action like "Keep my plan". You can click any text on the card to edit it inline.`,
    }
  }

  return {
    text: `${label} is part of ${meta.name} — ${steps} step${steps > 1 ? 's' : ''}, ${posture} posture. Tell me "fewer steps", "more save attempts", or a number 1–6 and I'll reshape the flow. To tweak copy, click the text on the card directly.`,
  }
}

export function annotateReply(target: AnnotationTarget, text: string): AnnotateReply {
  const q = text.toLowerCase().trim()
  switch (target.kind) {
    case 'split':
      return splitReply(q)
    case 'holdout':
      return holdoutReply(q)
    case 'trigger':
      return triggerReply(q)
    case 'audience':
      return audienceReply(q)
    case 'flow':
    case 'step':
      return flowReply(q, target)
    default:
      return { text: "Noted — I've added that to the thread." }
  }
}
