import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useExperience } from '../../store/useExperience'
import { useOrchestration } from '../../store/useOrchestration'
import { DemoChip } from './DemoChip'
import { iconProps } from './icons'
import { JourneyEdge } from './JourneyEdge'
import { buildFlowGraph } from './layout'
import { AddBranchNode } from './nodes/AddBranchNode'
import { ExperienceNode } from './nodes/ExperienceNode'
import { SpineNode } from './nodes/SpineNode'
import { SplitCardNode } from './nodes/SplitCardNode'
import { StepNode } from './nodes/StepNode'
import { TargetNode } from './nodes/TargetNode'
import {
  LINK_W,
  LINK_W_HOT,
  MAX_ZOOM,
  MIN_ZOOM,
  STEP_W,
  STEP_WIRE_W,
  TIERS,
  TIER_HINT,
  TIER_LABEL,
  WIRE_W,
  clamp,
  tierForZoom,
  zoomForTier,
} from './canvasTokens'
import {
  StepChromeLayer,
  StepChromeProvider,
  useHoveredStep,
  type ConnectionTarget,
} from './StepChrome'
import { HotPortProvider, useHotPort } from './linkHover'
import { FocusAutoPan } from '../focus/FocusAutoPan'
import { CanvasAnchor } from './CanvasAnchor'
import { CanvasTestHook } from './testHook'
import type { OrchestrationNodeData } from './types'

const nodeTypes: NodeTypes = {
  spine: SpineNode,
  splitCard: SplitCardNode,
  experience: ExperienceNode,
  target: TargetNode,
  step: StepNode,
  addBranch: AddBranchNode,
}

/** Every wire inside an experience, since every one of them carries an event. */
const edgeTypes: EdgeTypes = { journey: JourneyEdge }

const FIT_VIEW_OPTIONS = { padding: 0.15, duration: 300 }
/**
 * Open on the whole play, but never so far out that the merchant lands in the
 * wireframe overview tier before they have seen a real card.
 */
const INITIAL_FIT = { padding: 0.12, minZoom: 0.55, maxZoom: 1 }

function minimapNodeColor(node: { type?: string }) {
  switch (node.type) {
    case 'splitCard':
      return '#0f172a'
    case 'experience':
      return '#6366f1'
    case 'target':
      return '#f59e0b'
    case 'spine':
      return '#64748b'
    case 'addBranch':
      return '#a5b4fc'
    default:
      return '#94a3b8'
  }
}

/**
 * Dots are sized/spaced in flow units, so they collapse into a faint haze when
 * zoomed out. Dividing by zoom pins the grid to a constant screen density.
 */
function CanvasBackground() {
  const zoom = useStore((s) => s.transform[2])
  return (
    <Background variant={BackgroundVariant.Dots} gap={22 / zoom} size={1.4 / zoom} color="#d5dae1" />
  )
}

/** Bar heights say the ladder, so the strip doubles as a shortcut to each tier. */
const TIER_BAR = [6, 9, 12, 15]

function ZoomButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:text-slate-300"
    >
      {children}
    </button>
  )
}

function ZoomControlsPanel({ wiring, onToggleWiring }: { wiring: boolean; onToggleWiring: () => void }) {
  const zoom = useStore((s) => s.transform[2])
  const tier = tierForZoom(zoom, STEP_W)
  const { getViewport, setViewport, fitView } = useReactFlow()

  /** Zoom keeps the middle of the viewport fixed, the way scroll-zoom does. */
  const zoomTo = (target: number) => {
    const { x, y, zoom: k } = getViewport()
    const nextK = clamp(target, MIN_ZOOM, MAX_ZOOM)
    const pane = document.querySelector('.react-flow__pane')?.parentElement
    const cx = pane ? pane.clientWidth / 2 : 400
    const cy = pane ? pane.clientHeight / 2 : 300
    const ratio = nextK / k
    setViewport({ x: cx - (cx - x) * ratio, y: cy - (cy - y) * ratio, zoom: nextK }, { duration: 150 })
  }

  return (
    // The demo chip rides in the same row rather than stacking above it: the
    // corner above the controls belongs to the minimap.
    <Panel position="bottom-right" className="nowheel nopan !m-4 flex items-center gap-2">
      <DemoChip />
      <div className="flex h-9 items-center gap-0.5 rounded-xl border border-slate-200 bg-white/95 px-1 shadow-sm backdrop-blur">
      <ZoomButton title="Zoom out" onClick={() => zoomTo(zoom * 0.87)} disabled={zoom <= MIN_ZOOM + 1e-3}>
        <svg {...iconProps} width={14} height={14}>
          <path d="M5 12h14" />
        </svg>
      </ZoomButton>
      <span className="w-10 text-center text-[11.5px] font-semibold tabular-nums text-slate-600">
        {Math.round(zoom * 100)}%
      </span>
      <ZoomButton title="Zoom in" onClick={() => zoomTo(zoom * 1.15)} disabled={zoom >= MAX_ZOOM - 1e-3}>
        <svg {...iconProps} width={14} height={14}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </ZoomButton>

      <span className="mx-1 h-5 w-px bg-slate-200" />

      <div className="flex h-7 items-center gap-1.5 rounded-md bg-slate-50 pl-1 pr-2">
        <span className="flex items-end">
          {TIERS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => zoomTo(zoomForTier(t))}
              title={`${TIER_LABEL[t]} — ${TIER_HINT[t]}`}
              aria-label={`Zoom to ${TIER_LABEL[t]}`}
              className="group flex h-6 w-[9px] items-end justify-center"
            >
              <span
                className={`w-[3px] rounded-full transition-colors ${
                  t === tier ? 'bg-indigo-500' : 'bg-slate-300 group-hover:bg-slate-400'
                }`}
                style={{ height: TIER_BAR[i] }}
              />
            </button>
          ))}
        </span>
        <span className="text-[11.5px] font-semibold text-slate-700">{TIER_LABEL[tier]}</span>
      </div>

      <span className="mx-1 h-5 w-px bg-slate-200" />

      {/* Reason routing is the densest thing on the canvas: worth being able to
          put away while reading the shape of the play. */}
      <button
        type="button"
        onClick={onToggleWiring}
        title={wiring ? 'Hide reason routing' : 'Show reason routing'}
        aria-pressed={wiring}
        className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold transition-colors ${
          wiring
            ? 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
        }`}
      >
        <svg {...iconProps} width={13} height={13}>
          <path d="M4 6h4a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4h4" />
          <circle cx="3" cy="6" r="1.6" />
          <circle cx="21" cy="18" r="1.6" />
          {!wiring && <path d="M3 21 21 3" />}
        </svg>
        Routing
      </button>

      <span className="mx-1 h-5 w-px bg-slate-200" />

      <ZoomButton title="Reset view" onClick={() => fitView({ ...INITIAL_FIT, duration: 250 })}>
        <svg {...iconProps} width={14} height={14}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0 0V3m0 5h5" />
        </svg>
      </ZoomButton>
      <ZoomButton title="Fit view" onClick={() => fitView(FIT_VIEW_OPTIONS)}>
        <svg {...iconProps} width={14} height={14}>
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </ZoomButton>
      </div>
    </Panel>
  )
}

function FlowCanvasInner() {
  const play = useOrchestration((s) => s.play)
  const selectedNodeId = useOrchestration((s) => s.selectedNodeId)
  const selectNode = useOrchestration((s) => s.selectNode)
  const experiences = useExperience((s) => s.experiences)
  const collapsedFlows = useOrchestration((s) => s.collapsedFlows)
  const closeAnnotation = useOrchestration((s) => s.closeAnnotation)

  const paneRef = useRef<HTMLDivElement>(null)

  const { hovered, setHovered } = useHoveredStep()
  const { hotPort, setHotPort } = useHotPort()
  const [wiring, setWiring] = useState(true)
  const [connection, setConnection] = useState<ConnectionTarget | null>(null)

  // Focus mode is a layer over this one, not a state of it: the graph is the
  // same graph whether or not a card is open, which is why coming back out of a
  // card lands exactly where the merchant left, with no viewport to restore.
  const { nodes, edges: graphEdges, flowLayouts } = useMemo(
    () => buildFlowGraph({ play, experiences, collapsedFlows, selectedNodeId }),
    [play, experiences, collapsedFlows, selectedNodeId],
  )

  // Pointing at a reason row lifts its wires and pushes the other routes back.
  // Applied here rather than in `buildFlowGraph` so that hovering never rebuilds
  // the graph: the layout is the same layout, with two classes on some edges.
  const edges = useMemo(() => {
    if (!hotPort) return graphEdges
    return graphEdges.map((e) => {
      if (!e.className?.includes('mapping-link')) return e
      const hot = e.sourceHandle === hotPort
      return {
        ...e,
        className: `${e.className} ${hot ? 'link-hot' : 'link-cold'}`,
        // The chip lives in the label layer, outside this edge's group, so it
        // cannot inherit the class — it is told directly instead.
        data: { ...e.data, hot, cold: !hot },
      }
    })
  }, [graphEdges, hotPort])

  const onPaneClick = useCallback(() => {
    selectNode(null)
    closeAnnotation()
    setConnection(null)
  }, [selectNode, closeAnnotation])

  /**
   * A connector is the routing rule made visible, so clicking one opens that
   * rule. The popover lands in the screen-space layer at the click, which is why
   * the wire no longer needs a DOM-measured anchor to hang an editor off.
   */
  const onEdgeClick = useCallback<NonNullable<ComponentProps<typeof ReactFlow>['onEdgeClick']>>(
    (event, edge) => {
      const link = edge.data as { expId?: string; optId?: string } | undefined
      if (!link?.expId || !link.optId) return
      const box = paneRef.current?.getBoundingClientRect()
      event.stopPropagation()
      setConnection({
        expId: link.expId,
        optId: link.optId,
        x: event.clientX - (box?.left ?? 0),
        y: event.clientY - (box?.top ?? 0),
      })
    },
    [],
  )

  const surface = (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={INITIAL_FIT}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      zoomOnDoubleClick={false}
      selectionOnDrag={false}
      proOptions={{ hideAttribution: true }}
      onPaneClick={onPaneClick}
      onEdgeClick={onEdgeClick}
      className={wiring ? 'bg-slate-100' : 'wiring-off bg-slate-100'}
      // Wire weights are screen pixels applied by CSS (non-scaling strokes), but
      // the numbers still belong to the token file, so they are handed over here
      // rather than written twice.
      style={
        {
          '--wire-w': WIRE_W,
          '--step-wire-w': STEP_WIRE_W,
          '--link-w': LINK_W,
          '--link-w-hot': LINK_W_HOT,
        } as CSSProperties
      }
    >
      <CanvasBackground />
      <MiniMap
        pannable
        zoomable
        nodeColor={minimapNodeColor}
        nodeStrokeWidth={0}
        // Clears the zoom bar, which now sits below it rather than beside it.
        className="!m-4 !mb-[60px] !h-[132px] !w-[188px] !rounded-xl !border !border-slate-200 !bg-white/95 !shadow-sm"
        maskColor="rgba(226, 232, 240, 0.7)"
      />
      {/* Add palette is authoring chrome — the file owns structure now. */}
      <ZoomControlsPanel wiring={wiring} onToggleWiring={() => setWiring((w) => !w)} />
      <CanvasAnchor />
      <FocusAutoPan />
      <CanvasTestHook />
    </ReactFlow>
  )

  return (
    <StepChromeProvider onChange={setHovered}>
      <HotPortProvider onChange={setHotPort}>
      <div ref={paneRef} className="relative h-full w-full">
        {surface}
        {/* A sibling of the canvas rather than a child of it, so nothing in here
            can be caught by the transform. It projects world points itself. */}
        <StepChromeLayer
          layouts={flowLayouts}
          hoveredStepId={hovered}
          onHover={setHovered}
          connection={connection}
          onCloseConnection={() => setConnection(null)}
        />
      </div>
      </HotPortProvider>
    </StepChromeProvider>
  )
}

export function FlowCanvas() {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <FlowCanvasInner />
      </ReactFlowProvider>
    </div>
  )
}

export type { OrchestrationNodeData }
