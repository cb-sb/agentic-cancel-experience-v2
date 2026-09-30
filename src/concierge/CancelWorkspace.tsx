import { useEffect } from 'react'
import { AgentChat } from '../agent/AgentChat'
import { sendAs } from '../agent/chats'
import { landTemplate } from '../agent/tools'
import { useAgentStore, type OwnerKey } from '../agent/useAgentStore'
import { LIBRARY, withLive } from '../journey/templates'
import { applyMerchantJourney } from '../library/apply'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useJourney } from '../store/useJourney'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { useOrchestration } from '../store/useOrchestration'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { ChatsPane } from './ChatsPane'

export function useOwnerChat(owner: OwnerKey | null): string | null {
  const chatId = useAgentStore((s) => {
    if (!owner) return null
    const id = s.active[owner]
    return id && s.chats[id] ? id : null
  })
  useEffect(() => {
    if (owner && !chatId) useAgentStore.getState().ensureChat(owner)
  }, [owner, chatId])
  return chatId
}

/** Copilot beside the cancel page tabs. Templates picked on the Templates page land here and the agent hears about it. */
export function CancelAgentDock({ centered }: { centered: boolean }) {
  const threadId = useWorkspace((s) => s.activeId)
  const chatId = useOwnerChat(threadId ? `cancel:${threadId}` : null)
  const pendingTemplate = useOrchestration((s) => s.pendingLibraryTemplate)
  const pendingSaved = useOrchestration((s) => s.pendingMerchantTemplate)

  useEffect(() => {
    if (!pendingTemplate || !chatId) return
    useOrchestration.getState().consumeLibraryTemplate()
    landTemplate(pendingTemplate)
    const title = LIBRARY.find((e) => e.id === pendingTemplate)?.title ?? 'a'
    sendAs(chatId, `I picked the “${title}” template.`)
  }, [pendingTemplate, chatId])

  useEffect(() => {
    if (!pendingSaved || !chatId) return
    useOrchestration.getState().consumeMerchantLibrary()
    const saved = useMerchantLibrary.getState().getTemplate(pendingSaved)
    if (!saved) return
    const next = applyMerchantJourney(useJourney.getState().file, saved, useMerchantLibrary.getState().components)
    useJourney.getState().replaceFile({ ...next, steps: withLive(next.steps, true) })
    useOrchestration.getState().enterWorkEditor()
    openTab('editor')
    sendAs(chatId, `I picked my saved pages “${saved.name}”.`)
  }, [pendingSaved, chatId])

  if (!chatId) return null
  return (
    <AgentChat
      key={chatId}
      chatId={chatId}
      centered={centered}
      hero={
        centered ? (
          <div className="mb-[20px] text-center">
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">What should this cancel page do?</h2>
            <p className="mt-[6px] text-[13.5px] text-slate-500">Describe who it is for and what you want to happen. Copilot builds the screens.</p>
          </div>
        ) : undefined
      }
    />
  )
}

/** The open cancel page's chat has messages, so a blank page shows the chat instead of the doors. */
export function useCancelChatStarted(): boolean {
  const threadId = useWorkspace((s) => s.activeId)
  return useAgentStore((s) => {
    const id = s.active[`cancel:${threadId}`]
    return Boolean(id && (s.chats[id]?.messages.length ?? 0) > 0)
  })
}

export function CancelChatsPane() {
  const threadId = useWorkspace((s) => s.activeId)
  const title = useWorkspace((s) => s.threads.find((t) => t.id === s.activeId)?.title ?? 'Cancel page')
  return (
    <ChatsPane
      owner={`cancel:${threadId}`}
      title={title}
      meta="Retention · Cancel page"
      backLabel="Back to Retention"
      onBack={() => useGrowthShell.getState().go('experiences.retention')}
    />
  )
}
