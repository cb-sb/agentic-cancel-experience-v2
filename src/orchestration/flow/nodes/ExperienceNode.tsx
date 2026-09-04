import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useExperience } from '../../../store/useExperience'
import { useOrchestration } from '../../../store/useOrchestration'
import { ExperienceEnclosure } from '../../ExperienceEnclosure'
import type { ExperienceNodeData } from '../types'

function ExperienceNodeComponent({ data }: NodeProps & { data: ExperienceNodeData }) {
  const selectNode = useOrchestration((s) => s.selectNode)
  const selectedNodeId = useOrchestration((s) => s.selectedNodeId)
  const toggleFlowCollapsed = useOrchestration((s) => s.toggleFlowCollapsed)
  const activeExperienceId = useExperience((s) => s.activeExperienceId)

  const { layout } = data
  const { flow, experience } = layout
  const selected = selectedNodeId === flow.id

  if (!experience) return null

  return (
    <div className="relative">
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
        onSelect={() => selectNode(selected ? null : flow.id)}
        width={layout.w}
        height={layout.h}
        collapsed={layout.collapsed}
        onToggleCollapse={() => toggleFlowCollapsed(flow.id)}
      />
    </div>
  )
}

export const ExperienceNode = memo(ExperienceNodeComponent)
