import { useState } from 'react'
import { Panel } from '@xyflow/react'
import { useExperience } from '../../store/useExperience'
import { useOrchestration } from '../../store/useOrchestration'
import type { SplitNode } from '../../types/orchestration'
import { AddMenu, type AddOption } from './AddMenu'
import { PlusIcon } from './sharedUi'

/**
 * The canvas had no way to put a node on it.
 *
 * Everything here already existed as a store action, reachable only from a
 * button attached to something else — the split's own column, an enclosure's
 * toolbar, a mode toggle in a settings drawer. So a merchant looking at an
 * empty stretch of canvas had nothing to click.
 *
 * Granularity is what separates this from the other three adds, and each one
 * stays where its result lands: this palette places *play-level* nodes, the gap
 * between columns inserts a step, the step toolbar adds a component or an
 * interchangeable variant.
 */
export function CanvasAddPalette() {
  const play = useOrchestration((s) => s.play)
  const addVariant = useOrchestration((s) => s.addVariant)
  const addSubAudience = useOrchestration((s) => s.addSubAudience)
  const toggleHoldout = useOrchestration((s) => s.toggleHoldout)
  const addTreatmentBranch = useOrchestration((s) => s.addTreatmentBranch)
  const setFlowTarget = useOrchestration((s) => s.setFlowTarget)
  const selectNode = useOrchestration((s) => s.selectNode)
  const duplicateExperience = useExperience((s) => s.duplicateExperience)
  const experience = useExperience((s) => s.experience)
  const [open, setOpen] = useState(false)

  const split = play.targeting.kind === 'split' ? (play.targeting as SplitNode) : null
  if (!split) return null

  const flows = split.branches.filter((b) => b.node.kind === 'flow')
  const hasHoldout = split.branches.some((b) => b.node.kind === 'holdout')

  /**
   * A new branch, and what the subscriber meets down it. Every flow branch
   * carries an experience even when its target is a bare offer or the pricing
   * page, so one is always made; the target is what decides which of the three
   * the canvas draws.
   */
  const branch = (name: string, target: 'OFFER' | 'PRICING_PAGE' | null) => {
    addTreatmentBranch(split.id, duplicateExperience(experience.id, name), name)
    const next = useOrchestration.getState().play.targeting as SplitNode
    const node = next.branches[next.branches.length - 1]?.node
    if (node?.kind !== 'flow') return
    if (target) setFlowTarget(node.id, target)
    selectNode(node.id)
  }

  const paths: AddOption[] = [
    {
      id: 'experience',
      label: 'Cancel experience',
      desc: 'A whole flow of steps',
      onPick: () => branch('New cancel experience', null),
    },
    {
      id: 'offer',
      label: 'Standalone offer',
      desc: 'One save offer, no flow around it',
      onPick: () => branch('Standalone offer', 'OFFER'),
    },
    {
      id: 'pricing',
      label: 'Pricing table',
      desc: 'Send them to compare plans',
      onPick: () => branch('Pricing table', 'PRICING_PAGE'),
    },
  ]

  const tests: AddOption[] = [
    {
      id: 'variant',
      label: 'A/B variant',
      desc: 'Copy of this experience, split by traffic',
      onPick: () => addVariant(split.id),
    },
    {
      id: 'segment',
      label: 'Sub-audience',
      desc: 'A slice of the audience with its own flow',
      onPick: () => addSubAudience(split.id),
    },
    {
      id: 'holdout',
      label: 'Holdout',
      desc: 'A share who see no treatment at all',
      disabledReason: hasHoldout ? 'This play already has a holdout' : undefined,
      onPick: () => toggleHoldout(split.id),
    },
  ]

  return (
    <Panel position="bottom-left" className="nowheel nopan !m-4">
      <div className="relative">
        <button
          type="button"
          title="Add a node to this play"
          aria-expanded={open}
          className={`flex h-9 items-center gap-1.5 rounded-xl border bg-white/95 px-2.5 text-[12.5px] font-semibold shadow-sm backdrop-blur transition-colors ${
            open
              ? 'border-indigo-300 text-indigo-600'
              : 'border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => setOpen((v) => !v)}
        >
          <PlusIcon />
          Add
        </button>
        {open && (
          <AddMenu
            align="left"
            side="above"
            onClose={() => setOpen(false)}
            sections={[
              { title: 'Add a path', options: paths },
              { title: 'Split the traffic', options: flows.length ? tests : [] },
            ]}
          />
        )}
      </div>
    </Panel>
  )
}
