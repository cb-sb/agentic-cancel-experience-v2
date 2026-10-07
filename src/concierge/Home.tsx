import { useEffect } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { AgentChat } from '../agent/AgentChat'
import { useAgentStore } from '../agent/useAgentStore'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { goGrowth } from './objective/useGrowthUi'

const START = [
  'Stop people from cancelling',
  'Convert more trials',
  'Upsell to annual',
  'Set up a pricing page',
  'Import my own pages',
]

const RECOMMENDATIONS = [
  { id: 'trials', objective: 'Acquisition', title: 'Improve trial conversion', detail: 'Trial users are the largest near-term opportunity.' },
  { id: 'annual', objective: 'Expansion', title: 'Move monthly users to annual', detail: 'A focused annual plan can lift retained revenue.' },
  { id: 'cancels', objective: 'Retention', title: 'Reduce avoidable cancellation', detail: 'Price-sensitive subscribers respond to a save offer.' },
] as const

function openRecommendation(id: (typeof RECOMMENDATIONS)[number]['id']) {
  if (id === 'trials') return goGrowth('acquisition', { page: 'index' })
  if (id === 'annual') return goGrowth('expansion', { page: 'index' })
  useWorkspaceUi.getState().setPage('order')
  useGrowthShell.getState().go('experiences.cancel')
}

function RecommendationHub() {
  return (
    <div className="mt-[28px] border-t border-slate-100 pt-[18px]">
      <p className="mb-[14px] text-[13px] font-medium text-slate-500">Recommendations</p>
      <div className="grid grid-cols-3 gap-[16px]">
        {RECOMMENDATIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openRecommendation(item.id)}
            className="rounded-[8px] text-left hover:bg-slate-50"
          >
            <span className="text-[12px] text-slate-400">{item.objective}</span>
            <span className="mt-[6px] block text-[14px] font-medium leading-[1.35] text-slate-900">{item.title}</span>
            <span className="mt-[4px] block text-[13px] leading-[1.4] text-slate-500">{item.detail}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ConciergeHome() {
  const id = useAgentStore((s) => (s.active.home && s.chats[s.active.home] ? s.active.home : null))
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
            placeholder="Describe what you want to set up"
            chips={START}
            hero={
              <h2 className="mb-[20px] text-center text-[28px] font-semibold tracking-tight text-slate-900">What do you want to work on?</h2>
            }
            after={<RecommendationHub />}
          />
        )}
      </div>
    </div>
  )
}
