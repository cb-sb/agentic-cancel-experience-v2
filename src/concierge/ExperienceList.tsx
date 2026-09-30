import { useState } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { audienceName } from '../agent/context'
import { openOwner } from '../agent/tools'
import { useOrchestration } from '../store/useOrchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { useWorkspace } from '../workspace/useWorkspace'
import { AskBar } from './AskBar'
import { cancelPageRows, createCancelPage } from './cancelPages'
import {
  OBJECTIVES,
  TYPE_ICON,
  TYPE_LABEL,
  timeAgo,
  typesFor,
  type ExperienceStatus,
  type ExperienceType,
  type Objective,
} from './model'
import { useGrowthExperiences } from './useGrowthExperiences'

interface ListRow {
  owner: `cancel:${string}` | `growth:${string}`
  name: string
  type: ExperienceType
  status: ExperienceStatus
  audience: string
  priority: number
  updatedAt: number
}

const STATUS_STYLE: Record<ExperienceStatus, string> = {
  live: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-slate-100 text-slate-600',
  inactive: 'bg-amber-50 text-amber-800',
  archived: 'bg-slate-100 text-slate-400',
}

const STATUS_LABEL: Record<ExperienceStatus, string> = {
  live: 'Live',
  draft: 'Draft',
  inactive: 'Paused',
  archived: 'Archived',
}

export function StatusPill({ status }: { status: ExperienceStatus }) {
  return (
    <span className={`inline-flex rounded-full px-[8px] py-[2px] text-[11.5px] font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function useRows(objective: Objective): ListRow[] {
  useWorkspace((s) => s.threads)
  useCancelSettings((s) => s.priority)
  useOrchestration((s) => s.play.publishState)
  const items = useGrowthExperiences((s) => s.items)
  const cancel: ListRow[] =
    objective === 'retention'
      ? cancelPageRows().map((r) => ({
          owner: `cancel:${r.id}`,
          name: r.name,
          type: 'cancel_page',
          status: r.status,
          audience: '',
          priority: r.priority,
          updatedAt: r.updatedAt,
        }))
      : []
  const growth: ListRow[] = items
    .filter((x) => x.objective === objective && x.status !== 'archived')
    .map((x) => ({
      owner: `growth:${x.id}`,
      name: x.name,
      type: x.type,
      status: x.status,
      audience: audienceName(x.audienceId),
      priority: x.priority,
      updatedAt: x.updatedAt,
    }))
  return [...cancel, ...growth]
}

export function createExperience(objective: Objective, type: ExperienceType) {
  if (type === 'cancel_page') {
    createCancelPage()
    return
  }
  const x = useGrowthExperiences.getState().add({
    name: `New ${TYPE_LABEL[type].toLowerCase()}`,
    objective,
    type,
    status: 'draft',
    audienceId: 'all',
    trigger: { kind: 'any_page' },
    variants: [],
    control: 0,
  })
  openOwner(`growth:${x.id}`)
}

function NewMenu({ objective }: { objective: Objective }) {
  const [open, setOpen] = useState(false)
  const types = typesFor(objective)
  return (
    <div className="relative">
      <SButton size="small" variant="primary" icon={<SIcon name="plus" size={14} />} onClick={() => setOpen((v) => !v)}>
        New experience
      </SButton>
      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-[240px] rounded-[12px] border border-slate-200 bg-white p-[6px] shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)]">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setOpen(false)
                  createExperience(objective, t)
                }}
                className="flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[8px] text-left text-[13px] text-slate-700 hover:bg-slate-50"
              >
                <SIcon name={TYPE_ICON[t]} size={15} className="text-slate-400" />
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ExperienceList({ objective }: { objective: Objective }) {
  const meta = OBJECTIVES.find((o) => o.id === objective)!
  const types = typesFor(objective)
  const [tab, setTab] = useState<ExperienceType | 'all'>('all')
  const rows = useRows(objective)
  const shown = (tab === 'all' ? rows : rows.filter((r) => r.type === tab)).sort(
    (a, b) => types.indexOf(a.type) - types.indexOf(b.type) || a.priority - b.priority,
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex flex-none items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">{meta.label}</h1>
          <p className="mt-[2px] text-[13px] text-slate-500">{meta.blurb}</p>
        </div>
        <NewMenu objective={objective} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6">
        <div className="flex flex-none items-center gap-5 border-b border-slate-200 pt-1 text-[13px] font-medium">
          {(['all', ...types] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative py-3 ${tab === id ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {id === 'all' ? 'All' : `${TYPE_LABEL[id]}s`}
              <span className="ml-[6px] text-[12px] text-slate-400">
                {id === 'all' ? rows.length : rows.filter((r) => r.type === id).length}
              </span>
              {tab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-slate-900" />}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto py-4">
          <AskBar
            placeholder={`Ask Copilot about ${meta.label.toLowerCase()}, e.g. “Which of these should I test next?”`}
          />
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-[6px] py-[60px] text-center">
              <p className="text-[14px] font-medium text-slate-700">Nothing here yet</p>
              <p className="text-[13px] text-slate-500">Create one, or ask Copilot to set it up for you.</p>
            </div>
          ) : (
            <table className="mt-[16px] w-full text-left text-[13px]">
              <thead>
                <tr className="text-[12px] font-medium text-slate-400">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Audience</th>
                  <th className="pb-2 font-medium" title="Within its type. 1 wins when two match the same subscriber.">
                    Priority
                  </th>
                  <th className="pb-2 font-medium">Last modified</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.owner} className="border-t border-slate-100">
                    <td className="py-3">
                      <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => openOwner(r.owner)}>
                        {r.name}
                      </button>
                    </td>
                    <td className="py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <SIcon name={TYPE_ICON[r.type]} size={14} className="text-slate-400" />
                        {TYPE_LABEL[r.type]}
                      </span>
                    </td>
                    <td className="py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="py-3 text-slate-600">{r.audience || '—'}</td>
                    <td className="py-3 text-slate-600">{r.priority}</td>
                    <td className="py-3 text-slate-500">{timeAgo(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
