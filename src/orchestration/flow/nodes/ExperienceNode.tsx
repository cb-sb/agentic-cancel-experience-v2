import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useExperience } from '../../../store/useExperience'
import { useOrchestration } from '../../../store/useOrchestration'
import { AnnotationDock } from '../../AnnotationComposer'
import { useAnnotatePick } from '../../useAnnotatePick'
import { ExperienceEnclosure } from '../../ExperienceEnclosure'
import type { ExperienceNodeData } from '../types'

function ExperienceNodeComponent({ id, data }: NodeProps & { data: ExperienceNodeData }) {
  const selectNode = useOrchestration((s) => s.selectNode)
  const selectedNodeId = useOrchestration((s) => s.selectedNodeId)
  const toggleFlowCollapsed = useOrchestration((s) => s.toggleFlowCollapsed)
  const activeExperienceId = useExperience((s) => s.activeExperienceId)

  const { layout } = data
  const { flow, experience } = layout
  const selected = selectedNodeId === flow.id
  const annTarget = experience
    ? {
        id,
        kind: 'flow' as const,
        label: experience.name,
        experienceId: experience.id,
      }
    : null
  const { annotateMode, onPointerDown: onAnnotateDown, ring } = useAnnotatePick(annTarget)

  if (!experience) return null

  return (
    <div className={`relative ${ring}`} onPointerDownCapture={onAnnotateDown}>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !min-h-0 !min-w-0 !border-0 !opacity-0"
      />
      <ExperienceEnclosure
        experience={experience}
        flowNodeId={flow.id}
        selected={selected}
        active={activeExperienceId === experience.id}
        onSelect={() => {
          if (annotateMode) return
          selectNode(selected ? null : flow.id)
        }}
        width={layout.w}
        height={layout.h}
        collapsed={layout.collapsed}
        onToggleCollapse={() => toggleFlowCollapsed(flow.id)}
      />
      <AnnotationDock forId={id} />
    </div>
  )
}

export const ExperienceNode = memo(ExperienceNodeComponent)
