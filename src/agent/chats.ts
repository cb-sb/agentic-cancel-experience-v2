import { Chat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai'
import { buildContext } from './context'
import { INTERACTIVE } from './toolSpecs'
import { needsCard, runTool } from './tools'
import { useAgentStore } from './useAgentStore'

/** Tool rounds the agent may take on its own before it has to stop and reply. */
const MAX_ROUNDS = 12

const registry = new Map<string, Chat<UIMessage>>()

function roundsInLastReply(messages: UIMessage[]): number {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return 0
  return last.parts.filter((p) => p.type === 'step-start').length
}

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === 'user')
  return last?.parts.map((p) => (p.type === 'text' ? p.text : '')).join(' ') ?? ''
}

export function chatFor(id: string): Chat<UIMessage> {
  const existing = registry.get(id)
  if (existing) return existing

  const chat: Chat<UIMessage> = new Chat<UIMessage>({
    id,
    messages: useAgentStore.getState().chats[id]?.messages ?? [],
    transport: new DefaultChatTransport({
      api: '/api/agent',
      prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, context: buildContext(id) } }),
    }),
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }) && roundsInLastReply(messages) < MAX_ROUNDS,
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) return
      const input = (toolCall.input ?? {}) as Record<string, unknown>
      if (INTERACTIVE.has(toolCall.toolName) || needsCard(toolCall.toolName, input)) return
      void runTool(id, toolCall.toolName, input, lastUserText(chat.messages))
        .then((output) => chat.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output }))
        .catch((error: unknown) =>
          chat.addToolOutput({
            state: 'output-error',
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            errorText: error instanceof Error ? error.message : String(error),
          }),
        )
    },
    onFinish: () => useAgentStore.getState().save(id, chat.messages),
  })
  registry.set(id, chat)
  return chat
}

/** Answer a card: the merchant's choice becomes the tool's result and the agent carries on. */
export function answerTool(chatId: string, tool: string, toolCallId: string, output: unknown) {
  const chat = chatFor(chatId)
  void chat.addToolOutput({ tool, toolCallId, output })
  useAgentStore.getState().save(chatId, chat.messages)
}

/** Send a message as the merchant, from a chip, a door or a page. */
export function sendAs(chatId: string, text: string) {
  const chat = chatFor(chatId)
  if (chat.status === 'streaming' || chat.status === 'submitted') return
  void chat.sendMessage({ text })
}
