import { seedExperience } from '../../lib/blueprints'
import { composeSteps } from '../../lib/composePlan'
import { audienceFieldsFor, segment } from '../../lib/growthContext'
import { useExperience } from '../../store/useExperience'
import { useOrchestration } from '../../store/useOrchestration'
import type { Experience } from '../../types/experience'
import type { FlowNode, SplitNode } from '../../types/orchestration'
import type { ApplyOp, SetupPhase } from './types'

function currentSplit(): SplitNode | null {
  const { play } = useOrchestration.getState()
  return play.targeting.kind === 'split' ? (play.targeting as SplitNode) : null
}

/** A stable signature of a step's authored content, ignoring ids. */
function stepSignature(exp: Experience): string {
  return exp.steps
    .map(
      (s) =>
        `${s.stage}|${s.title}|${s.description}|${s.components.map((c) => c.kind).join(',')}`,
    )
    .join('||')
}

/** Has the active experience diverged from a pristine seed of its blueprint? */
export function isExperienceDirty(exp: Experience): boolean {
  const fresh = seedExperience(exp.blueprint, { id: exp.id, name: exp.name })
  return stepSignature(exp) !== stepSignature(fresh)
}

export function applyOps(ops: ApplyOp[]): void {
  const exp = useExperience.getState()
  const orch = useOrchestration.getState()

  for (const op of ops) {
    switch (op.t) {
      case 'blueprint':
        exp.selectBlueprint(op.id)
        break
      case 'plan': {
        const { plan } = op
        exp.installSteps(plan.blueprint, composeSteps(plan))
        // Reuse the individual ops so routing behaves identically to a manual
        // setup, then leave the merchant on the canvas rather than in a drawer.
        applyOps([
          {
            t: 'trigger',
            triggerType: 'page_load',
            moment: plan.trigger.moment,
            label: plan.trigger.label,
            expression: plan.trigger.expression,
          },
          { t: 'audience', ...audienceFieldsFor(segment(plan.segmentId)) },
          { t: 'split', treatment: plan.split.treatment, holdout: plan.split.holdout },
        ])
        useOrchestration.getState().closeConfig()
        break
      }
      case 'shell':
        exp.setShell(op.shell)
        break
      case 'trigger':
        orch.updateTrigger({
          type: op.triggerType ?? 'page_load',
          moment: op.moment,
          label: op.label,
          expression: op.expression,
        })
        // Nothing to open: the trigger of a cancel experience is the merchant's
        // own cancel link, so it has no panel to show the work in.
        break
      case 'audience':
        orch.updateAudience({
          name: op.name,
          ruleType: op.ruleType,
          expression: op.expression,
          targetAll: op.targetAll ?? false,
          savedAudienceId: op.savedAudienceId ?? null,
          match: op.match ?? 'AND',
          conditions: op.conditions ?? [],
        })
        orch.openConfig('audience')
        break
      case 'split': {
        const split = currentSplit()
        if (!split) break
        // A holdout implies an experiment; ensure percent mode + a holdout branch.
        if (op.holdout > 0 && !split.branches.some((b) => b.node.kind === 'holdout')) {
          orch.setSplitMode(split.id, 'percent')
          orch.toggleHoldout(split.id)
        }
        const s2 = currentSplit()
        if (!s2) break
        const treatment = s2.branches.find((b) => b.node.kind === 'flow')
        const holdout = s2.branches.find((b) => b.node.kind === 'holdout')
        const percents: Record<string, number> = {}
        if (treatment) percents[treatment.id] = op.treatment
        if (holdout) percents[holdout.id] = op.holdout
        orch.setSplitPercents(s2.id, percents)
        orch.openConfig('targeting')
        break
      }
      case 'focus': {
        const split = currentSplit()
        // Audience and targeting are meta config — expand the config rail on
        // that tab. Trigger has no panel to expand onto.
        if (op.node === 'audience') orch.openConfig('audience')
        else if (op.node === 'split') orch.openConfig('targeting')
        else if (split) {
          const kind = op.node
          const branch = split.branches.find((b) => b.node.kind === kind)
          if (branch) {
            if (branch.node.kind === 'flow') exp.setActiveExperience((branch.node as FlowNode).experienceId)
            orch.selectNode(branch.node.id)
          }
        }
        break
      }
      case 'addComponent': {
        const active = useExperience.getState().experience
        const target = op.stage
          ? active.steps.find((s) => s.stage === op.stage)
          : active.steps.find((s) => s.stage !== 'confirmation' && s.stage !== 'outcome')
        if (target) exp.addComponent(target.id, op.kind)
        break
      }
      case 'abTest': {
        const split = currentSplit()
        if (!split) break
        // Uncapped: append a fresh variant (duplicates the control experience).
        orch.addVariant(split.id)
        // Optionally align a holdout to the requested share, then rebalance flows.
        const afterAdd = currentSplit()
        if (afterAdd) {
          const hasHold = afterAdd.branches.some((b) => b.node.kind === 'holdout')
          if (op.holdout > 0 && !hasHold) orch.toggleHoldout(afterAdd.id)
          if (op.holdout <= 0 && hasHold) orch.toggleHoldout(afterAdd.id)
        }
        const next = currentSplit()
        if (next) {
          const flows = next.branches.filter((b) => b.node.kind === 'flow')
          const hold = next.branches.find((b) => b.node.kind === 'holdout')
          const share = Math.round((100 - Math.max(0, op.holdout)) / Math.max(1, flows.length))
          const percents: Record<string, number> = {}
          flows.forEach((b) => (percents[b.id] = share))
          if (hold) percents[hold.id] = op.holdout
          orch.setSplitPercents(next.id, percents)
        }
        break
      }
      case 'preview':
        exp.setMode('play')
        break
      case 'openTemplates':
        orch.openTemplates()
        break
      case 'closeTemplates':
        orch.closeTemplates()
        break
      case 'publish':
        orch.togglePublish()
        break
    }
  }
}

/** Which top-level phases already look configured, for the progress rail. */
export function deriveCompletedPhases(): SetupPhase[] {
  const { play } = useOrchestration.getState()
  const { experience } = useExperience.getState()
  const done: SetupPhase[] = []
  const split = play.targeting.kind === 'split' ? (play.targeting as SplitNode) : null
  if (experience.steps.length > 0) done.push('blueprint')
  if (play.trigger.label) done.push('trigger')
  if (play.audience.name) done.push('audience')
  if (split && split.branches.length > 0) done.push('split')
  if (done.length >= 4) done.push('review')
  return done
}
