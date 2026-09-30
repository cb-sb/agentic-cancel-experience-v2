import { useEffect, useMemo, useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import type { SampleSubscriber } from '../play/resolve'
import { setMark, markTested } from '../setup/useSetupState'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { orderedThreads, useWorkspace } from '../workspace/useWorkspace'
import { openPlay } from './navigate'
import { audienceText, overlaps, resolveWorkspace, type WorkspaceEntry } from './resolve'
import { SubscriberPicker } from './TestDrawer'
import type { CancelPlay } from './types'
import { useRankedPlays } from './usePlays'
import { logSession, useTestSessions } from './useTestSessions'
import { Chip } from './ui'

const DRAG = 'application/x-cancel-play'

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

function OrderList({ ranked }: { ranked: CancelPlay[] }) {
  const ids = ranked.map((p) => p.id)
  const warn = useMemo(() => new Map(overlaps(ranked).map((o) => [o.playId, o.coveredBy])), [ranked])
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  return (
    <ol className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
            className={`group border-b border-slate-100 last:border-b-0 ${over === i && drag !== i ? 'bg-indigo-50' : ''} ${drag === i ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-[10px] px-[12px] py-[10px]">
              <SIcon name="grip-vertical" size={14} className="flex-none cursor-grab text-slate-300" />
              <span className="w-[18px] flex-none text-[13px] font-semibold tabular-nums text-slate-400">{i + 1}</span>
              <button type="button" onClick={() => openPlay(p.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13.5px] font-semibold text-slate-900 hover:underline">{p.name}</span>
                <span className="block truncate text-[12px] text-slate-500">
                  {audienceText(p.audience)} · {p.variants.length} variant{p.variants.length === 1 ? '' : 's'}
                  {p.control > 0 ? ` · ${p.control}% control` : ''}
                </span>
              </button>
              <Chip tone={p.status === 'live' ? 'emerald' : 'amber'}>{p.status === 'live' ? 'Live' : 'Draft'}</Chip>
              <div className="flex flex-none items-center">
                <button type="button" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => commitOrder(move(ids, i, i - 1))} className="rounded p-[3px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                  <SIcon name="chevron-up" size={14} />
                </button>
                <button type="button" aria-label={`Move ${p.name} down`} disabled={i === ranked.length - 1} onClick={() => commitOrder(move(ids, i, i + 1))} className="rounded p-[3px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                  <SIcon name="chevron-down" size={14} />
                </button>
              </div>
            </div>
            {coverPlay && (
              <div className="mx-[12px] mb-[10px] flex items-center gap-[8px] rounded-xl bg-amber-50 px-[10px] py-[7px] text-[12px] text-amber-800">
                <SIcon name="triangle-alert" size={13} className="flex-none" />
                <span className="min-w-0 flex-1">
                  Nobody reaches this play. {coverPlay.name} is above it and already covers everyone it would.
                </span>
                <button
                  type="button"
                  onClick={() => commitOrder(move(ids, i, ranked.indexOf(coverPlay)))}
                  className="flex-none rounded-lg bg-white px-[8px] py-[3px] font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
                >
                  Move up
                </button>
              </div>
            )}
          </li>
        )
      })}
      {ranked.length === 0 && <li className="px-[12px] py-[12px] text-[13px] text-slate-500">No plays yet.</li>}
    </ol>
  )
}

function Globals() {
  const globalControl = useCancelSettings((s) => s.globalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const threads = useWorkspace((s) => s.threads)
  return (
    <div className="grid grid-cols-2 gap-[12px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-[14px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-slate-900">Global control</span>
          <span className="text-[12.5px] tabular-nums text-slate-500">{globalControl === 0 ? 'Off' : `${globalControl}%`}</span>
        </div>
        <p className="mt-[2px] text-[12px] text-slate-500">Held back before any play is checked. They cancel with no cancel page.</p>
        <input
          type="range"
          min={0}
          max={30}
          value={globalControl}
          onChange={(e) => useCancelSettings.getState().setGlobalControl(Number(e.target.value))}
          aria-label="Global control"
          className="mt-[10px] w-full accent-slate-800"
        />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-[14px]">
        <span className="text-[13px] font-semibold text-slate-900">Fallback</span>
        <p className="mt-[2px] text-[12px] text-slate-500">For anyone no play matches.</p>
        <select
          value={fallbackId ?? ''}
          onChange={(e) => useCancelSettings.getState().setGlobalFallback(e.target.value || null)}
          className="mt-[10px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-slate-400"
        >
          <option value="">No cancel page</option>
          {orderedThreads(threads).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
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

const TONE = {
  win: { icon: 'trophy' as const, cls: 'border-indigo-300 bg-indigo-50', text: 'text-indigo-800' },
  shadow: { icon: 'circle-dashed' as const, cls: 'border-slate-200 bg-white', text: 'text-slate-600' },
  out: { icon: 'circle-x' as const, cls: 'border-slate-200 bg-white', text: 'text-slate-500' },
  off: { icon: 'circle-slash' as const, cls: 'border-slate-200 bg-slate-50', text: 'text-slate-400' },
}

function Timeline({ entry, titleOf }: { entry: WorkspaceEntry | null; titleOf: (id: string) => string }) {
  if (!entry || entry.run.outcome.kind !== 'variant') return null
  const days = entry.play.saveWindowDays
  const what = `Variant ${entry.run.outcome.letter}, ${titleOf(entry.run.outcome.experienceId)}`
  const steps = [
    { when: 'First visit', text: `Sees ${what} from ${entry.play.name}.` },
    days
      ? { when: `Days 1 to ${days}`, text: `If they took an offer, they’re inside the ${days}-day save window. No new offer from this play.` }
      : { when: 'Any later visit', text: 'No save window, so they can be offered again right away.' },
    { when: days ? `After day ${days}` : 'Next visit', text: `Same play and ${what} again. Buckets don’t change between visits, unless the order or split changes.` },
  ]
  return (
    <div className="mt-[14px]">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">If they come back</h4>
      <ol className="mt-[8px] space-y-[8px] border-l border-slate-200 pl-[14px]">
        {steps.map((s) => (
          <li key={s.when} className="relative text-[12.5px]">
            <span className="absolute -left-[19px] top-[5px] h-[8px] w-[8px] rounded-full border-2 border-white bg-slate-400" />
            <span className="font-semibold text-slate-800">{s.when}.</span> <span className="text-slate-600">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function CrossPlayTest({ ranked }: { ranked: CancelPlay[] }) {
  const globalControl = useCancelSettings((s) => s.globalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const threads = useWorkspace((s) => s.threads)
  const allSessions = useTestSessions((s) => s.sessions)
  const sessions = useMemo(() => allSessions.filter((x) => x.playId === null).slice(0, 5), [allSessions])
  const [sub, setSub] = useState<SampleSubscriber | null>(null)
  const [drafts, setDrafts] = useState(true)
  const titleOf = (id: string) => threads.find((t) => t.id === id)?.title ?? 'an experience'
  const result = useMemo(() => (sub ? resolveWorkspace(ranked, sub, globalControl, fallbackId, drafts) : null), [sub, ranked, globalControl, fallbackId, drafts])

  useEffect(() => {
    if (!result || !sub) return
    if (result.winner) markTested(result.winner.play.id)
    const text = result.globalHeld
      ? 'Held back by global control'
      : result.winner
        ? entryLine(result.winner, result.winner, titleOf).text
        : fallbackId
          ? `No play matched. Fallback: ${titleOf(fallbackId)}`
          : 'No play matched. No cancel page.'
    logSession({ playId: null, subscriberId: sub.id, subscriberName: sub.name, result: text, forced: false, walked: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id, drafts])

  const ordered = result
    ? [...result.entries].sort((a, b) => (a === result.winner ? -1 : b === result.winner ? 1 : 0))
    : []

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-[14px]">
      <div>
        <SubscriberPicker selected={sub} onPick={setSub} />
        <label className="mt-[10px] flex items-center gap-[8px] text-[12.5px] text-slate-600">
          <input type="checkbox" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} className="accent-slate-800" />
          Include draft plays
        </label>
        {sessions.length > 0 && (
          <div className="mt-[14px]">
            <div className="flex items-baseline justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recent tests</h4>
              <span className="text-[10.5px] text-slate-400">Not in reporting</span>
            </div>
            <ul className="mt-[6px] space-y-[4px]">
              {sessions.map((s) => (
                <li key={s.id} className="truncate text-[12px] text-slate-500">
                  <span className="font-medium text-slate-700">{s.subscriberName}</span>. {s.result}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-[14px]">
        {!result || !sub ? (
          <p className="text-[13px] text-slate-500">Pick someone to see which play they get, and why the others don’t.</p>
        ) : result.globalHeld ? (
          <p className="text-[13px] text-slate-700">
            <span className="font-semibold">{sub.name}</span> is in the {globalControl}% global control. No play is checked, and they cancel with no cancel page.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-slate-700">
              <span className="font-semibold">{sub.name}</span>, {sub.summary}.
            </p>
            <ul className="mt-[10px] space-y-[6px]">
              {ordered.map((e) => {
                const line = entryLine(e, result.winner, titleOf)
                const t = TONE[e === result.winner ? 'win' : line.tone]
                return (
                  <li key={e.play.id} className={`flex items-start gap-[8px] rounded-xl border px-[10px] py-[8px] ${t.cls}`}>
                    <SIcon name={t.icon} size={14} className={`mt-[1px] flex-none ${t.text}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-[6px]">
                        <span className="text-[12.5px] font-semibold text-slate-900">{e.play.name}</span>
                        <span className="text-[11px] text-slate-400">#{ranked.indexOf(e.play) + 1}</span>
                      </div>
                      <p className={`text-[12px] ${t.text}`}>{line.text}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            {!result.winner && (
              <p className="mt-[10px] rounded-xl bg-slate-50 px-[10px] py-[8px] text-[12.5px] text-slate-600">
                No play takes them. {fallbackId ? `They get the fallback, ${titleOf(fallbackId)}.` : 'There’s no fallback, so they cancel with no cancel page.'}
              </p>
            )}
            <Timeline entry={result.winner} titleOf={titleOf} />
          </>
        )}
      </div>
    </div>
  )
}

/** The order plays are checked in, the settings above every play, and a test across all of them. */
export function PlayOrder() {
  const ranked = useRankedPlays()
  return (
    <div className="h-full min-w-0 flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[860px] space-y-[22px] px-[28px] py-[24px]">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">Play order and testing</h1>
          <p className="mt-[4px] text-[13px] text-slate-500">When someone clicks Cancel, plays are checked from the top. The first one they qualify for wins. Drag to change the order.</p>
        </div>
        <Globals />
        <section className="space-y-[8px]">
          <h2 className="px-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">Order</h2>
          <OrderList ranked={ranked} />
        </section>
        <section className="space-y-[8px]">
          <h2 className="px-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">Test a subscriber across every play</h2>
          <CrossPlayTest ranked={ranked} />
        </section>
      </div>
    </div>
  )
}
