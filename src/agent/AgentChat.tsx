import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useChat } from '@ai-sdk/react'
import { SIcon } from '@chargebee/sting-react'
import type { UIMessage } from 'ai'
import { LIBRARY } from '../journey/templates'
import { labelOf, type NavLeafId } from '../shell/nav'
import { OBJECTIVES, TYPE_LABEL, type ExperienceType } from '../concierge/model'
import { useGrowthLibrary } from '../concierge/useGrowthLibrary'
import {
  ApprovalCard,
  ChoiceCard,
  DoorsCard,
  KitCard,
  ReviewCard,
  SampleCard,
  TemplatesCard,
  UploadCard,
  type CardProps,
} from './cards'
import { answerTool, chatFor } from './chats'
import { audienceName } from './context'
import { INTERACTIVE } from './toolSpecs'
import { needsCard, undoLast } from './tools'
import { useAgentStore } from './useAgentStore'

type Part = UIMessage['parts'][number]
type ToolPart = Extract<Part, { toolCallId: string }>
type Input = Record<string, unknown>

const CARDS: Record<string, (p: CardProps) => ReactNode> = {
  ask_choice: ChoiceCard,
  show_doors: DoorsCard,
  show_templates: TemplatesCard,
  show_kit: KitCard,
  show_upload: UploadCard,
  review_upload: ReviewCard,
  show_sample: SampleCard,
  set_control: ApprovalCard,
  set_split: ApprovalCard,
  publish: ApprovalCard,
  create_offer: ApprovalCard,
  update_offer: ApprovalCard,
  archive_offer: ApprovalCard,
  create_pricing_table: ApprovalCard,
}

/** Reads only: they change nothing, so they stay out of the chat. */
const QUIET = new Set(['list_experiences', 'get_experience', 'list_library', 'show_sample'])
const EDITS = new Set(['update_step', 'add_step', 'remove_step', 'start_from_template'])

const TAB_LABEL: Record<string, string> = {
  editor: 'Editor',
  preview: 'Preview',
  targeting: 'Targeting',
  canvas: 'Canvas',
  plan: 'Plan',
}
const STEP_LABEL: Record<string, string> = { loss_aversion: 'a loss aversion', survey: 'a survey', offer: 'an offer' }

function activityLine(name: string, i: Input): string {
  switch (name) {
    case 'navigate':
      return `Opened ${labelOf(i.to as NavLeafId)}`
    case 'open_experience':
      return 'Opened the experience'
    case 'create_experience':
      return `Created “${i.name}”`
    case 'start_from_template':
      return `Used the “${LIBRARY.find((e) => e.id === i.template)?.title ?? i.template}” template`
    case 'update_step':
      return 'Updated a screen'
    case 'add_step':
      return `Added ${STEP_LABEL[String(i.kind)] ?? 'a'} screen`
    case 'remove_step':
      return 'Removed a screen'
    case 'open_tab':
      return `Opened ${TAB_LABEL[String(i.tab)] ?? 'a tab'}`
    case 'set_audience':
      return `Audience: ${audienceName(String(i.audienceId))}`
    case 'set_trigger':
      return i.kind === 'any_page'
        ? 'Shows on any page'
        : `Shows when ${i.kind === 'url' ? 'the URL contains' : 'this event fires:'} ${i.value ?? ''}`
    case 'use_in_experience': {
      const lib = useGrowthLibrary.getState()
      const n = lib.offers.find((o) => o.id === i.refId)?.name ?? lib.pricingTables.find((t) => t.id === i.refId)?.name
      return `Showing “${n ?? i.refId}”`
    }
    case 'set_priority':
      return `Moved to priority ${i.position}`
    case 'set_status':
      return `Status: ${i.status}`
    case 'match_brand':
      return `Matched your brand from ${i.url}`
    case 'update_offer':
      return 'Updated the offer'
    case 'update_survey_reasons':
      return 'Updated the survey reasons'
    case 'remember':
      return `Noted: ${i.fact}`
    case 'update_brief':
      return 'Updated the brief'
    case 'undo':
      return 'Undid the last change'
    default:
      return name.replace(/_/g, ' ')
  }
}

// ---------- text ----------

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, i) => {
    if (chunk.startsWith('**') && chunk.endsWith('**'))
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {chunk.slice(2, -2)}
        </strong>
      )
    if (chunk.startsWith('`') && chunk.endsWith('`'))
      return (
        <code key={i} className="rounded bg-slate-100 px-[4px] text-[12px]">
          {chunk.slice(1, -1)}
        </code>
      )
    return <Fragment key={i}>{chunk}</Fragment>
  })
}

function Prose({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="flex flex-col gap-[8px] text-[13.5px] leading-[1.6] text-slate-800">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0])
          const Tag = ordered ? 'ol' : 'ul'
          return (
            <Tag key={i} className={`flex flex-col gap-[3px] pl-[18px] ${ordered ? 'list-decimal' : 'list-disc'}`}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>
              ))}
            </Tag>
          )
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

// ---------- tool parts ----------

function WorkingOn({ input, onChange }: { input: Input; onChange: () => void }) {
  const objective = OBJECTIVES.find((o) => o.id === input.objective)?.label
  const type = input.type ? TYPE_LABEL[input.type as ExperienceType] : null
  const tags = [objective, type].filter(Boolean).join(' · ')
  return (
    <div className="flex items-center gap-[8px] rounded-[10px] bg-slate-50 px-[10px] py-[6px] text-[12.5px]">
      <span className="text-slate-500">Working on</span>
      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
        {String(input.summary ?? '')}
        {tags && <span className="font-normal text-slate-500"> · {tags}</span>}
      </span>
      <button type="button" onClick={onChange} className="flex-none font-medium text-slate-600 hover:text-slate-900">
        Change
      </button>
    </div>
  )
}

function ToolView({ chatId, part, onChangeTriage }: { chatId: string; part: ToolPart; onChangeTriage: () => void }) {
  const name = part.type.startsWith('tool-') ? part.type.slice(5) : ''
  const input = ((part as { input?: unknown }).input ?? {}) as Input
  const state = part.state
  const answered = state === 'output-available' || state === 'output-error'
  const output = (part as { output?: unknown }).output

  if (state === 'input-streaming') {
    if (QUIET.has(name)) return null
    return <div className="h-[18px] w-[80px] animate-pulse rounded bg-slate-100" />
  }

  if (name === 'triage') return <WorkingOn input={input} onChange={onChangeTriage} />

  const Card = CARDS[name]
  if (
    Card &&
    (INTERACTIVE.has(name) || name === 'show_sample' || (name === 'update_offer' && needsCard(name, input)))
  ) {
    return (
      <Card
        chatId={chatId}
        tool={name}
        toolCallId={part.toolCallId}
        input={input}
        output={output}
        answered={answered}
      />
    )
  }

  if (QUIET.has(name)) return null

  if (state === 'output-error' || (output && typeof output === 'object' && 'error' in output)) {
    const text = (part as { errorText?: string }).errorText ?? String((output as { error?: string }).error)
    return (
      <div className="flex items-start gap-[6px] text-[12.5px] text-rose-700">
        <SIcon name="circle-alert" size={13} className="mt-[2px] flex-none" />
        <span>
          {activityLine(name, input)}: {text}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-[6px] text-[12.5px] text-slate-500">
      <SIcon
        name={answered ? 'check' : 'loader'}
        size={13}
        className={answered ? 'text-emerald-600' : 'animate-spin'}
      />
      <span className="min-w-0 truncate">{activityLine(name, input)}</span>
      {answered && EDITS.has(name) && (
        <button
          type="button"
          onClick={() => undoLast()}
          className="ml-[4px] flex-none font-medium text-slate-500 hover:text-slate-900"
        >
          Undo
        </button>
      )}
    </div>
  )
}

// ---------- the chat ----------

function pendingCard(messages: UIMessage[]): ToolPart | null {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return null
  for (const p of last.parts) {
    if (!('toolCallId' in p)) continue
    const name = p.type.slice(5)
    const input = ((p as { input?: unknown }).input ?? {}) as Input
    if (p.state === 'input-available' && (INTERACTIVE.has(name) || needsCard(name, input))) return p as ToolPart
  }
  return null
}

export function AgentChat({
  chatId,
  placeholder = 'Ask Copilot to change anything',
  empty,
  chips,
  centered = false,
  hero,
}: {
  chatId: string
  placeholder?: string
  /** Shown before the first message. */
  empty?: ReactNode
  chips?: string[]
  /** Home and the blank experience: a column in the middle of the page. */
  centered?: boolean
  /** Before the first message, the heading above a large composer in the middle of the page. */
  hero?: ReactNode
}) {
  const chat = chatFor(chatId)
  const { messages, status, error, sendMessage, stop, regenerate } = useChat({ chat })
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const busy = status === 'submitted' || status === 'streaming'
  const pending = pendingCard(messages)
  const big = Boolean(hero) && messages.length === 0
  const maxInput = big ? 280 : 160

  useEffect(() => {
    if (status === 'ready' || status === 'error') useAgentStore.getState().save(chatId, messages)
  }, [chatId, messages, status])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, status])

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxInput)}px`
    el.style.overflowY = el.scrollHeight > maxInput ? 'auto' : 'hidden'
  }, [text, maxInput])

  const send = (value: string) => {
    const t = value.trim()
    if (!t || busy) return
    setText('')
    if (pending) {
      const name = pending.type.slice(5)
      answerTool(
        chatId,
        name,
        pending.toolCallId,
        name === 'ask_choice' ? { answer: t } : { skipped: true, merchantSaid: t },
      )
      return
    }
    void sendMessage({ text: t })
  }

  const changeTriage = () => {
    setText('Not quite. I want to ')
    inputRef.current?.focus()
  }

  const lastAssistant = messages[messages.length - 1]?.role === 'assistant'
  const thinking = status === 'submitted' || (status === 'streaming' && !lastAssistant)

  const chipRow = chips && chips.length > 0 && messages.length === 0 && (
    <div className={`flex flex-wrap gap-[6px] ${big ? '' : 'mb-[10px]'}`}>
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => send(c)}
          className="rounded-full border border-slate-200 bg-white px-[12px] py-[6px] text-[12.5px] text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          {c}
        </button>
      ))}
    </div>
  )

  const composer = (
    <div className="flex items-end gap-[8px] rounded-[16px] border border-slate-200 bg-white px-[12px] py-[8px] shadow-[0_1px_3px_rgba(15,23,42,0.06)] focus-within:border-slate-300">
      <textarea
        ref={inputRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send(text)
          }
        }}
        placeholder={pending ? 'Answer above, or type here' : placeholder}
        className="max-h-[160px] min-h-[24px] flex-1 resize-none bg-transparent py-[3px] text-[13.5px] leading-[1.5] text-slate-900 outline-none placeholder:text-slate-400"
      />
      {busy ? (
        <button
          type="button"
          onClick={() => void stop()}
          aria-label="Stop"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-900 text-white"
        >
          <SIcon name="square" size={12} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => send(text)}
          disabled={!text.trim()}
          aria-label="Send"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <SIcon name="arrow-up" size={15} />
        </button>
      )}
    </div>
  )

  if (big) {
    return (
      <div className="h-full min-h-0 w-full min-w-0 overflow-y-auto bg-white">
        <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col justify-center px-[20px] py-[40px]">
          {hero}
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) inputRef.current?.focus()
            }}
            className="flex flex-col gap-[14px] rounded-[20px] border border-slate-200 bg-white px-[18px] pb-[14px] pt-[16px] shadow-[0_2px_10px_rgba(15,23,42,0.06)] focus-within:border-slate-300"
          >
            <textarea
              ref={inputRef}
              rows={4}
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(text)
                }
              }}
              placeholder={placeholder}
              className="min-h-[112px] w-full resize-none bg-transparent text-[15px] leading-[1.55] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <div className="flex items-end gap-[12px]">
              <div className="min-w-0 flex-1">{chipRow}</div>
              <button
                type="button"
                onClick={() => send(text)}
                disabled={!text.trim() || busy}
                aria-label="Send"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400"
              >
                <SIcon name="arrow-up" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={`mx-auto flex w-full flex-col gap-[14px] px-[20px] py-[18px] ${centered ? 'max-w-[720px]' : ''}`}
        >
          {messages.length === 0 && empty}
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-[14px] bg-slate-100 px-[12px] py-[8px] text-[13.5px] leading-[1.55] text-slate-900">
                  {m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-[10px]">
                {m.parts.map((p, i) => {
                  if (p.type === 'text') return p.text.trim() ? <Prose key={i} text={p.text} /> : null
                  if ('toolCallId' in p && p.type.startsWith('tool-')) {
                    return (
                      <ToolView key={p.toolCallId} chatId={chatId} part={p as ToolPart} onChangeTriage={changeTriage} />
                    )
                  }
                  return null
                })}
              </div>
            ),
          )}
          {thinking && (
            <div className="flex items-center gap-[6px] text-[12.5px] text-slate-400">
              <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-slate-400" />
              Thinking
            </div>
          )}
          {error && (
            <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-[12px] py-[8px] text-[12.5px] text-rose-800">
              <p>Copilot could not answer. {error.message}</p>
              <button
                type="button"
                onClick={() => void regenerate()}
                className="mt-[4px] font-medium underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`mx-auto w-full flex-none px-[16px] pb-[14px] ${centered ? 'max-w-[720px]' : ''}`}>
        {chipRow}
        {composer}
      </div>
    </div>
  )
}
