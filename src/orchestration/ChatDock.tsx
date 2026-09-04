import { useEffect, useRef, useState, type ReactNode } from 'react'
import { blueprintMeta } from '../lib/blueprints'
import { acceptanceFor, offerDef } from '../lib/growthContext'
import { count, money, moneyRange, pct, pctRange } from '../lib/num'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { applyOps, deriveCompletedPhases } from './assistant/apply'
import { TURNS } from './assistant/flows'
import { ENTRY_TURN_ID, PLAN_CARD_TURN_ID } from './assistant/ids'
import { blueprintForStepCount } from './assistant/recommend'
import { resolveOptions, useAssistant } from './assistant/useAssistant'
import type { ApplyOp, AssistantOption, ChatMessage, SetupPhase } from './assistant/types'
import type { PlanMapping } from './assistant/planner'
import type { ShellLayout } from '../types/experience'
import { AUDIENCE_LIBRARY, conditionExpression } from '../types/orchestration'
import type { SplitNode, TriggerMoment } from '../types/orchestration'

const RAIL: { phase: SetupPhase; label: string; node: 'flow' | 'trigger' | 'audience' | 'split' }[] = [
  { phase: 'blueprint', label: 'Flow', node: 'flow' },
  { phase: 'trigger', label: 'Trigger', node: 'trigger' },
  { phase: 'audience', label: 'Audience', node: 'audience' },
  { phase: 'split', label: 'Split', node: 'split' },
]

const TRIGGER_PRESETS: { moment: TriggerMoment; label: string; expression?: string; short: string }[] = [
  { moment: 'custom_page', label: 'Custom page load', expression: '/account/cancel', short: 'Cancel page load' },
  { moment: 'any_page', label: 'Any page load', short: 'Any page load' },
]

type AudienceOp = Extract<ApplyOp, { t: 'audience' }>
const AUDIENCE_PRESETS: { short: string; op: AudienceOp }[] = [
  {
    short: 'All subscribers',
    op: { t: 'audience', name: 'All subscribers', ruleType: 'ALL_AUDIENCE', targetAll: true, savedAudienceId: null, conditions: [] },
  },
  ...AUDIENCE_LIBRARY.map((a) => ({
    short: a.name,
    op: {
      t: 'audience' as const,
      name: a.name,
      ruleType: 'TARGETING' as const,
      savedAudienceId: a.id,
      match: a.match,
      conditions: a.conditions,
      expression: conditionExpression(a.conditions, a.match),
    },
  })),
]

const SHELL_PRESETS: { shell: ShellLayout; short: string }[] = [
  { shell: 'modal', short: 'Modal overlay' },
  { shell: 'fullpage', short: 'Full page' },
  { shell: 'fullpage_scroll', short: 'Full-page scroll' },
]

/**
 * Entry options that belong under the divider rather than in the conversation.
 * The guided chat is the primary route, so the ways around it sit apart from it
 * — as cards here, and as the "Expert?" link below them.
 */
const ALTERNATIVE_CARDS: Record<string, { title: string; desc?: string; icon?: ReactNode }> = {
  template: {
    title: 'Browse templates',
    desc: 'Ready-made flows you can customise',
    icon: <LayoutIcon />,
  },
  quick: { title: 'Quick Start: Balanced 4-step default' },
}

const EXPERT_OPTION_ID = 'power'

const isAlternative = (id: string) => id in ALTERNATIVE_CARDS || id === EXPERT_OPTION_ID

/** What the assistant is for — behind the header's help button. */
const INTRO =
  "Describe what you want in the box below and I'll draft a plan against your own cancel data — reason mix, offer acceptance and retained revenue — before anything is built."

export function ChatDock() {
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  useOrchestration((s) => s.play)
  useExperience((s) => s.experience)

  const messages = useAssistant((s) => s.messages)
  const ctx = useAssistant((s) => s.ctx)
  const pending = useAssistant((s) => s.pending)
  const threadOpen = useAssistant((s) => s.threadOpen)
  const selectOption = useAssistant((s) => s.selectOption)
  const submitText = useAssistant((s) => s.submitText)
  const confirmApply = useAssistant((s) => s.confirmApply)
  const cancelConfirm = useAssistant((s) => s.cancelConfirm)
  const applyMessageAction = useAssistant((s) => s.applyMessageAction)
  const closeThread = useAssistant((s) => s.closeThread)
  const reset = useAssistant((s) => s.reset)

  const [draft, setDraft] = useState('')
  const [introOpen, setIntroOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const guidedView =
    ctx.currentTurnId === ENTRY_TURN_ID
      ? 'home'
      : ctx.currentTurnId === PLAN_CARD_TURN_ID
      ? 'draft'
      : ctx.currentTurnId === 'PLAN'
      ? 'plan'
      : ctx.currentTurnId === 'DONE'
      ? 'done'
      : 'chat'
  // An open annotation thread always shows the transcript, overriding the guided panel.
  const view = threadOpen ? 'chat' : guidedView

  // The entry turn is a conversation like any other now, so its options resolve
  // the same way — they are just split across the chat and the alternatives.
  const conversation = view === 'home' || view === 'chat'
  const turn = conversation && ctx.currentTurnId ? TURNS[ctx.currentTurnId] : null
  const options = !threadOpen && turn ? resolveOptions(turn, ctx) : []
  const atEntry = view === 'home'
  const answerOptions = atEntry ? options.filter((o) => !isAlternative(o.id)) : options
  const alternatives = atEntry ? options.filter((o) => isAlternative(o.id)) : []
  const done = deriveCompletedPhases()
  const showRail = view === 'chat' || view === 'plan'
  const showInput = conversation && !pending
  const title = threadOpen
    ? 'Canvas thread'
    : view === 'draft'
    ? 'Draft plan'
    : view === 'plan'
    ? 'Review your plan'
    : view === 'done'
    ? 'All set'
    : 'Let’s build your cancel experience'

  useEffect(() => {
    const el = scrollRef.current
    // Opening on the greeting rather than the bottom of the alternatives.
    if (el && view !== 'home') el.scrollTop = el.scrollHeight
  }, [messages, pending, view])

  // Auto-open the pane so an incoming annotation reply is visible.
  useEffect(() => {
    if (threadOpen) setAssistantOpen(true)
  }, [threadOpen, setAssistantOpen])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    submitText(text)
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-0 w-full cursor-default flex-col overflow-hidden bg-white">
      <div className="flex h-[58px] flex-none items-center justify-between gap-2 border-b border-slate-200 px-4 shadow-[0_2px_4px_rgba(15,23,42,0.04)]">
        <div className="flex min-w-0 items-center gap-1">
          {threadOpen ? (
            <button
              type="button"
              onClick={closeThread}
              className="flex h-6 flex-none items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Back to setup"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Setup
            </button>
          ) : (
            view !== 'home' && (
              <button
                type="button"
                onClick={reset}
                className="-ml-1 flex h-6 w-6 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Start over"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )
          )}
          <h2 className="truncate text-[15px] font-bold text-slate-900">{title}</h2>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          {/* Only worth its width before the conversation starts — and the space
              is needed for the back button once it has. */}
          {atEntry && (
            <button
              type="button"
              onClick={() => setIntroOpen((v) => !v)}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                introOpen
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
              title="What does this do?"
            >
              <HelpIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => setAssistantOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Collapse pane"
          >
            <CollapseIcon />
          </button>
        </div>
      </div>

      {atEntry && introOpen && (
        <p className="flex-none border-b border-slate-200 bg-violet-50/70 px-4 py-2.5 text-[12px] leading-relaxed text-slate-600">
          {INTRO}
        </p>
      )}

      {showRail && (
        <div className="flex flex-none items-center gap-1.5 border-b border-slate-100 px-4 py-2">
          {RAIL.map((r, i) => {
            const complete = done.includes(r.phase)
            return (
              <button key={r.phase} type="button" onClick={() => applyOps([{ t: 'focus', node: r.node }])} className="group flex items-center gap-1" title={`Go to ${r.label}`}>
                <span className={`h-2 w-2 rounded-full transition-colors ${complete ? 'bg-emerald-500' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
                <span className={`text-[10px] font-semibold ${complete ? 'text-slate-600' : 'text-slate-400'}`}>{r.label}</span>
                {i < RAIL.length - 1 && <span className="ml-0.5 text-slate-300">·</span>}
              </button>
            )
          })}
        </div>
      )}

      {(pending ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
              <div className="text-[12.5px] font-bold text-slate-900">{pending.title}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-slate-600">{pending.lines.join(' ')}</div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={confirmApply} className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-800">
                  Replace steps
                </button>
                <button type="button" onClick={cancelConfirm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-white">
                  Keep mine
                </button>
              </div>
            </div>
          </div>
        ) : view === 'draft' ? (
          <PlanCardView />
        ) : view === 'plan' ? (
          <PlanView />
        ) : view === 'done' ? (
          <DoneView onStartOver={reset} />
        ) : (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 pb-2 pt-5">
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <ChatRow
                  key={m.id}
                  message={m}
                  onApply={() => applyMessageAction(m.id)}
                  // A question following an answer opens a new exchange, so it
                  // gets the wider gap that separates one from the next.
                  spaced={i > 0 && m.role === 'assistant' && messages[i - 1].role === 'user'}
                />
              ))}
            </div>
            {answerOptions.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 pl-10">
                {answerOptions.map((o) => (
                  <AnswerPill
                    key={o.id}
                    option={o}
                    // A recommendation only says something next to alternatives.
                    showRecommended={answerOptions.length > 1}
                    onSelect={() => selectOption(o.id)}
                  />
                ))}
              </div>
            )}
            {alternatives.length > 0 && (
              <Alternatives options={alternatives} onPick={selectOption} />
            )}
          </div>
        ))}

      {showInput && (
        <div className="flex-none bg-slate-50 px-4 pb-4 pt-2">
          <AssistantInput
            value={draft}
            onChange={setDraft}
            onSend={send}
            placeholder={
              atEntry ? 'Describe the cancel flow you want…' : 'Ask anything, or type a request…'
            }
          />
        </div>
      )}
    </div>
  )
}

function AssistantInput({
  value,
  onChange,
  onSend,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)] transition-colors focus-within:border-indigo-300">
      {/* Bottom padding keeps the growing text clear of the send button. */}
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
        }}
        placeholder={placeholder}
        className="min-h-[88px] max-h-[160px] w-full resize-none bg-transparent px-4 pb-12 pt-4 text-[13.5px] leading-[1.5] text-slate-800 outline-none placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!value.trim()}
        title="Send"
        className="absolute bottom-3 right-3 flex h-[31px] w-[31px] items-center justify-center rounded-md bg-indigo-600 text-white shadow-[0_6px_7px_rgba(79,70,229,0.2)] transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:shadow-none"
      >
        <SendIcon />
      </button>
    </div>
  )
}

/**
 * One line of the transcript. The assistant speaks in a bubble tailed toward the
 * pane's edge; the merchant's reply is the answer they picked, so it keeps the
 * shape of the pill they clicked and sits indented under the question.
 */
function ChatRow({
  message,
  onApply,
  spaced,
}: {
  message: ChatMessage
  onApply: () => void
  spaced: boolean
}) {
  if (message.role === 'user') {
    return (
      <div className={`pl-10 ${spaced ? 'mt-3' : ''}`}>
        <div className="flex items-start gap-2.5 rounded-xl border-[1.5px] border-indigo-600 bg-indigo-50 px-4 py-3 text-[14px] font-semibold leading-[1.4] text-indigo-700">
          <span className="flex-none">↳</span>
          <span className="min-w-0 flex-1 whitespace-pre-line">{message.text}</span>
        </div>
      </div>
    )
  }
  return (
    <div className={`flex flex-col items-start ${spaced ? 'mt-3' : ''}`}>
      {message.ref && (
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 10l-5 5 5 5M4 15h11a5 5 0 0 0 5-5V4" />
          </svg>
          {message.ref.label}
        </span>
      )}
      <div className="w-full whitespace-pre-line rounded-2xl rounded-tl-[4px] border border-purple-200 bg-violet-50 p-3 text-[14px] font-medium leading-[1.4] text-slate-900 shadow-[0_2px_5px_rgba(15,23,42,0.04)]">
        {message.text}
      </div>
      {message.action && (
        <button
          type="button"
          onClick={onApply}
          disabled={message.action.applied}
          className={`mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            message.action.applied
              ? 'cursor-default bg-emerald-50 text-emerald-700'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {message.action.applied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Applied
            </>
          ) : (
            message.action.label
          )}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ways around the conversation
// ---------------------------------------------------------------------------

/**
 * The routes that skip the guided chat, kept below a divider so the
 * recommendation above reads first. Cards carry their own shorter copy; the
 * option's own label is the tooltip, since that is what the transcript records.
 */
function Alternatives({
  options,
  onPick,
}: {
  options: AssistantOption[]
  onPick: (id: string) => void
}) {
  const cards = options.filter((o) => o.id in ALTERNATIVE_CARDS)
  const expert = options.find((o) => o.id === EXPERT_OPTION_ID)
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          or choose alternative
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="mt-4 flex flex-col">
        {cards.map((o, i) => {
          const meta = ALTERNATIVE_CARDS[o.id]
          // Joined into one block: the seam between cards is a single hairline.
          const seam = [
            i === 0 ? 'rounded-t-xl' : '-mt-px',
            i === cards.length - 1 ? 'rounded-b-xl' : '',
          ].join(' ')
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o.id)}
              title={o.label}
              className={`group relative flex items-center gap-3 border border-slate-200 bg-white p-3.5 text-left transition-colors hover:z-10 hover:border-indigo-300 hover:bg-indigo-50/40 ${seam}`}
            >
              {meta.icon && (
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors group-hover:bg-white group-hover:text-indigo-600">
                  {meta.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-slate-900">{meta.title}</span>
                {meta.desc && (
                  <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
                    {meta.desc}
                  </span>
                )}
              </span>
              <span className="flex-none text-slate-400 transition-colors group-hover:text-indigo-500">
                <ChevronRightIcon />
              </span>
            </button>
          )
        })}
      </div>
      {expert && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => onPick(expert.id)}
            title={expert.label}
            className="text-[12px] font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900 hover:decoration-slate-500"
          >
            Expert? <span className="text-slate-900">Advanced setup manually</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draft plan card (conversational pathway)
// ---------------------------------------------------------------------------

function PlanCardView() {
  const plan = useAssistant((s) => s.ctx.plan)
  const swapPlanOffer = useAssistant((s) => s.swapPlanOffer)
  const buildPlanNow = useAssistant((s) => s.buildPlanNow)
  const adjustPlan = useAssistant((s) => s.adjustPlan)

  if (!plan) return null
  const meta = blueprintMeta(plan.blueprint)
  const p = plan.projection

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
            Draft — not published
          </div>
          <h2 className="mt-2 text-[15px] font-bold leading-snug text-slate-900">{plan.goal}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Tag>{plan.segmentName}</Tag>
            <Tag>
              {meta.name} · {meta.posture.replace('_', ' ')}
            </Tag>
            <Tag>
              {plan.split.treatment}/{plan.split.holdout} split
            </Tag>
          </div>
        </div>

        <Section title="Flow">
          <ol className="space-y-1.5">
            {plan.steps.map((s, i) => (
              <li key={s.stage} className="flex gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold tabular-nums text-slate-500">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold text-slate-800">{s.label}</span>
                  <span className="block text-[11px] leading-snug text-slate-500">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>

        {plan.mappings.length > 0 && (
          <Section
            title="Reason → offer"
            hint={`${pct(p.coverage)} of cancels covered`}
          >
            <div className="space-y-1.5">
              {plan.mappings.map((m) => (
                <MappingRow
                  key={m.code}
                  mapping={m}
                  segmentId={plan.segmentId}
                  swappable={plan.steps.some((s) => s.stage === 'save_offers')}
                  onSwap={(offerId) => swapPlanOffer(m.code, offerId)}
                />
              ))}
            </div>
          </Section>
        )}

        <Section title="Projected outcomes" hint="per month">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Cancels reached" value={count(p.reach)} sub={`${count(p.eligible)} eligible`} />
            <Metric label="Save rate" value={pctRange(p.saveRate)} sub={`${pct(p.offerDrivenShare)} from offers`} />
            <Metric
              label="Retained MRR"
              value={moneyRange(p.retainedMrr)}
              sub={`${Math.round(p.savesPerMonth[0])}–${Math.round(p.savesPerMonth[1])} saves`}
            />
            <Metric
              label="Margin cost"
              value={p.marginCostPct > 0 ? money(p.marginCost) : '—'}
              sub={p.marginCostPct > 0 ? `${pct(p.marginCostPct)} of offer-retained revenue` : 'No offers in this flow'}
            />
          </div>
        </Section>

        {plan.conflicts.length > 0 && (
          <Section title="Watch out">
            <ul className="space-y-1.5">
              {plan.conflicts.map((c) => (
                <li key={c} className="flex gap-2 rounded-lg bg-amber-50 p-2 text-[11.5px] leading-snug text-amber-900">
                  <span className="flex-none font-bold">!</span>
                  {c}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Assumptions">
          <ul className="space-y-1">
            {plan.assumptions.map((a) => (
              <li key={a} className="flex gap-2 text-[11.5px] leading-snug text-slate-500">
                <span className="mt-[6px] h-1 w-1 flex-none rounded-full bg-slate-300" />
                {a}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="flex-none space-y-2 border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={buildPlanNow}
          className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800"
        >
          Build this
        </button>
        <button
          type="button"
          onClick={adjustPlan}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          Adjust something
        </button>
      </div>
    </div>
  )
}

function MappingRow({
  mapping,
  segmentId,
  swappable,
  onSwap,
}: {
  mapping: PlanMapping
  segmentId: string
  swappable: boolean
  onSwap: (offerId: string | null) => void
}) {
  const chosen = mapping.offerId ? offerDef(mapping.offerId) : null
  const choices = [mapping.offerId, ...mapping.alternatives].filter(
    (id, i, arr): id is string => Boolean(id) && arr.indexOf(id) === i,
  )
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11.5px] font-semibold text-slate-800">{mapping.short}</span>
        <span className="flex-none text-[10.5px] tabular-nums text-slate-400">{pct(mapping.share)} of cancels</span>
      </div>
      {swappable ? (
        <select
          value={mapping.offerId ?? ''}
          onChange={(e) => onSwap(e.target.value || null)}
          className="mt-1.5 w-full cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-medium text-slate-800 outline-none hover:border-slate-300 focus:border-indigo-400"
        >
          <option value="">No offer — go straight to confirmation</option>
          {choices.map((id) => {
            const def = offerDef(id)
            if (!def) return null
            return (
              <option key={id} value={id}>
                {def.label} · {pct(acceptanceFor(def, segmentId))} accept · {pct(def.marginCostPct)} cost
              </option>
            )
          })}
        </select>
      ) : (
        <div className="mt-0.5 text-[11px] text-slate-500">
          {chosen ? chosen.label : 'Captured for analytics — no offer in this posture'}
        </div>
      )}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</span>
        {hint && <span className="text-[10.5px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-[13px] font-bold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[10.5px] leading-snug text-slate-500">{sub}</div>}
    </div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Plan (editable)
// ---------------------------------------------------------------------------

function PlanView() {
  const play = useOrchestration((s) => s.play)
  const experience = useExperience((s) => s.experience)
  const configure = useAssistant((s) => s.configure)

  const meta = blueprintMeta(experience.blueprint)
  const steps = meta.stepCount
  const split = play.targeting.kind === 'split' ? (play.targeting as SplitNode) : null
  const treatments = split ? split.branches.filter((b) => b.node.kind === 'flow') : []
  const treatmentPct = treatments.reduce((s, b) => s + b.percent, 0)
  const holdoutPct = 100 - treatmentPct
  const singleTreatment = treatments.length <= 1

  const triggerIdx = TRIGGER_PRESETS.findIndex((p) => p.moment === play.trigger.moment)
  const audienceIdx = Math.max(
    0,
    play.audience.targetAll
      ? 0
      : AUDIENCE_PRESETS.findIndex(
          (p) =>
            (play.audience.savedAudienceId && p.op.savedAudienceId === play.audience.savedAudienceId) ||
            p.op.name === play.audience.name,
        ),
  )

  const setSteps = (n: number) => {
    const clamped = Math.min(6, Math.max(1, n))
    if (clamped !== steps) applyOps([{ t: 'blueprint', id: blueprintForStepCount(clamped) }])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <div className="text-[13px] font-bold text-slate-900">Here’s your plan</div>
          <div className="text-[11.5px] text-slate-500">Fine-tune anything below, then configure it.</div>
        </div>

        <PlanRow label="Cancel flow" hint={`${meta.name} · ${meta.posture.replace('_', ' ')} posture`}>
          <div className="flex items-center gap-2">
            <Stepper value={steps} onDec={() => setSteps(steps - 1)} onInc={() => setSteps(steps + 1)} />
            <span className="text-[12px] text-slate-500">
              {steps} step{steps > 1 ? 's' : ''}
            </span>
          </div>
        </PlanRow>

        <PlanRow label="Trigger" hint="When the play fires">
          <MiniSelect
            value={triggerIdx < 0 ? 0 : triggerIdx}
            options={TRIGGER_PRESETS.map((p) => p.short)}
            onChange={(i) => {
              const p = TRIGGER_PRESETS[i]
              applyOps([{ t: 'trigger', moment: p.moment, label: p.label, expression: p.expression }])
            }}
          />
        </PlanRow>

        <PlanRow label="Audience" hint="Who is eligible">
          <MiniSelect
            value={audienceIdx}
            options={AUDIENCE_PRESETS.map((p) => p.short)}
            onChange={(i) => applyOps([AUDIENCE_PRESETS[i].op])}
          />
        </PlanRow>

        <PlanRow label="Traffic split" hint={`${treatmentPct}% treatment · ${holdoutPct}% holdout`}>
          {singleTreatment ? (
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={treatmentPct}
              onChange={(e) => {
                const t = Number(e.target.value)
                applyOps([{ t: 'split', treatment: t, holdout: 100 - t }])
              }}
              className="w-full accent-indigo-600"
            />
          ) : (
            <div className="text-[12px] text-slate-500">A/B test — adjust percents on the split node.</div>
          )}
        </PlanRow>

        <PlanRow label="Presentation" hint="How it renders">
          <MiniSelect
            value={Math.max(0, SHELL_PRESETS.findIndex((p) => p.shell === experience.shell))}
            options={SHELL_PRESETS.map((p) => p.short)}
            onChange={(i) => applyOps([{ t: 'shell', shell: SHELL_PRESETS[i].shell }])}
          />
        </PlanRow>
      </div>

      <div className="flex-none space-y-2 border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={configure}
          className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800"
        >
          Configure this experience
        </button>
        <button
          type="button"
          onClick={() => applyOps([{ t: 'preview' }])}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          Preview first
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

function DoneView({ onStartOver }: { onStartOver: () => void }) {
  const play = useOrchestration((s) => s.play)
  const experience = useExperience((s) => s.experience)
  const meta = blueprintMeta(experience.blueprint)
  const live = play.publishState === 'live'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mt-3 text-[16px] font-bold text-slate-900">Your experience is configured</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
          {meta.name} is wired to {play.trigger.label.toLowerCase()} for {play.audience.name.toLowerCase()}.
          Preview it, publish when ready, or keep editing on the canvas.
        </p>
      </div>
      <div className="flex-none space-y-2 border-t border-slate-100 p-3">
        <button type="button" onClick={() => applyOps([{ t: 'preview' }])} className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800">
          Preview as subscriber
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => applyOps([{ t: 'publish' }])} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50">
            {live ? 'Unpublish' : 'Publish'}
          </button>
          <button type="button" onClick={() => applyOps([{ t: 'focus', node: 'flow' }])} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50">
            Edit steps
          </button>
        </div>
        <button type="button" onClick={onStartOver} className="w-full rounded-xl px-3 py-2 text-[12px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          Start over
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function PlanRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-bold text-slate-700">{label}</span>
        {hint && <span className="text-[10.5px] text-slate-400">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
      <button type="button" onClick={onDec} disabled={value <= 1} className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30">
        −
      </button>
      <span className="w-6 text-center text-[12.5px] font-bold tabular-nums text-slate-900">{value}</span>
      <button type="button" onClick={onInc} disabled={value >= 6} className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30">
        +
      </button>
    </div>
  )
}

function MiniSelect({ value, options, onChange }: { value: number; options: string[]; onChange: (i: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-800 outline-none hover:border-slate-300 focus:border-indigo-400"
    >
      {options.map((o, i) => (
        <option key={o} value={i}>
          {o}
        </option>
      ))}
    </select>
  )
}

const PILL_STYLES: Record<string, string> = {
  primary: 'border-indigo-600 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
  secondary:
    'border-slate-200 bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.03)] hover:border-indigo-300 hover:bg-indigo-50/40',
  ghost: 'border-transparent text-slate-500 hover:bg-white hover:text-slate-700',
}

/**
 * One answer the merchant can pick. Selecting it echoes back into the transcript
 * in the same shape, so the conversation reads as a list of what was chosen.
 */
function AnswerPill({
  option,
  showRecommended,
  onSelect,
}: {
  option: AssistantOption
  showRecommended: boolean
  onSelect: () => void
}) {
  const variant = option.variant ?? 'secondary'
  const accent = variant === 'primary'
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-2.5 rounded-xl border-[1.5px] px-4 py-3 text-left text-[14px] leading-[1.4] transition-colors ${PILL_STYLES[variant]}`}
    >
      <span className={`flex-none font-semibold ${accent ? '' : 'text-slate-700'}`}>↳</span>
      <span className="min-w-0 flex-1">
        <span className={`block ${accent ? 'font-semibold' : 'font-medium'}`}>{option.label}</span>
        {option.hint && (
          <span
            className={`mt-1 block text-[11.5px] font-normal leading-snug ${
              accent ? 'text-indigo-500' : 'text-slate-500'
            }`}
          >
            {option.hint}
          </span>
        )}
      </span>
      {option.recommended && showRecommended && (
        <span
          className={`mt-0.5 flex-none rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            accent ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
          }`}
        >
          Suggested
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CollapseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h6V4M20 14h-6v6M14 10l7-7M3 21l7-7" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.7 1.2c0 1.7-2.3 2-2.3 3.4M12 17h.01" />
    </svg>
  )
}

function LayoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2.25 6.75H15.75M6.75 15.75V6.75M3.75 2.25H14.25C15.0784 2.25 15.75 2.92157 15.75 3.75V14.25C15.75 15.0784 15.0784 15.75 14.25 15.75H3.75C2.92157 15.75 2.25 15.0784 2.25 14.25V3.75C2.25 2.92157 2.92157 2.25 3.75 2.25Z" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 12L10 8L6 4" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <path d="M11.0436 16.4371C10.9797 16.395 10.9302 16.3344 10.9017 16.2634L8.51647 10.3146C8.44101 10.1271 8.32843 9.95684 8.1855 9.81394C8.04127 9.66999 7.87043 9.55742 7.6824 9.48215L1.7344 7.09723C1.66338 7.06874 1.60278 7.01921 1.56073 6.95529C1.51868 6.89136 1.49719 6.8161 1.49915 6.73962C1.50111 6.66313 1.52642 6.58907 1.57169 6.52738C1.61696 6.4657 1.68002 6.41933 1.7524 6.39451L16.0036 1.51968C16.0701 1.49568 16.142 1.4911 16.211 1.50648C16.2799 1.52185 16.3431 1.55655 16.3931 1.60651C16.443 1.65647 16.4777 1.71963 16.4931 1.78859C16.5085 1.85755 16.5039 1.92946 16.4799 1.99591L11.6045 16.2454C11.5797 16.3178 11.5333 16.3808 11.4716 16.4261C11.4099 16.4714 11.3358 16.4967 11.2593 16.4986C11.1828 16.5006 11.1076 16.4791 11.0436 16.4371Z" />
    </svg>
  )
}

