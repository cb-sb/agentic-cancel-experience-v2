import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useExperience } from '../../../store/useExperience'
import { useOrchestration } from '../../../store/useOrchestration'
import { TargetEnclosure } from '../../TargetEnclosure'
import type { TargetNodeData } from '../types'

function TargetNodeComponent({ data }: NodeProps & { data: TargetNodeData }) {
  const selectedNodeId = useOrchestration((s) => s.selectedNodeId)
  const selectNode = useOrchestration((s) => s.selectNode)
  const play = useOrchestration((s) => s.play)
  const removeBranch = useOrchestration((s) => s.removeBranch)
  const setActiveExperience = useExperience((s) => s.setActiveExperience)
  const device = useExperience((s) => s.device)

  const { layout } = data
  const { flow } = layout
  const selected = selectedNodeId === flow.id

  // The store refuses to leave a split with no paths, so the last one says so
  // rather than offering a button that quietly does nothing.
  const split = play.targeting.kind === 'split' ? play.targeting : null
  const branch = split?.branches.find((b) => b.node.id === flow.id) ?? null
  const paths = split?.branches.filter((b) => b.node.kind === 'flow').length ?? 0

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!opacity-0 !h-2 !w-2 !min-h-0 !min-w-0 !border-0" />
      <TargetEnclosure
        flow={flow}
        target={flow.target}
        selected={selected}
        onSelect={() => {
          setActiveExperience(flow.experienceId)
          selectNode(selected ? null : flow.id)
        }}
        onRemove={
          split && branch && paths > 1 ? () => removeBranch(split.id, branch.id) : undefined
        }
        width={layout.w}
        device={device}
      />
    </div>
  )
}

export const TargetNode = memo(TargetNodeComponent)
