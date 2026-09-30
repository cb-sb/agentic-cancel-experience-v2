import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SButton, SIcon, type SIconName } from '@chargebee/sting-react'
import { StatusChip } from '../layout/StatusChip'
import type { SampleSubscriber } from '../play/resolve'
import { markTested, setMark } from '../setup/useSetupState'
import { useJourney } from '../store/useJourney'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { openTab } from '../workspace/paneTabs'
import { fileOfThread, orderedThreads, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { openExperience, openPlay } from './navigate'
import { nodeTypes, type CardData, type Tone } from './PlayCanvas'
import { fmt, population, POPULATION_SIZE } from './population'
import { audienceText, overlaps, resolveWorkspace, variantShare, type WorkspaceEntry, type WorkspaceRun } from './resolve'
import { SubscriberPicker } from './TestDrawer'
import { variantLetter, type CancelPlay } from './types'
import { useRankedPlays } from './usePlays'
import { logSession, markWalked, useTestSessions } from './useTestSessions'

const DRAG = 'application/x-cancel-play'
type View = 'order' | 'canvas'
type Mode = 'draft' | 'live'

const SHELL: Record<string, { label: string; icon: SIconName }> = {
  modal: { label: 'Modal', icon: 'layers' },
  fullpage: { label: 'Full page', icon: 'file-text' },
  fullpage_scroll: { label: 'Full page, continuous', icon: 'list-ordered' },
}

function move(ids: string[], from: number, to: number): string[] {
  const next = [...ids]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

function commitOrder(ids: string[]) {
  useCancelSettings.getState().setPriority(ids)
  for (const id of ids) setMark(id, 'priority', 'done', 'order')
}

function useTitleOf() {
  const threads = useWorkspace((s) => s.threads)
  return (id: string) => threads.find((t) => t.id === id)?.title ?? 'an experience'
}

/** The page layouts a play's experiences use, for the tags on its row. */
function useShells(ranked: CancelPlay[]): Map<string, string[]> {
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const activeFile = useJourney((s) => s.file)
  return useMemo(() => {
    const out = new Map<string, string[]>()
    for (const p of ranked) {
      const shells = p.variants
        .map((v) => {
          const t = threads.find((x) => x.id === v.experienceId)
          return t ? (t.id === activeId ? activeFile : fileOfThread(t)).shell : undefined
        })
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
      out.set(p.id, [...new Set(shells)])
    }
    return out
  }, [ranked, threads, activeId, activeFile])
}

function Tag({ icon, children }: { icon: SIconName; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-[200px] flex-none items-center gap-[4px] rounded-md border border-slate-200 bg-slate-50 px-[6px] py-[2px] text-[11.5px] font-medium text-slate-600">
      <SIcon name={icon} size={11} className="flex-none text-slate-400" />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** A fixed step before or after the plays: it has no rank and can't be moved. */
function PinnedRow({ icon, title, detail, children }: { icon: SIconName; title: string; detail: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-[12px]">
      <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400">
        <SIcon name={icon} size={15} />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-[16px] rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-[16px] py-[12px]">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-slate-900">{title}</div>
          <div className="truncate text-[12px] text-slate-500">{detail}</div>
        </div>
        {children}
      </div>
    </li>
  )
}

function OrderList({ ranked }: { ranked: CancelPlay[] }) {
  const ids = ranked.map((p) => p.id)
  const warn = useMemo(() => new Map(overlaps(ranked).map((o) => [o.playId, o.coveredBy])), [ranked])
  const shells = useShells(ranked)
  const globalControl = useCancelSettings((s) => s.globalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const threads = useWorkspace((s) => s.threads)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  return (
    <ol className="flex flex-col gap-[8px]">
      <PinnedRow icon="shield" title="Global control" detail="Held back before any play is checked. They cancel with no cancel page.">
        <input
          type="range"
          min={0}
          max={30}
          value={globalControl}
          onChange={(e) => useCancelSettings.getState().setGlobalControl(Number(e.target.value))}
          aria-label="Global control"
          className="w-[140px] flex-none accent-slate-800"
        />
        <span className="w-[32px] flex-none text-right text-[12.5px] font-medium tabular-nums text-slate-700">{globalControl === 0 ? 'Off' : `${globalControl}%`}</span>
      </PinnedRow>

      {ranked.map((p, i) => {
        const cover = warn.get(p.id)
        const coverPlay = cover ? ranked.find((x) => x.id === cover) : undefined
        return (
          <li
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG, p.id)
              e.dataTransfer.effectAllowed = 'move'
              setDrag(i)
            }}
            onDragEnd={() => {
              setDrag(null)
              setOver(null)
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAG)) return
              e.preventDefault()
              setOver(i)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (drag !== null && drag !== i) commitOrder(move(ids, drag, i))
              setDrag(null)
              setOver(null)
            }}
            className={`group flex items-center gap-[12px] ${drag === i ? 'opacity-50' : ''}`}
          >
            <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-[13px] font-semibold tabular-nums text-slate-600">
              {i + 1}
            </span>
            <div
              className={`relative min-w-0 flex-1 cursor-grab rounded-xl border bg-white transition-[border-color,box-shadow] active:cursor-grabbing ${
                over === i && drag !== i ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
              }`}
            >
              <div className="flex items-center gap-[10px] py-[13px] pl-[18px] pr-[12px]">
                <SIcon name="grip-vertical" size={13} className="absolute left-[3px] top-[18px] text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
                <button type="button" onClick={() => openPlay(p.id)} className="flex min-w-0 flex-1 items-center gap-[8px] text-left">
                  <span className="truncate text-[14px] font-semibold text-slate-900 hover:underline">{p.name}</span>
                  <StatusChip live={p.status === 'live'} />
                </button>
                <div className="flex flex-none items-center gap-[6px]">
                  <Tag icon="users">{audienceText(p.audience)}</Tag>
                  {(shells.get(p.id) ?? []).map((s) => (
                    <Tag key={s} icon={SHELL[s]?.icon ?? 'layers'}>
                      {SHELL[s]?.label ?? s}
                    </Tag>
                  ))}
                  <Tag icon="split">
                    {p.variants.length} variant{p.variants.length === 1 ? '' : 's'}
                  </Tag>
                </div>
                <div className="flex flex-none items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => commitOrder(move(ids, i, i - 1))} className="rounded p-[1px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                    <SIcon name="chevron-up" size={13} />
                  </button>
                  <button type="button" aria-label={`Move ${p.name} down`} disabled={i === ranked.length - 1} onClick={() => commitOrder(move(ids, i, i + 1))} className="rounded p-[1px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                    <SIcon name="chevron-down" size={13} />
                  </button>
                </div>
              </div>
              {coverPlay && (
                <div className="mx-[12px] mb-[12px] flex items-center gap-[8px] rounded-lg bg-amber-50 px-[10px] py-[7px] text-[12px] text-amber-800">
                  <SIcon name="triangle-alert" size={13} className="flex-none" />
                  <span className="min-w-0 flex-1">Nobody reaches this play. {coverPlay.name} is above it and already covers everyone it would.</span>
                  <button
                    type="button"
                    onClick={() => commitOrder(move(ids, i, ranked.indexOf(coverPlay)))}
                    className="flex-none rounded-md bg-white px-[8px] py-[3px] font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
                  >
                    Move up
                  </button>
                </div>
              )}
            </div>
          </li>
        )
      })}
      {ranked.length === 0 && <li className="rounded-xl border border-dashed border-slate-200 px-[16px] py-[14px] text-[13px] text-slate-500">No plays yet.</li>}

      <PinnedRow icon="corner-down-right" title="If no play matches" detail="What people get when they qualify for none of the plays above.">
        <select
          value={fallbackId ?? ''}
          onChange={(e) => useCancelSettings.getState().setGlobalFallback(e.target.value || null)}
          aria-label="Fallback"
          className="h-[32px] w-[220px] flex-none rounded-lg border border-slate-200 bg-white px-[8px] text-[13px] outline-none focus:border-slate-400"
        >
          <option value="">No cancel page</option>
          {orderedThreads(threads).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </PinnedRow>
    </ol>
  )
}

interface OrderCounts {
  globalHeld: number
  reached: Record<string, number>
  control: Record<string, number>
  byVariant: Record<string, number>
  none: number
}

/** Who ends up where, out of recent cancel clicks. Live leaves drafts out of the order. */
function orderCounts(ranked: CancelPlay[], globalControl: number, mode: Mode): OrderCounts {
  const order = mode === 'live' ? ranked.filter((p) => p.status === 'live') : ranked
  const out: OrderCounts = { globalHeld: 0, reached: {}, control: {}, byVariant: {}, none: 0 }
  for (const sub of population()) {
    const ws = resolveWorkspace(order, sub, globalControl, null, true)
    if (ws.globalHeld) out.globalHeld++
    else if (!ws.winner) out.none++
    else {
      const id = ws.winner.play.id
      out.reached[id] = (out.reached[id] ?? 0) + 1
      const o = ws.winner.run.outcome
      if (o.kind === 'play_control') out.control[id] = (out.control[id] ?? 0) + 1
      if (o.kind === 'variant') out.byVariant[o.variantId] = (out.byVariant[o.variantId] ?? 0) + 1
    }
  }
  return out
}

const COL = 330

function buildGraph(
  ranked: CancelPlay[],
  opts: { globalControl: number; fallback: string; titleOf: (id: string) => string; counts: OrderCounts | null; mode: Mode; run: WorkspaceRun | null; drafts: boolean },
): { nodes: Node<CardData>[]; edges: Edge[] } {
  const { globalControl, counts, run } = opts
  const c = (n: number | undefined) => (counts ? fmt(n ?? 0) : undefined)
  const nodes: Node<CardData>[] = []
  const edges: Edge[] = []
  const edge = (source: string, target: string, lit: boolean, extra: Partial<Edge> = {}) =>
    edges.push({
      id: `${source}-${target}`,
      source,
      target,
      type: 'smoothstep',
      animated: lit,
      style: { stroke: lit ? '#6366f1' : '#cbd5e1', strokeWidth: lit ? 2.5 : 1.5 },
      labelStyle: { fontSize: 11, fill: '#64748b', fontWeight: 500 },
      labelBgStyle: { fill: '#f8fafc' },
      labelBgPadding: [4, 2] as [number, number],
      ...extra,
    })

  const held = Boolean(run?.globalHeld)
  const winnerIdx = run?.winner ? ranked.indexOf(run.winner.play) : -1
  const reachedIdx = run ? (held ? -1 : winnerIdx >= 0 ? winnerIdx : ranked.length) : -1

  nodes.push({
    id: 'start',
    type: 'card',
    position: { x: 0, y: 0 },
    data: { icon: 'mouse-pointer-click', eyebrow: 'Start', title: 'Subscriber clicks Cancel', count: c(POPULATION_SIZE), tone: run ? 'path' : 'default', width: 220 },
  })
  nodes.push({
    id: 'global',
    type: 'card',
    position: { x: COL, y: 0 },
    data: {
      icon: 'shield',
      eyebrow: 'Global control',
      title: globalControl === 0 ? 'Off' : `${globalControl}% held back`,
      detail: 'Before any play is checked',
      tone: run ? (held ? 'stop' : 'path') : 'default',
      reason: run ? (held ? 'In the global control group' : 'Not held back') : undefined,
      width: 220,
    },
  })
  edge('start', 'global', Boolean(run))
  if (globalControl > 0) {
    nodes.push({
      id: 'global-out',
      type: 'card',
      position: { x: COL, y: 210 },
      data: { icon: 'circle-slash', eyebrow: 'Outcome', title: 'Cancels with no cancel page', count: c(counts?.globalHeld), tone: run ? (held ? 'stop' : 'muted') : 'default', width: 220 },
    })
    edge('global', 'global-out', held, { sourceHandle: 'side', targetHandle: 'top' })
  }

  let prev = 'global'
  ranked.forEach((p, i) => {
    const id = `play-${p.id}`
    const entry = run?.entries.find((e) => e.play.id === p.id)
    const skipped = (opts.mode === 'live' && !run && p.status !== 'live') || (run && entry && !entry.counts)
    const isWinner = run?.winner?.play.id === p.id
    const checked = run && !held && i <= reachedIdx
    let tone: Tone = 'default'
    let reason: string | undefined
    if (run) {
      if (held || i > reachedIdx) tone = 'muted'
      else if (skipped) {
        tone = 'muted'
        reason = 'Draft, so it isn’t checked'
      } else if (isWinner) {
        tone = 'path'
        reason = 'Qualifies. This play takes them'
      } else {
        tone = 'default'
        reason = entry?.run.trace.find((t) => t.node === 'audience')?.reason ?? 'Doesn’t qualify'
      }
    } else if (skipped) tone = 'muted'
    nodes.push({
      id,
      type: 'card',
      position: { x: COL * (2 + i), y: 0 },
      data: {
        icon: 'workflow',
        eyebrow: `${i + 1} · ${p.status === 'live' ? 'Live' : 'Draft'}`,
        title: p.name,
        detail: audienceText(p.audience),
        count: counts ? (skipped ? '0' : c(counts.reached[p.id])) : undefined,
        tone,
        reason,
        width: 240,
        onOpen: () => openPlay(p.id),
        openLabel: 'Open play',
      },
    })
    edge(prev, id, Boolean(checked), prev === 'global' ? {} : { label: 'Doesn’t qualify' })
    prev = id

    const chosen = isWinner && run?.winner?.run.outcome.kind === 'variant' ? run.winner.run.outcome.variantId : null
    const inControl = isWinner && run?.winner?.run.outcome.kind === 'play_control'
    nodes.push({
      id: `${id}-gets`,
      type: 'card',
      position: { x: COL * (2 + i), y: 210 },
      data: {
        icon: 'layout-template',
        eyebrow: 'They get',
        title: p.variants.length === 0 ? 'Nothing yet' : p.variants.length === 1 ? opts.titleOf(p.variants[0].experienceId) : `${p.variants.length} variants`,
        count: counts && p.variants.length === 1 && p.control === 0 ? fmt(counts.byVariant[p.variants[0].id] ?? 0) : undefined,
        tone: run ? (isWinner ? 'path' : 'muted') : skipped ? 'muted' : 'default',
        width: 240,
        body:
          p.variants.length > 1 || p.control > 0 ? (
            <ul className="mt-[6px] space-y-[3px]">
              {p.variants.map((v, n) => (
                <li
                  key={v.id}
                  className={`flex items-center gap-[6px] rounded-md px-[5px] py-[2px] text-[11.5px] ${chosen === v.id ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-600'}`}
                >
                  <span className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded bg-slate-100 text-[9.5px] font-bold text-slate-600">{variantLetter(n)}</span>
                  <span className="min-w-0 flex-1 truncate">{opts.titleOf(v.experienceId)}</span>
                  <span className="flex-none tabular-nums text-slate-400">{counts ? fmt(counts.byVariant[v.id] ?? 0) : variantShare(p, v)}</span>
                </li>
              ))}
              {p.control > 0 && (
                <li className={`flex items-center gap-[6px] rounded-md px-[5px] py-[2px] text-[11.5px] ${inControl ? 'bg-amber-50 font-semibold text-amber-700' : 'text-slate-500'}`}>
                  <SIcon name="flask-conical" size={11} className="flex-none" />
                  <span className="min-w-0 flex-1 truncate">{p.control}% control, no cancel page</span>
                  {counts && <span className="flex-none tabular-nums text-slate-400">{fmt(counts.control[p.id] ?? 0)}</span>}
                </li>
              )}
            </ul>
          ) : undefined,
      },
    })
    edge(id, `${id}-gets`, Boolean(isWinner), { sourceHandle: 'side', targetHandle: 'top', label: 'Qualifies' })
  })

  const noneReached = Boolean(run && !held && !run.winner)
  nodes.push({
    id: 'fallback',
    type: 'card',
    position: { x: COL * (2 + ranked.length), y: 0 },
    data: {
      icon: 'corner-down-right',
      eyebrow: 'If no play matches',
      title: opts.fallback,
      count: c(counts?.none),
      tone: run ? (noneReached ? 'stop' : 'muted') : 'default',
      reason: noneReached ? 'No play took them' : undefined,
      width: 220,
    },
  })
  edge(prev, 'fallback', noneReached, prev === 'global' ? {} : { label: 'Doesn’t qualify' })
  return { nodes, edges }
}

function entryLine(e: WorkspaceEntry, winner: WorkspaceEntry | null, titleOf: (id: string) => string): { tone: 'win' | 'shadow' | 'out' | 'off'; text: string } {
  if (!e.counts) return { tone: 'off', text: 'Draft, so it isn’t checked. Turn on drafts to include it.' }
  if (e.run.outcome.kind === 'outside') return { tone: 'out', text: `Doesn’t match. ${e.run.trace.find((t) => t.node === 'audience')?.reason ?? ''}` }
  if (e.shadowed && winner) return { tone: 'shadow', text: `Qualifies, but ${winner.play.name} goes first.` }
  switch (e.run.outcome.kind) {
    case 'play_control':
      return { tone: 'win', text: 'Wins, and lands in its control group. No cancel page.' }
    case 'no_variant':
      return { tone: 'win', text: 'Wins, but has nothing to show them yet.' }
    case 'variant':
      return { tone: 'win', text: `Wins. They see Variant ${e.run.outcome.letter}, ${titleOf(e.run.outcome.experienceId)}.` }
    default:
      return { tone: 'out', text: '' }
  }
}

const LINE_TONE = {
  win: { icon: 'trophy' as const, cls: 'border-indigo-300 bg-indigo-50', text: 'text-indigo-800' },
  shadow: { icon: 'circle-dashed' as const, cls: 'border-slate-200 bg-white', text: 'text-slate-600' },
  out: { icon: 'circle-x' as const, cls: 'border-slate-200 bg-white', text: 'text-slate-500' },
  off: { icon: 'circle-slash' as const, cls: 'border-slate-200 bg-slate-50', text: 'text-slate-400' },
}

function ago(at: number): string {
  const m = Math.round((Date.now() - at) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

/** Pick a subscriber and watch which play takes them. None of this reaches reporting. */
function OrderTestDrawer({ ranked, onRun, onClose }: { ranked: CancelPlay[]; onRun: (r: WorkspaceRun | null) => void; onClose: () => void }) {
  const globalControl = useCancelSettings((s) => s.globalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const allSessions = useTestSessions((s) => s.sessions)
  const sessions = useMemo(() => allSessions.filter((x) => x.playId === null).slice(0, 6), [allSessions])
  const titleOf = useTitleOf()
  const [sub, setSub] = useState<SampleSubscriber | null>(null)
  const [drafts, setDrafts] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const result = useMemo(() => (sub ? resolveWorkspace(ranked, sub, globalControl, fallbackId, drafts) : null), [sub, ranked, globalControl, fallbackId, drafts])

  useEffect(() => {
    onRun(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  useEffect(() => {
    if (!result || !sub) return
    if (result.winner) markTested(result.winner.play.id)
    const text = result.globalHeld
      ? 'Held back by global control'
      : result.winner
        ? `${result.winner.play.name}. ${entryLine(result.winner, result.winner, titleOf).text}`
        : fallbackId
          ? `No play matched. Fallback: ${titleOf(fallbackId)}`
          : 'No play matched. No cancel page.'
    setSessionId(logSession({ playId: null, subscriberId: sub.id, subscriberName: sub.name, result: text, forced: false, walked: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id, drafts])

  const outcome = result?.winner?.run.outcome
  const walk = () => {
    if (!result?.winner || outcome?.kind !== 'variant') return
    if (sessionId) markWalked(sessionId)
    openExperience(outcome.experienceId, result.winner.play.id)
    useWorkspaceUi.setState({ previewAs: '' })
    openTab('preview')
  }

  const ordered = result ? [...result.entries].sort((a, b) => (a === result.winner ? -1 : b === result.winner ? 1 : 0)) : []

  return (
    <aside aria-label="Test the play order" className="flex h-full w-[340px] flex-none flex-col border-l border-slate-200 bg-white">
      <header className="flex items-center gap-[8px] border-b border-slate-100 px-[14px] py-[10px]">
        <SIcon name="flask-conical" size={14} className="text-slate-500" />
        <h3 className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-900">Test with a subscriber</h3>
        <button type="button" onClick={onClose} aria-label="Close test" className="rounded-lg p-[4px] text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <SIcon name="x" size={14} />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-[16px] overflow-y-auto px-[14px] py-[12px]">
        <SubscriberPicker selected={sub} onPick={setSub} />
        <label className="flex items-center gap-[8px] text-[12.5px] text-slate-600">
          <input type="checkbox" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} className="accent-slate-800" />
          Include draft plays
        </label>

        {result && sub && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-[12px]">
            <p className="text-[13px] font-semibold text-slate-900">{sub.name}</p>
            <p className="text-[12px] text-slate-500">{sub.summary}</p>
            {result.globalHeld ? (
              <p className="mt-[8px] text-[12.5px] text-slate-700">In the {globalControl}% global control. No play is checked, and they cancel with no cancel page.</p>
            ) : (
              <>
                <ul className="mt-[10px] space-y-[6px]">
                  {ordered.map((e) => {
                    const line = entryLine(e, result.winner, titleOf)
                    const t = LINE_TONE[e === result.winner ? 'win' : line.tone]
                    return (
                      <li key={e.play.id} className={`flex items-start gap-[8px] rounded-xl border px-[10px] py-[7px] ${t.cls}`}>
                        <SIcon name={t.icon} size={14} className={`mt-[1px] flex-none ${t.text}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-[6px]">
                            <span className="truncate text-[12.5px] font-semibold text-slate-900">{e.play.name}</span>
                            <span className="flex-none text-[11px] text-slate-400">#{ranked.indexOf(e.play) + 1}</span>
                          </div>
                          <p className={`text-[12px] ${t.text}`}>{line.text}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {!result.winner && (
                  <p className="mt-[8px] text-[12.5px] text-slate-600">
                    No play takes them. {fallbackId ? `They get the fallback, ${titleOf(fallbackId)}.` : 'There’s no fallback, so they cancel with no cancel page.'}
                  </p>
                )}
              </>
            )}
            {outcome?.kind === 'variant' && (
              <SButton size="small" variant="primary" className="mt-[12px] w-full" onClick={walk}>
                Walk it as {sub.name}
              </SButton>
            )}
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recent tests</h4>
            <span className="text-[11px] text-slate-400">Not counted in reporting</span>
          </div>
          <ul className="mt-[6px] space-y-[4px]">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-100 px-[10px] py-[6px] text-[12px]">
                <div className="flex items-center gap-[6px]">
                  <span className="font-medium text-slate-800">{s.subscriberName}</span>
                  {s.walked && <span className="rounded-full bg-indigo-50 px-[6px] text-[10.5px] text-indigo-600">Walked</span>}
                  <span className="ml-auto text-[11px] text-slate-400">{ago(s.at)}</span>
                </div>
                <p className="mt-[2px] truncate text-slate-500">{s.result}</p>
              </li>
            ))}
            {sessions.length === 0 && <li className="text-[12px] text-slate-500">No tests yet.</li>}
          </ul>
        </section>
      </div>
    </aside>
  )
}

function OrderCanvas({ ranked }: { ranked: CancelPlay[] }) {
  const globalControl = useCancelSettings((s) => s.globalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const titleOf = useTitleOf()
  const [mode, setMode] = useState<Mode>('draft')
  const [showCounts, setShowCounts] = useState(true)
  const [testing, setTesting] = useState(false)
  const [run, setRun] = useState<WorkspaceRun | null>(null)
  const counts = useMemo(() => (showCounts ? orderCounts(ranked, globalControl, mode) : null), [showCounts, ranked, globalControl, mode])
  const graph = useMemo(
    () =>
      buildGraph(ranked, {
        globalControl,
        fallback: fallbackId ? titleOf(fallbackId) : 'No cancel page',
        titleOf,
        counts,
        mode,
        run: testing ? run : null,
        drafts: true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ranked, globalControl, fallbackId, counts, mode, testing, run],
  )
  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="relative min-w-0 flex-1 bg-slate-50">
        <ReactFlowProvider>
          <ReactFlow
            key={`${ranked.map((p) => p.id).join('|')}-${testing}`}
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
                Out of {fmt(POPULATION_SIZE)} recent cancel clicks{mode === 'draft' ? ', if every draft went live' : ', live plays only'}
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
        <OrderTestDrawer
          ranked={ranked}
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

function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { id: View; label: string; icon: SIconName }[] = [
    { id: 'order', label: 'Order', icon: 'list-ordered' },
    { id: 'canvas', label: 'Canvas', icon: 'workflow' },
  ]
  return (
    <div role="tablist" aria-label="View" className="flex flex-none items-center rounded-lg border border-slate-200 bg-white p-[2px]">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={view === o.id}
          onClick={() => onChange(o.id)}
          className={`flex h-[28px] items-center gap-[6px] rounded-md px-[10px] text-[12.5px] font-medium transition-colors ${
            view === o.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <SIcon name={o.icon} size={13} />
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The order plays are checked in, with the steps before and after them, and a canvas to test it. */
export function PlayOrder() {
  const ranked = useRankedPlays()
  const [view, setView] = useState<View>('order')
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-slate-50">
      <header className={`flex-none ${view === 'canvas' ? 'border-b border-slate-200 bg-white' : ''}`}>
        <div className={`flex items-end justify-between gap-[16px] px-[28px] ${view === 'canvas' ? 'py-[14px]' : 'mx-auto max-w-[900px] pb-[4px] pt-[24px]'}`}>
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold text-slate-900">Play order and testing</h1>
            <p className="mt-[4px] text-[13px] text-slate-500">
              When someone clicks Cancel, plays are checked from the top and the first one they qualify for wins. New plays start at the bottom.
            </p>
          </div>
          <ViewSwitch view={view} onChange={setView} />
        </div>
      </header>
      {view === 'order' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[900px] px-[28px] pb-[32px] pt-[16px]">
            <OrderList ranked={ranked} />
          </div>
        </div>
      ) : (
        <OrderCanvas ranked={ranked} />
      )}
    </div>
  )
}
