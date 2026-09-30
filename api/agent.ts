import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream, type UIMessage } from 'ai'
import { buildSystemPrompt, type AgentContext } from '../src/agent/systemPrompt.js'
import { NEEDS_OPEN, toolSpecs, type ToolName } from '../src/agent/toolSpecs.js'

export const maxDuration = 60

const MODEL = process.env.AGENT_MODEL || 'openai/gpt-5-mini'

/** A tool result can name the card that must come next, so the flow does not depend on the model. */
function forcedCall(messages: UIMessage[]): ToolName | null {
  const last = messages.at(-1)
  if (last?.role !== 'assistant') return null
  const part = last.parts.filter((p) => p.type !== 'step-start').at(-1) as
    | { type: string; state?: string; output?: { call?: unknown } }
    | undefined
  if (!part?.type.startsWith('tool-') || part.state !== 'output-available') return null
  const call = part.output?.call
  return typeof call === 'string' && call in toolSpecs ? (call as ToolName) : null
}

export async function POST(req: Request): Promise<Response> {
  const { messages, context } = (await req.json()) as { messages: UIMessage[]; context: AgentContext }

  const onHome = context.surface === 'home'
  const triaged = messages.some((m) => m.parts.some((p) => p.type === 'tool-triage'))
  const mustTriage = onHome && context.needsTriage && !triaged

  const forced = forcedCall(messages)
  const activeTools = onHome
    ? (Object.keys(toolSpecs) as ToolName[]).filter((name) => !NEEDS_OPEN.includes(name))
    : undefined

  const result = streamText({
    model: MODEL,
    instructions: buildSystemPrompt(context),
    messages: await convertToModelMessages(messages),
    tools: toolSpecs,
    activeTools,
    toolChoice: mustTriage
      ? { type: 'tool', toolName: 'triage' }
      : forced && activeTools?.includes(forced) !== false
        ? { type: 'tool', toolName: forced }
        : 'auto',
    providerOptions: { openai: { reasoningEffort: 'low', parallelToolCalls: false } },
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        const text = error instanceof Error ? error.message : String(error)
        if (/free tier|access/i.test(text)) return `The model ${MODEL} is not available on this account. ${text}`
        return text
      },
    }),
  })
}
