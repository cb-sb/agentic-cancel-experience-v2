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
  { id: 'trials', objective: 'Acquisition', title: 'Improve trial conversion', detail: 'Trial users are the largest near-term opportunity.', impact: 'High impact' },
  { id: 'annual', objective: 'Expansion', title: 'Move monthly users to annual', detail: 'A focused annual plan play can lift retained revenue.', impact: 'Medium impact' },
  { id: 'cancels', objective: 'Retention', title: 'Reduce avoidable cancellation', detail: 'Price-sensitive subscribers respond to a targeted save offer.', impact: 'High impact' },
] as const

function openRecommendation(id: (typeof RECOMMENDATIONS)[number]['id']) {
  if (id === 'trials') return goGrowth('acquisition', { page: 'index' })
  if (id === 'annual') return goGrowth('expansion', { page: 'index' })
  useWorkspaceUi.getState().setPage('order')
  useGrowthShell.getState().go('experiences.cancel')
}

function RecommendationHub() {
  return (
    <div className="mx-auto mb-[24px] w-full max-w-[820px] text-left">
      <div className="mb-[10px] flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">Top recommendations</p>
          <p className="mt-[2px] text-[13px] text-slate-500">Signals across Acquisition, Expansion and Retention.</p>
        </div>
        <button type="button" className="text-[12.5px] font-medium text-indigo-600 hover:text-indigo-800">View all insights</button>
      </div>
      <div className="grid grid-cols-3 gap-[10px]">
        {RECOMMENDATIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openRecommendation(item.id)}
            className="rounded-xl border border-slate-200 bg-white p-[13px] text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-[11px] font-medium text-slate-500">{item.objective} · {item.impact}</span>
            <span className="mt-[5px] block text-[13.5px] font-semibold text-slate-900">{item.title}</span>
            <span className="mt-[3px] block text-[12px] leading-[1.4] text-slate-500">{item.detail}</span>
            <span className="mt-[10px] inline-flex items-center gap-[4px] text-[12px] font-medium text-indigo-600">
              Review recommendation <SIcon name="arrow-right" size={12} />
            </span>
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
            placeholder="What do you want to work on?"
            chips={START}
            hero={
              <>
                <div className="mb-[20px] text-center">
                  <h2 className="text-[24px] font-semibold tracking-tight text-slate-900">What do you want to work on?</h2>
                  <p className="mt-[6px] text-[13.5px] text-slate-500">
                    Tell Copilot what you want. It sets things up and shows you before anything goes live.
                  </p>
                </div>
                <RecommendationHub />
              </>
            }
          />
        )}
      </div>
    </div>
  )
}
