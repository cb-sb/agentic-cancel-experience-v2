import { useState } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import type { JourneyFile } from '../journey/types'
import { audienceLabel, useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { OTHER_PLAYS } from '../workspace/sampleNonCancel'
import { byPriority, useCancelSettings } from '../workspace/useCancelSettings'
import {
  newThread,
  orderedThreads,
  switchThread,
  threadIsLive,
  useWorkspace,
  type ExperienceThread,
} from '../workspace/useWorkspace'
import { useWorkspaceUi, type Objective } from '../workspace/useWorkspaceUi'
import { ReadOnlyPlay } from './ReadOnlyPlay'
import { StatusChip } from './StatusChip'
import { ago } from './ThreadSidebar'

const TABS: { id: Objective; label: string }[] = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'retention', label: 'Retention' },
]

type Sort = 'recent' | 'priority'

function Card({
  title,
  subtitle,
  live,
  meta,
  rank,
  onClick,
  drag,
}: {
  title: string
  subtitle: string
  live: boolean
  meta: string
  rank?: number
  onClick: () => void
  drag?: {
    onDragStart: () => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: () => void
    over: boolean
  }
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={Boolean(drag)}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      className={`flex min-h-[132px] flex-col rounded-2xl border bg-white p-[18px] text-left transition-colors hover:border-slate-300 hover:bg-slate-50 ${
        drag?.over ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
      } ${drag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex w-full items-start gap-[10px]">
        {rank !== undefined && (
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-slate-100 text-[12px] font-semibold tabular-nums text-slate-600">
            {rank}
          </span>
        )}
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-slate-900">{title}</span>
        {drag && <SIcon name="grip-vertical" size={16} className="flex-none text-slate-300" />}
      </div>
      <p className="mt-[6px] line-clamp-2 text-[13px] leading-relaxed text-slate-500">{subtitle}</p>
      <div className="mt-auto flex items-center gap-[8px] pt-[14px] text-[12px] text-slate-400">
        <StatusChip live={live} />
        <span>{meta}</span>
      </div>
    </button>
  )
}

function threadSubtitle(t: ExperienceThread, file: JourneyFile | undefined): string {
  if (t.seed && !file) return 'Cancel page for all subscribers'
  if (!file || file.steps.length === 0) return 'Not started'
  return `Cancel page for ${audienceLabel(file.audience).toLowerCase()}`
}

/** Every experience across the three objectives. Cancel pages open as threads; the rest open read-only. */
export function ExperiencesIndex() {
  const tab = useWorkspaceUi((s) => s.indexTab)
  const setTab = useWorkspaceUi((s) => s.setIndexTab)
  const setPage = useWorkspaceUi((s) => s.setPage)
  const readOnlyId = useWorkspaceUi((s) => s.readOnlyId)
  const setReadOnlyId = useWorkspaceUi((s) => s.setReadOnlyId)
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  const activeFile = useJourney((s) => s.file)
  const priority = useCancelSettings((s) => s.priority)
  const setPriority = useCancelSettings((s) => s.setPriority)
  const openSettings = useCancelSettings((s) => s.setSettingsOpen)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  if (readOnlyId) return <ReadOnlyPlay id={readOnlyId} />

  const q = query.trim().toLowerCase()
  const cancelThreads = threads.filter((t) => t.title !== 'New experience' || t.snapshot?.chat.lines.length)
  const ranked = byPriority(cancelThreads, priority)
  const retention = (sort === 'priority' ? ranked : orderedThreads(cancelThreads)).filter(
    (t) => !q || t.title.toLowerCase().includes(q),
  )
  const others = OTHER_PLAYS.filter((p) => p.objective === tab)
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => a.daysAgo - b.daysAgo)

  const open = (id: string) => {
    setPage('thread')
    switchThread(id)
  }

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = ranked.map((t) => t.id).filter((id) => id !== dragId)
    ids.splice(ids.indexOf(targetId), 0, dragId)
    setPriority(ids)
    setDragId(null)
    setOverId(null)
  }

  const count = tab === 'retention' ? retention.length : others.length

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[960px] px-[32px] py-[32px]">
        <div className="flex items-center justify-between gap-[16px]">
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Experiences</h1>
          {tab === 'retention' && (
            <SButton
              size="small"
              variant="primary"
              className="w-auto"
              onClick={() => {
                setPage('thread')
                newThread()
              }}
            >
              New experience
            </SButton>
          )}
        </div>

        <div role="tablist" aria-label="Objective" className="mt-[20px] flex gap-[4px] border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-[12px] py-[8px] text-[13.5px] font-semibold ${
                tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-[20px] flex h-[40px] items-center gap-[10px] rounded-xl border border-slate-200 px-[12px] focus-within:border-slate-400">
          <SIcon name="search" size={16} className="flex-none text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search experiences"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="mt-[16px] flex items-center justify-between gap-[12px] text-[13px] text-slate-500">
          <span>
            {count} experience{count === 1 ? '' : 's'}
          </span>
          {tab === 'retention' && (
            <div className="flex items-center gap-[12px]">
              <button
                type="button"
                onClick={() => openSettings(true)}
                className="flex items-center gap-[6px] font-medium text-slate-600 hover:text-slate-900"
              >
                <SIcon name="settings" size={14} />
                Cancel page settings
              </button>
              <label className="flex items-center gap-[6px]">
                Sort by
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded-md border border-slate-200 bg-white px-[6px] py-[3px] text-[13px] font-medium text-slate-800 outline-none"
                >
                  <option value="recent">Recent activity</option>
                  <option value="priority">Priority</option>
                </select>
              </label>
            </div>
          )}
        </div>
        {tab === 'retention' && sort === 'priority' && (
          <p className="mt-[8px] text-[12.5px] text-slate-500">
            When two cancel experiences match the same subscriber, the higher one wins. Drag to reorder.
          </p>
        )}

        <div className="mt-[16px] grid grid-cols-2 gap-[14px]">
          {tab === 'retention'
            ? retention.map((t) => (
                <Card
                  key={t.id}
                  title={t.title}
                  subtitle={threadSubtitle(t, t.id === activeId ? activeFile : t.snapshot?.journey)}
                  live={threadIsLive(t, activeId, activeLive)}
                  meta={`Edited ${ago(t.updatedAt).toLowerCase()}`}
                  rank={sort === 'priority' ? ranked.indexOf(t) + 1 : undefined}
                  onClick={() => open(t.id)}
                  drag={
                    sort === 'priority'
                      ? {
                          onDragStart: () => setDragId(t.id),
                          onDragOver: (e) => {
                            e.preventDefault()
                            if (overId !== t.id) setOverId(t.id)
                          },
                          onDrop: () => drop(t.id),
                          over: overId === t.id && dragId !== t.id,
                        }
                      : undefined
                  }
                />
              ))
            : others.map((p) => (
                <Card
                  key={p.id}
                  title={p.name}
                  subtitle={`${p.playType}. ${p.description}`}
                  live={p.live}
                  meta={`Edited ${p.daysAgo} days ago`}
                  onClick={() => setReadOnlyId(p.id)}
                />
              ))}
        </div>
        {count === 0 && <p className="mt-[24px] text-[13px] text-slate-500">No experiences match.</p>}
      </div>
    </div>
  )
}
