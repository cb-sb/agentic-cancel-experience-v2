import { useState } from 'react'
import { useExperience } from '../store/useExperience'
import { componentTitle } from '../lib/guardrails'
import type { ExperienceComponent, Step } from '../types/experience'
import {
  ComponentAppearance,
  ConfirmationEditor,
  LossAversionEditor,
  OfferEditor,
  OutcomeEditor,
  PricingTableEditor,
  SurveyEditor,
  hasAppearance,
} from './editors'

function ComponentEditor({ stepId, component }: { stepId: string; component: ExperienceComponent }) {
  switch (component.kind) {
    case 'loss_aversion':
      return <LossAversionEditor stepId={stepId} component={component} />
    case 'survey':
      return <SurveyEditor stepId={stepId} component={component} />
    case 'offer':
      return <OfferEditor stepId={stepId} component={component} />
    case 'pricing_table':
      return <PricingTableEditor stepId={stepId} component={component} />
    case 'checkout':
      return (
        <p className="text-[12px] leading-relaxed text-slate-500">
          Checkout is a preview of the payment step. Edit copy in the journey file or inline on the card.
        </p>
      )
    case 'confirmation':
      return <ConfirmationEditor stepId={stepId} component={component} />
    case 'outcome':
      return <OutcomeEditor stepId={stepId} component={component} />
  }
}

type Group = 'configuration' | 'appearance'

const GROUPS: { id: Group; label: string }[] = [
  { id: 'configuration', label: 'Configuration' },
  { id: 'appearance', label: 'Appearance' },
]

/**
 * Second-level switch, subordinate to the Settings/Brand tabs on purpose:
 * smaller type, and only as wide as its two labels rather than stretched across
 * the pane, so it reads as something inside Settings and not beside it. Centred
 * so it belongs to the pane rather than to the card below its left edge.
 */
function GroupSwitch({ value, onChange }: { value: Group; onChange: (g: Group) => void }) {
  return (
    <div className="mx-auto flex w-fit rounded-[7px] bg-slate-100 p-[3px]">
      {GROUPS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-[5px] px-2.5 py-[3px] text-[11.5px] font-semibold transition-colors ${
            value === id
              ? 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.10)]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Settings for the focused step, in two groups: what its components do, and how
 * their surfaces look. Split because configuration runs long — the survey alone
 * is a reason card per option — and the few styling controls were stranded at
 * the bottom of it.
 */
export function StepEditor({ step }: { step: Step }) {
  const removeComponent = useExperience((s) => s.removeComponent)
  const [group, setGroup] = useState<Group>('configuration')

  const styleable = step.components.filter(hasAppearance)
  const shown = group === 'appearance' ? styleable : step.components

  return (
    <div className="space-y-4">
      <GroupSwitch value={group} onChange={setGroup} />

      <section className="space-y-3">
        {shown.map((component) => {
          const canRemove =
            component.kind !== 'confirmation' &&
            component.kind !== 'outcome' &&
            step.components.length > 1
          return (
            <div key={component.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold capitalize text-slate-700">
                  {componentTitle(component)}
                </span>
                {/* Removing a component is structural, so it stays out of the
                    styling group where it would read as "remove this style". */}
                {group === 'configuration' && canRemove && (
                  <button
                    type="button"
                    onClick={() => removeComponent(step.id, component.id)}
                    className="text-[12px] font-medium text-slate-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="rounded-lg bg-white p-3">
                {group === 'appearance' ? (
                  <ComponentAppearance stepId={step.id} component={component} />
                ) : (
                  <ComponentEditor stepId={step.id} component={component} />
                )}
              </div>
            </div>
          )
        })}

        {group === 'appearance' && styleable.length === 0 && (
          <p className="text-[11px] leading-relaxed text-slate-400">
            Nothing on this step draws a surface of its own. Reason rows and offer cards do — everything
            else takes its look from Brand.
          </p>
        )}

        {group === 'configuration' && (
          <p className="text-[11px] leading-relaxed text-slate-400">
            Add another component from the “+ Add component” slot beside the card.
          </p>
        )}
      </section>
    </div>
  )
}
