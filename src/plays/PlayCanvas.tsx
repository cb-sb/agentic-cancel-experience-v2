import { useMemo, useState, type ReactNode } from 'react'
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SButton, SIcon, type SIconName } from '@chargebee/sting-react'
import type { JourneyStepKind } from '../journey/types'
import { offerVariantLabel } from '../lib/offerVariants'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { fileOfThread, threadIsLive, useWorkspace } from '../workspace/useWorkspace'
import { fmt, playCounts, POPULATION_SIZE, type PlayCounts } from './population'
import { audienceText, variantShare, type PlayRun, type TraceStep } from './resolve'
import { variantLetter, type CancelPlay } from './types'
import { useRankedPlays } from './usePlays'
import { TestDrawer } from './TestDrawer'
import { openExperience } from './navigate'

const STEP_LABEL: Record<JourneyStepKind, string> = {
  loss_aversion: 'Loss aversion',
  survey: 'Survey',
  offer: 'Offer',
  pricing_table: 'Plan picker',
  checkout: 'Checkout',
  confirmation: 'Confirm',
  outcome_saved: 'Saved',
  outcome_cancelled: 'Cancelled',
}

export type Tone = 'default' | 'path' | 'stop' | 'muted'

export interface CardData extends Record<string, unknown> {
  icon: SIconName
  eyebrow: string
  title: string
  detail?: string
  count?: string
  tone: Tone
  reason?: string
  side?: boolean
  body?: ReactNode
  onOpen?: () => void
  openLabel?: string
  width?: number
}

const TONE: Record<Tone, string> = {
  default: 'border-slate-200 bg-white',
  path: 'border-indigo-400 bg-white ring-4 ring-indigo-100',
  stop: 'border-amber-400 bg-amber-50/60 ring-4 ring-amber-100',
  muted: 'border-slate-200 bg-slate-50 opacity-60',
}

export function CardNode({ data }: NodeProps<Node<CardData>>) {
  return (
    <div style={{ width: data.width ?? 220 }} className={`rounded-2xl border px-[12px] py-[10px] shadow-sm transition-all ${TONE[data.tone]}`}>
      <Handle type="target" position={Position.Left} className="!h-[6px] !w-[6px] !border-0 !bg-transparent !opacity-0" />
      <Handle type="source" position={Position.Right} className="!h-[6px] !w-[6px] !border-0 !bg-transparent !opacity-0" />
      <Handle id="side" type="source" position={Position.Bottom} className="!h-[6px] !w-[6px] !border-0 !bg-transparent !opacity-0" />
      <Handle id="top" type="target" position={Position.Top} className="!h-[6px] !w-[6px] !border-0 !bg-transparent !opacity-0" />
      <div className="flex items-center gap-[6px] text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        <SIcon name={data.icon} size={12} className="flex-none" />
        <span className="min-w-0 flex-1 truncate">{data.eyebrow}</span>
        {data.count && (
          <span title="Who sees this, out of recent cancel clicks" className="flex-none rounded-full bg-slate-100 px-[6px] py-[1px] text-[10.5px] font-semibold normal-case tracking-normal tabular-nums text-slate-600">
            {data.count}
          </span>
        )}
      </div>
      <div className="mt-[4px] text-[13.5px] font-semibold leading-snug text-slate-900">{data.title}</div>
      {data.detail && <div className="mt-[2px] text-[12px] leading-snug text-slate-500">{data.detail}</div>}
      {data.body}
      {data.reason && (
        <div className={`mt-[8px] rounded-lg px-[8px] py-[5px] text-[11.5px] leading-snug ${data.tone === 'stop' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>{data.reason}</div>
      )}
      {data.onOpen && (
        <button type="button" onClick={data.onOpen} className="nodrag mt-[8px] inline-flex items-center gap-[4px] text-[12px] font-semibold text-indigo-600 hover:underline">
          {data.openLabel ?? 'Open experience'} <SIcon name="arrow-right" size={11} />
        </button>
      )}
    </div>
  )
}

export const nodeTypes = { card: CardNode }

const COL = 270

interface VariantInfo {
  id: string
  experienceId: string
  letter: string
  title: string
  steps: string[]
  live: boolean
}

function useVariantInfo(play: CancelPlay): VariantInfo[] {
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const activeFile = useJourney((s) => s.file)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  return play.variants.map((v, i) => {
    const t = threads.find((x) => x.id === v.experienceId)
    const file = t ? (t.id === activeId ? activeFile : fileOfThread(t)) : null
    const steps = (file?.steps ?? []).map((s) => (s.kind === 'offer' ? offerVariantLabel(s.offer ?? 'discount') : STEP_LABEL[s.kind]))
    return {
      id: v.id,
      experienceId: v.experienceId,
      letter: variantLetter(i),
      title: t?.title ?? 'Missing experience',
      steps,
      live: t ? threadIsLive(t, activeId, activeLive) : false,
    }
  })
}

function traceOf(run: PlayRun | null, node: TraceStep['node']): TraceStep | undefined {
  return run?.trace.find((t) => t.node === node)
}

function tone(run: PlayRun | null, node: TraceStep['node']): Tone {
  if (!run) return 'default'
  const t = traceOf(run, node)
  if (!t) return 'muted'
  return t.passed ? 'path' : 'stop'
}

function build(play: CancelPlay, variants: VariantInfo[], globalControl: number, counts: PlayCounts | null, run: PlayRun | null): { nodes: Node<CardData>[]; edges: Edge[] } {
  const c = (n: number) => (counts ? fmt(n) : undefined)
  const nodes: Node<CardData>[] = []
  const edges: Edge[] = []
  const passed = (node: TraceStep['node']) => Boolean(traceOf(run, node)?.passed)
  const edge = (source: string, target: string, opts: Partial<Edge> = {}, lit = false) =>
    edges.push({
      id: `${source}-${target}`,
      source,
      target,
      type: 'smoothstep',
      animated: lit,
      style: { stroke: lit ? '#6366f1' : '#cbd5e1', strokeWidth: lit ? 2.5 : 1.5 },
      ...opts,
    })

  nodes.push({
    id: 'trigger',
    type: 'card',
    position: { x: 0, y: 0 },
    data: { icon: 'mouse-pointer-click', eyebrow: 'Start', title: 'Subscriber clicks Cancel', count: c(POPULATION_SIZE), tone: run ? 'path' : 'default' },
  })
  const g = traceOf(run, 'global')
  nodes.push({
    id: 'global',
    type: 'card',
    position: { x: COL, y: 0 },
    data: {
      icon: 'shield',
      eyebrow: 'Global control',
      title: globalControl === 0 ? 'Off' : `${globalControl}% held back`,
      detail: 'Set once for every play',
      count: counts ? c(counts.clicked - counts.globalHeld) : undefined,
      tone: tone(run, 'global'),
      reason: g?.reason,
    },
  })
  edge('trigger', 'global', {}, Boolean(run))
  if (globalControl > 0) {
    nodes.push({
      id: 'global-out',
      type: 'card',
      position: { x: COL, y: 190 },
      data: { icon: 'circle-slash', eyebrow: 'Outcome', title: 'Cancels with no cancel page', count: c(counts?.globalHeld ?? 0), tone: g && !g.passed ? 'stop' : run ? 'muted' : 'default', width: 200 },
    })
    edge('global', 'global-out', { sourceHandle: 'side', targetHandle: 'top' }, Boolean(g && !g.passed))
  }

  const a = traceOf(run, 'audience')
  nodes.push({
    id: 'audience',
    type: 'card',
    position: { x: COL * 2, y: 0 },
    data: {
      icon: 'users',
      eyebrow: 'Audience',
      title: audienceText(play.audience),
      detail: counts && counts.taken > 0 ? `${fmt(counts.taken)} already taken by plays above this one` : undefined,
      count: c(counts?.inAudience ?? 0),
      tone: tone(run, 'audience'),
      reason: a?.reason,
    },
  })
  edge('global', 'audience', {}, passed('global'))
  nodes.push({
    id: 'outside',
    type: 'card',
    position: { x: COL * 2, y: 190 },
    data: { icon: 'corner-down-right', eyebrow: 'Not in audience', title: 'Next play, or the fallback', count: c(counts?.outside ?? 0), tone: a && !a.passed ? 'stop' : run ? 'muted' : 'default', width: 200 },
  })
  edge('audience', 'outside', { sourceHandle: 'side', targetHandle: 'top' }, Boolean(a && !a.passed))

  const k = traceOf(run, 'control')
  nodes.push({
    id: 'control',
    type: 'card',
    position: { x: COL * 3, y: 0 },
    data: {
      icon: 'flask-conical',
      eyebrow: 'Control group',
      title: play.control === 0 ? 'No control group' : `${play.control}% see no cancel page`,
      detail: play.control > 0 ? 'Measures what the play saves' : undefined,
      count: counts ? c(counts.inAudience - counts.control) : undefined,
      tone: tone(run, 'control'),
      reason: k?.reason,
    },
  })
  edge('audience', 'control', {}, passed('audience'))
  if (play.control > 0) {
    nodes.push({
      id: 'control-out',
      type: 'card',
      position: { x: COL * 3, y: 190 },
      data: { icon: 'circle-slash', eyebrow: 'Control', title: 'Cancels with no cancel page', count: c(counts?.control ?? 0), tone: k && !k.passed ? 'stop' : run ? 'muted' : 'default', width: 200 },
    })
    edge('control', 'control-out', { sourceHandle: 'side', targetHandle: 'top' }, Boolean(k && !k.passed))
  }

  const s = traceOf(run, 'split')
  nodes.push({
    id: 'split',
    type: 'card',
    position: { x: COL * 4, y: 0 },
    data: {
      icon: 'split',
      eyebrow: 'Split',
      title: variants.length <= 1 ? 'Everyone gets one page' : play.splitBy === 'percent' ? 'By percentage' : 'By sub-audience',
      detail: variants.length > 1 ? play.variants.map((v, i) => `${variantLetter(i)} ${variantShare(play, v)}`).join(' · ') : undefined,
      tone: tone(run, 'split'),
      reason: s?.reason,
    },
  })
  edge('control', 'split', {}, passed('control'))

  const chosen = run?.outcome.kind === 'variant' ? run.outcome.variantId : null
  const top = -((variants.length - 1) * 170) / 2
  variants.forEach((v, i) => {
    const pv = play.variants[i]
    const lit = chosen === v.id
    nodes.push({
      id: `v-${v.id}`,
      type: 'card',
      position: { x: COL * 5 + 20, y: top + i * 170 },
      data: {
        icon: 'layout-template',
        eyebrow: `Variant ${v.letter} · ${variantShare(play, pv)}`,
        title: v.title,
        count: c(counts?.byVariant[v.id] ?? 0),
        tone: run ? (lit ? 'path' : 'muted') : 'default',
        width: 260,
        body: (
          <div className="mt-[8px]">
            <div className="flex flex-wrap items-center gap-[3px]">
              {v.steps.map((label, j) => (
                <span key={j} className="flex items-center gap-[3px]">
                  {j > 0 && <SIcon name="chevron-right" size={9} className="text-slate-300" />}
                  <span className="rounded-md bg-slate-100 px-[5px] py-[1px] text-[10.5px] font-medium text-slate-600">{label}</span>
                </span>
              ))}
              {v.steps.length === 0 && <span className="text-[11.5px] text-slate-400">No screens yet</span>}
            </div>
            <div className="mt-[6px] flex items-center gap-[5px] text-[11px] text-slate-500">
              <span className={`h-[6px] w-[6px] rounded-full ${v.live ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              {v.live ? 'Live' : 'Draft'}
            </div>
          </div>
        ),
        onOpen: () => openExperience(v.experienceId, play.id),
      },
    })
    edge('split', `v-${v.id}`, {}, lit)
  })
  if (variants.length === 0) {
    nodes.push({
      id: 'empty',
      type: 'card',
      position: { x: COL * 5 + 20, y: 0 },
      data: { icon: 'plus', eyebrow: 'Variants', title: 'No experiences yet', detail: 'Add one from the left pane, or drag one onto this play', tone: 'muted', width: 240 },
    })
    edge('split', 'empty')
  }
  return { nodes, edges }
}

/** Every variant of a play on one canvas, with who reaches each part. */
export function PlayCanvas({ play }: { play: CancelPlay }) {
  const globalControl = useCancelSettings((s) => s.globalControl)
  const ranked = useRankedPlays()
  const variants = useVariantInfo(play)
  const [mode, setMode] = useState<'draft' | 'live'>('draft')
  const [showCounts, setShowCounts] = useState(true)
  const [testing, setTesting] = useState(false)
  const [run, setRun] = useState<PlayRun | null>(null)

  const counts = useMemo(
    () => (showCounts ? playCounts(play, ranked, globalControl, mode) : null),
    [showCounts, play, ranked, globalControl, mode],
  )
  const graph = useMemo(() => build(play, variants, globalControl, counts, testing ? run : null), [play, variants, globalControl, counts, testing, run])
  const notLive = mode === 'live' && play.status !== 'live'

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <div className="relative min-w-0 flex-1 bg-slate-50">
        <ReactFlowProvider>
          <ReactFlow
            key={`${play.id}-${variants.length}-${testing}`}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            minZoom={0.3}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#d5dae1" />
          </ReactFlow>
        </ReactFlowProvider>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-[8px] p-[12px]">
          <div className="pointer-events-auto flex items-center gap-[8px]">
            <div role="radiogroup" aria-label="Counts for" className="flex rounded-xl border border-slate-200 bg-white p-[2px] shadow-sm">
              {(['draft', 'live'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-[10px] px-[10px] py-[4px] text-[12px] font-semibold ${mode === m ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {m === 'draft' ? 'Draft' : 'Live'}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={showCounts}
              onClick={() => setShowCounts((v) => !v)}
              className={`inline-flex items-center gap-[5px] rounded-xl border px-[10px] py-[5px] text-[12px] font-semibold shadow-sm ${showCounts ? 'border-slate-300 bg-white text-slate-800' : 'border-slate-200 bg-white text-slate-500'}`}
            >
              <SIcon name="users" size={12} /> Who sees this?
            </button>
            {showCounts && (
              <span className="rounded-lg bg-white/80 px-[8px] py-[4px] text-[11.5px] text-slate-500">
                {notLive ? 'This play isn’t live, so nobody reaches it yet.' : `Out of ${fmt(POPULATION_SIZE)} recent cancel clicks${mode === 'draft' ? ', if this draft went live' : ''}`}
              </span>
            )}
          </div>
          {!testing && (
            <SButton size="small" variant="primary" className="pointer-events-auto w-auto" onClick={() => setTesting(true)}>
              <span className="inline-flex items-center gap-[5px]">
                <SIcon name="flask-conical" size={13} /> Test
              </span>
            </SButton>
          )}
        </div>
      </div>
      {testing && (
        <TestDrawer
          play={play}
          onRun={setRun}
          onClose={() => {
            setTesting(false)
            setRun(null)
          }}
        />
      )}
    </div>
  )
}
