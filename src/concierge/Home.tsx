import { useEffect } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { AgentChat } from '../agent/AgentChat'
import { sendAs } from '../agent/chats'
import { openOwner } from '../agent/tools'
import { useAgentStore } from '../agent/useAgentStore'
import { useWorkspace } from '../workspace/useWorkspace'
import { cancelPageRows } from './cancelPages'
import { TYPE_LABEL, objectiveLabel, timeAgo } from './model'
import { useGrowthExperiences } from './useGrowthExperiences'

const START = [
  'Stop people from cancelling',
  'Convert more trials',
  'Upsell to annual',
  'Set up a pricing page',
  'Import my own pages',
]

interface Row {
  key: string
  title: string
  meta: string
  onClick: () => void
}

function RowList({ label, rows }: { label: string; rows: Row[] }) {
  if (!rows.length) return null
  return (
    <div>
      <p className="mb-[6px] text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-col rounded-[12px] border border-slate-200 bg-white">
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={r.onClick}
            className="flex items-center gap-[10px] border-t border-slate-100 px-[14px] py-[10px] text-left first:border-t-0 hover:bg-slate-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-slate-800">{r.title}</span>
              <span className="block truncate text-[12px] text-slate-500">{r.meta}</span>
            </span>
            <SIcon name="arrow-right" size={13} className="flex-none text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  )
}

function usePickUp(): Row[] {
  useWorkspace((s) => s.threads)
  const items = useGrowthExperiences((s) => s.items)
  const cancel = cancelPageRows()
    .filter((r) => r.status === 'draft' && !r.blank)
    .map((r) => ({
      ...r,
      objective: 'retention' as const,
      type: 'cancel_page' as const,
      owner: `cancel:${r.id}` as const,
    }))
  const growth = items
    .filter((x) => x.status === 'draft')
    .map((x) => ({
      id: x.id,
      name: x.name,
      updatedAt: x.updatedAt,
      objective: x.objective,
      type: x.type,
      owner: `growth:${x.id}` as const,
    }))
  return [...cancel, ...growth]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)
    .map((x) => ({
      key: x.owner,
      title: x.name,
      meta: `Draft · ${objectiveLabel(x.objective)} · ${TYPE_LABEL[x.type]} · ${timeAgo(x.updatedAt)}`,
      onClick: () => openOwner(x.owner),
    }))
}

function useWorthALook(chatId: string): Row[] {
  const items = useGrowthExperiences((s) => s.items)
  const rows: Row[] = []
  const untested = items.find((x) => x.status === 'live' && x.variants.length === 1)
  if (untested) {
    rows.push({
      key: 'test',
      title: `Test a second version of “${untested.name}”`,
      meta: 'It is live with one offer and no test.',
      onClick: () => sendAs(chatId, `Suggest a test for “${untested.name}”`),
    })
  }
  const noControl = items.find((x) => x.status === 'live' && x.control === 0)
  if (noControl) {
    rows.push({
      key: 'control',
      title: `Measure the lift of “${noControl.name}”`,
      meta: 'It has no control group, so you can’t see what it adds.',
      onClick: () => sendAs(chatId, `Should “${noControl.name}” have a control group?`),
    })
  }
  rows.push({
    key: 'reasons',
    title: 'See why people cancelled this month',
    meta: 'Sample report',
    onClick: () => sendAs(chatId, 'Why are people cancelling this month?'),
  })
  return rows.slice(0, 3)
}

export function ConciergeHome() {
  const id = useAgentStore((s) => (s.active.home && s.chats[s.active.home] ? s.active.home : null))
  const pickUp = usePickUp()
  const worth = useWorthALook(id ?? '')
  const hasMessages = useAgentStore((s) => (id ? (s.chats[id]?.messages.length ?? 0) > 0 : false))

  useEffect(() => {
    if (!id) useAgentStore.getState().ensureChat('home')
  }, [id])

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-slate-100 px-[24px]">
        <h1 className="text-[15px] font-semibold text-slate-900">Home</h1>
        {hasMessages && (
          <button
            type="button"
            onClick={() => useAgentStore.getState().newChat('home')}
            className="inline-flex items-center gap-[6px] rounded-[8px] px-[10px] py-[6px] text-[12.5px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <SIcon name="plus" size={13} />
            New chat
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1">
        {id && (
          <AgentChat
            key={id}
            chatId={id}
            centered
            placeholder="What do you want to work on?"
            chips={START}
            hero={
              <div className="mb-[20px] text-center">
                <h2 className="text-[24px] font-semibold tracking-tight text-slate-900">
                  What do you want to work on?
                </h2>
                <p className="mt-[6px] text-[13.5px] text-slate-500">
                  Tell Copilot what you want. It sets things up and shows you before anything goes live.
                </p>
              </div>
            }
            below={
              <div className="mt-[32px] grid gap-[20px] min-[860px]:grid-cols-2">
                <RowList label="Pick up" rows={pickUp} />
                <RowList label="Worth a look" rows={worth} />
              </div>
            }
          />
        )}
      </div>
    </div>
  )
}
