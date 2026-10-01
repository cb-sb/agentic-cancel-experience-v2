import { useMemo, useState } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { StatusChip } from '../../layout/StatusChip'
import type { SampleSubscriber } from '../../play/resolve'
import { audienceText, overlaps, resolveWorkspace, type WorkspaceEntry } from '../../plays/resolve'
import { SubscriberPicker } from '../../plays/TestDrawer'
import type { GrowthObjective } from '../model'
import { setGrowthGlobalControl, setGrowthOrder, useGrowthPlays, useRankedGrowthPlays, type GrowthPlay } from '../useGrowthPlays'
import { experienceName } from './actions'
import { Empty, PageShell } from './ui'
import { openGrowthPlay } from './useGrowthUi'

function move(ids: string[], from: number, to: number): string[] {
  const next = [...ids]
  const [x] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, x)
  return next
}

function entryText(e: WorkspaceEntry, winner: WorkspaceEntry | null): { tone: 'win' | 'shadow' | 'out' | 'off'; text: string } {
  if (!e.counts) return { tone: 'off', text: 'Draft, so it is skipped. Turn on drafts to include it.' }
  const o = e.run.outcome
  if (o.kind === 'outside') return { tone: 'out', text: `Not in ${audienceText(e.play.audience)}` }
  if (e.shadowed) return { tone: 'shadow', text: `Qualifies, but ${winner?.play.name ?? 'a play above'} takes them first` }
  if (o.kind === 'play_control') return { tone: 'win', text: 'In the control group, so they see nothing' }
  if (o.kind === 'no_variant') return { tone: 'win', text: 'Takes them, but has nothing to show yet' }
  if (o.kind === 'variant') return { tone: 'win', text: `Sees Variant ${o.letter}, ${experienceName(o.experienceId)}` }
  return { tone: 'out', text: 'Held back' }
}

const TONE = {
  win: 'text-emerald-700',
  shadow: 'text-amber-700',
  out: 'text-slate-500',
  off: 'text-slate-400',
}

function TestPanel({ ranked, objective, onClose }: { ranked: GrowthPlay[]; objective: GrowthObjective; onClose: () => void }) {
  const globalControl = useGrowthPlays((s) => s.globalControl[objective])
  const [sub, setSub] = useState<SampleSubscriber | null>(null)
  const [drafts, setDrafts] = useState(true)
  const run = useMemo(() => (sub ? resolveWorkspace(ranked, sub, globalControl, null, drafts) : null), [sub, ranked, globalControl, drafts])
  return (
    <aside className="flex w-[380px] flex-none flex-col border-l border-slate-200 bg-white">
      <div className="flex h-[52px] flex-none items-center gap-[8px] border-b border-slate-200 px-[16px]">
        <p className="min-w-0 flex-1 text-[14px] font-semibold text-slate-900">Test a subscriber</p>
        <button type="button" aria-label="Close test" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          <SIcon name="x" size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-[16px] py-[14px]">
        <SubscriberPicker selected={sub} onPick={setSub} />
        <label className="mt-[12px] flex items-center gap-[8px] text-[12.5px] text-slate-600">
          <input type="checkbox" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} />
          Include draft plays
        </label>
        {run && sub && (
          <div className="mt-[16px]">
            <p className="text-[13px] font-semibold text-slate-900">{sub.name}</p>
            <p className="text-[12px] text-slate-500">{sub.summary}</p>
            {run.globalHeld ? (
              <p className="mt-[10px] rounded-lg bg-slate-50 px-[12px] py-[10px] text-[13px] text-slate-700">Held back by global control. No play shows them anything.</p>
            ) : (
              <ol className="mt-[10px] flex flex-col gap-[6px]">
                {run.entries.map((e, i) => {
                  const line = entryText(e, run.winner)
                  return (
                    <li key={e.play.id} className={`rounded-lg border px-[12px] py-[8px] ${run.winner === e ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
                      <p className="text-[12.5px] font-medium text-slate-800">
                        {i + 1}. {e.play.name}
                      </p>
                      <p className={`text-[12.5px] ${TONE[line.tone]}`}>{line.text}</p>
                    </li>
                  )
                })}
                {!run.winner && <li className="px-[2px] text-[12.5px] text-slate-500">No play takes them, so they see nothing.</li>}
              </ol>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

/** The order plays are checked in, first match wins, and a test with one subscriber. */
export function OrderPage({ objective }: { objective: GrowthObjective }) {
  const ranked = useRankedGrowthPlays(objective)
  const globalControl = useGrowthPlays((s) => s.globalControl[objective])
  const [testing, setTesting] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const covered = useMemo(() => new Map(overlaps(ranked).map((o) => [o.playId, o.coveredBy])), [ranked])
  const ids = ranked.map((p) => p.id)
  const nameOf = (id: string) => ranked.find((p) => p.id === id)?.name ?? 'A play above'

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div className="min-w-0 flex-1">
        <PageShell
          objective={objective}
          title="Play order and testing"
          blurb="Plays are checked from the top. The first one whose audience matches shows its experience."
          actions={
            !testing && (
              <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => setTesting(true)}>
                Test a subscriber
              </SButton>
            )
          }
        >
          {ranked.length === 0 ? (
            <Empty>No plays yet. Add one with the + next to Plays.</Empty>
          ) : (
            <ol className="overflow-hidden rounded-xl border border-slate-200">
              {ranked.map((p, i) => (
                <li
                  key={p.id}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId && dragId !== p.id) setGrowthOrder(objective, move(ids, ids.indexOf(dragId), i))
                    setDragId(null)
                  }}
                  className={`flex items-center gap-[12px] border-t border-slate-100 bg-white px-[12px] py-[10px] first:border-t-0 ${dragId === p.id ? 'opacity-50' : ''}`}
                >
                  <SIcon name="grip-vertical" size={14} className="flex-none cursor-grab text-slate-300" />
                  <span className="w-[18px] flex-none text-right text-[12.5px] font-semibold text-slate-400">{i + 1}</span>
                  <button type="button" onClick={() => openGrowthPlay(objective, p.id)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-[8px]">
                      <span className="truncate text-[13.5px] font-medium text-slate-900 hover:underline">{p.name}</span>
                      <StatusChip live={p.status === 'live'} />
                    </span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {audienceText(p.audience)} · {p.variants.length} variant{p.variants.length === 1 ? '' : 's'}
                      {p.control > 0 ? ` · ${p.control}% control` : ''}
                    </span>
                    {covered.has(p.id) && (
                      <span className="mt-[2px] block text-[12px] text-amber-700">Reaches nobody: {nameOf(covered.get(p.id)!)} is above it and covers everyone it would.</span>
                    )}
                  </button>
                  <div className="flex flex-none items-center gap-[2px]">
                    <button
                      type="button"
                      aria-label={`Move ${p.name} up`}
                      disabled={i === 0}
                      onClick={() => setGrowthOrder(objective, move(ids, i, i - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <SIcon name="arrow-up" size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${p.name} down`}
                      disabled={i === ranked.length - 1}
                      onClick={() => setGrowthOrder(objective, move(ids, i, i + 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <SIcon name="arrow-down" size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-[24px] flex items-center gap-[12px] rounded-xl border border-slate-200 px-[16px] py-[12px]">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-slate-800">Global control</span>
              <span className="block text-[12.5px] text-slate-500">Held back from every play here, to measure what all of them add together.</span>
            </span>
            <label className="flex flex-none items-center gap-[6px] text-[13px] text-slate-500">
              <input
                type="number"
                min={0}
                max={50}
                value={globalControl}
                onChange={(e) => setGrowthGlobalControl(objective, Number(e.target.value) || 0)}
                aria-label="Global control percent"
                className="w-[72px] rounded-[8px] border border-slate-200 px-[8px] py-[6px] text-right text-[13px] text-slate-900 outline-none focus:border-slate-400"
              />
              %
            </label>
          </div>
        </PageShell>
      </div>
      {testing && <TestPanel ranked={ranked} objective={objective} onClose={() => setTesting(false)} />}
    </div>
  )
}
