import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useExperience } from '../../../store/useExperience'
import { useOrchestration } from '../../../store/useOrchestration'
import { PORT_TOP, STEP_H, STEP_W, portY } from '../canvasTokens'
import { offerPortOf, reasonPorts } from '../ports'
import { ScreenBox } from '../screen'
import { useSetHoveredStep } from '../StepChrome'
import { StepBody } from '../tiers'
import type { StepNodeData } from '../types'

/** Invisible, and mounted at every tier: a port that unmounts orphans its edge. */
const PORT_CLASS = '!h-1.5 !w-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0'

export function StepNode({ data }: NodeProps) {
  const { slot, experienceId } = data as unknown as StepNodeData
  const { step } = slot
  const experience = useExperience((s) => s.experiences[experienceId])
  const activeStepId = useExperience((s) => s.activeStepId)
  const activeExperienceId = useExperience((s) => s.activeExperienceId)
  const setActiveExperience = useExperience((s) => s.setActiveExperience)
  const setActiveStep = useExperience((s) => s.setActiveStep)
  const focusStep = useOrchestration((s) => s.focusStep)
  const focusTarget = useOrchestration((s) => s.focusTarget)
  const setHovered = useSetHoveredStep()

  if (!experience) return null

  const selected = activeExperienceId === experienceId && activeStepId === step.id
  // The drawer pans this card into view beside itself, and the focus audit
  // checks it got there; both need to find it in the DOM.
  const focused = focusTarget?.experienceId === experienceId && focusTarget.stepId === step.id
  const reasons = reasonPorts(step)
  const offerPort = offerPortOf(step)

  return (
    <div
      data-audit-kind="step"
      data-step-focused={focused || undefined}
      className="group relative"
      style={{ width: STEP_W, height: STEP_H }}
      onPointerDown={() => {
        setActiveExperience(experienceId)
        setActiveStep(step.id)
      }}
      // The toolbar lives in the screen-space layer, so the card only reports
      // which step the pointer is on and the layer decides what to draw.
      onPointerEnter={() => setHovered(step.id)}
      onPointerLeave={() => setHovered(null)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        focusStep({ experienceId, stepId: step.id })
      }}
    >
      <Handle id="in.left" type="target" position={Position.Left} className={PORT_CLASS} />
      <Handle id="out.right" type="source" position={Position.Right} className={PORT_CLASS} />
      {/* The saved path leaves lower down the same edge, so accepting an offer
          and declining it are two wires a merchant can tell apart rather than
          two labels on top of each other. Mounted on every card, used by the
          ones that can save a subscriber. */}
      <Handle
        id="out.saved"
        type="source"
        position={Position.Right}
        style={{ top: STEP_H - 26 }}
        className={PORT_CLASS}
      />

      {/* Declared ports. Their world offsets are the same numbers the card body
          lays its rows out on, so a connector lands on its row at every tier. */}
      {reasons.map((row, i) => (
        <Handle
          key={row.id}
          id={row.id}
          type="source"
          position={Position.Right}
          style={{ top: portY(i) }}
          className={PORT_CLASS}
        />
      ))}
      {offerPort && (
        <Handle
          id={offerPort}
          type="target"
          position={Position.Left}
          style={{ top: PORT_TOP }}
          className={PORT_CLASS}
        />
      )}

      <div className={step.disabled ? 'h-full w-full opacity-45 grayscale' : 'h-full w-full'}>
        <ScreenBox w={STEP_W} h={STEP_H}>
          {(size) => (
            <StepBody step={step} experience={experience} size={size} selected={selected} />
          )}
        </ScreenBox>
      </div>
    </div>
  )
}
