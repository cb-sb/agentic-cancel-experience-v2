import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useOrchestration } from '../../../store/useOrchestration'
import { ADD_BRANCH_H, CARD_W } from '../canvasTokens'
import { ScreenBox } from '../screen'
import { AddBranchButton } from '../sharedUi'
import type { AddBranchNodeData } from '../types'

/**
 * Adds a branch to the split. Hidden at the map tier, where it would be a
 * smudge below a card that is itself barely a card — the slot stays reserved
 * either way, so nothing moves when it comes back.
 */
function AddBranchNodeComponent({ data }: NodeProps & { data: AddBranchNodeData }) {
  const addVariant = useOrchestration((s) => s.addVariant)
  const addSubAudience = useOrchestration((s) => s.addSubAudience)

  return (
    // Chrome, not layout: nothing sits below it, so it is free to keep its
    // natural size even where that overruns the slot the graph gave it.
    <ScreenBox w={CARD_W} h={ADD_BRANCH_H} style={{ overflow: 'visible' }} data-chrome>
      {(size) =>
        size.tier === 't0' || size.tier === 't1' ? null : (
          <AddBranchButton
            mode={data.mode}
            scale={1}
            onClick={() =>
              data.mode === 'audience' ? addSubAudience(data.splitId) : addVariant(data.splitId)
            }
          />
        )
      }
    </ScreenBox>
  )
}

export const AddBranchNode = memo(AddBranchNodeComponent)
