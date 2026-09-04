import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useOrchestration } from '../../../store/useOrchestration'
import { CARD_H, CARD_W } from '../canvasTokens'
import { ScreenBox } from '../screen'
import { NodeCard, WireHandles } from '../sharedUi'
import type { SplitCardNodeData } from '../types'

/**
 * Root of the canvas: where traffic divides between the cancel experiences and
 * their variants. Deliberately not an inline editor — the split is play
 * configuration, so clicking it opens targeting in the right drawer.
 */
function SplitCardNodeComponent({ data }: NodeProps & { data: SplitCardNodeData }) {
  const configTarget = useOrchestration((s) => s.configTarget)
  const openConfig = useOrchestration((s) => s.openConfig)

  const open = configTarget === 'targeting'

  return (
    <div className="group relative" style={{ width: CARD_W, height: CARD_H }}>
      <WireHandles target={false} />
      <ScreenBox w={CARD_W} h={CARD_H}>
        {(size) => (
          <NodeCard
            node={data.placed}
            selected={open}
            onSelect={() => openConfig('targeting')}
            isSplit
            size={size}
          />
        )}
      </ScreenBox>
    </div>
  )
}

export const SplitCardNode = memo(SplitCardNodeComponent)
