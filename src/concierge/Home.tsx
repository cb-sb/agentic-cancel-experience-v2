import { useEffect } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { AgentChat } from '../agent/AgentChat'
import { useAgentStore } from '../agent/useAgentStore'

const START = [
  'Stop people from cancelling',
  'Convert more trials',
  'Upsell to annual',
  'Set up a pricing page',
  'Import my own pages',
]

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
              <div className="mb-[20px] text-center">
                <h2 className="text-[24px] font-semibold tracking-tight text-slate-900">
                  What do you want to work on?
                </h2>
                <p className="mt-[6px] text-[13.5px] text-slate-500">
                  Tell Copilot what you want. It sets things up and shows you before anything goes live.
                </p>
              </div>
            }
          />
        )}
      </div>
    </div>
  )
}
