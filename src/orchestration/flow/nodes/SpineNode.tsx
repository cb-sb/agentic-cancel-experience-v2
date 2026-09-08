import { memo, useCallback } from 'react'
import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { useOrchestration, type AnnotationTarget } from '../../../store/useOrchestration'
import { AnnotationDock } from '../../AnnotationComposer'
import { NodeSetup } from '../../NodeSetup'
import { useAnnotatePick } from '../../useAnnotatePick'
import type { FlowNode, SplitNode } from '../../../types/orchestration'
import { CARD_H, CARD_W } from '../canvasTokens'
import { ScreenBox } from '../screen'
import { AnnotatePin, NodeCard, WireHandles } from '../sharedUi'
import type { SpineNodeData } from '../types'

function SpineNodeComponent({ id, data }: NodeProps & { data: SpineNodeData }) {
  const selectedNodeId = useOrchestration((s) => s.selectedNodeId)
  const openAnnotation = useOrchestration((s) => s.openAnnotation)
  const play = useOrchestration((s) => s.play)

  const configTarget = useOrchestration((s) => s.configTarget)
  const openConfig = useOrchestration((s) => s.openConfig)
  const closeConfig = useOrchestration((s) => s.closeConfig)

  const split = play.targeting.kind === 'split' ? (play.targeting as SplitNode) : null
  const selected = selectedNodeId === id
  // The split's own card has its own node type; everything else on the spine is
  // one of its branches, and a branch is a share of the traffic it divides.
  const isBranch = !!split && split.id !== id
  const targeting = isBranch && configTarget === 'targeting'

  const targetForNode = useCallback((): AnnotationTarget | null => {
    const node = data.placed
    const branch = split?.branches.find((b) => b.node.id === node.id)
    if (branch?.node.kind === 'holdout') return { id: node.id, kind: 'holdout', label: 'Holdout · control' }
    if (branch?.node.kind === 'flow')
      return { id: node.id, kind: 'flow', label: node.title, experienceId: (branch.node as FlowNode).experienceId }
    return null
  }, [data.placed, split])

  const annTarget = targetForNode()
  const { annotateMode, onPointerDown: onAnnotateDown, ring } = useAnnotatePick(annTarget)

  return (
    <div
      className={`group relative ${ring}`}
      style={{ width: CARD_W, height: CARD_H }}
      onPointerDownCapture={onAnnotateDown}
    >
      <WireHandles />
      {/* A branch card shows a share of traffic — `Variant · 50%`, `Sub-audience`
          — so clicking it opens the one editor for shares, on the canvas edge.
          It used to open a routing popover of its own here, which is what made
          the card read as an editor for the experience it names; the panel it
          points at is now labelled Targeting and lives at the canvas edge.
          Selection still arrives from the assistant, so the setup toolbar
          below stays live. */}
      <ScreenBox w={CARD_W} h={CARD_H}>
        {(size) => (
          <NodeCard
            node={data.placed}
            selected={selected || targeting}
            isSplit={split?.id === id}
            onSelect={
              annotateMode
                ? undefined
                : isBranch
                  ? () => (targeting ? closeConfig() : openConfig('targeting'))
                  : undefined
            }
            size={size}
          />
        )}
      </ScreenBox>
      {annTarget && !annotateMode && (
        <div data-chrome className="absolute -right-2.5 -top-2.5 z-20">
          <AnnotatePin onClick={() => openAnnotation(annTarget)} />
        </div>
      )}
      {/* NodeToolbar renders in screen space, so setup panels keep a readable
          size instead of shrinking with the canvas zoom. */}
      <NodeToolbar isVisible={selected} position={Position.Bottom} align="start" offset={14}>
        <div
          className="nowheel nopan cursor-default rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xl"
          onPointerDown={(e) => e.stopPropagation()}
          style={{ width: 320, maxHeight: '70vh', overflowY: 'auto' }}
        >
          <NodeSetup nodeId={id} />
        </div>
      </NodeToolbar>
      <AnnotationDock forId={id} />
    </div>
  )
}

export const SpineNode = memo(SpineNodeComponent)
