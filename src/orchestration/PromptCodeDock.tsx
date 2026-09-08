import { useEffect, useMemo, useRef, useState } from 'react'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useExperience } from '../store/useExperience'
import { EMPTY_JOURNEY, type JourneyTemplate } from '../journey/types'
import { startFromTemplate, templateLabel, withLive } from '../journey/templates'
import { interpret } from '../journey/intake'
import { JourneyPlan } from './JourneyPlan'
import { CopilotMark } from './CopilotMark'
import { useCopilotThread } from './copilotThread'

type PromptTurn = 'kind' | 'cancel_template' | 'plan' | 'done'

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-[13px] leading-snug text-slate-800 transition-colors hover:bg-slate-50"
    >
      {label}
    </button>
  )
}

function OptionBtn({
  label,
  hint,
  onClick,
}: {
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50"
    >
      <div className="text-[13px] font-medium text-slate-800">{label}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-slate-500">{hint}</div>}
    </button>
  )
}

/** Copilot composer: paperclip, growing field, blue send. */
function PromptInput({
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
    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)] transition-colors focus-within:border-slate-300">
      <span className="pointer-events-none absolute bottom-3 left-3 text-slate-400" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </span>
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
        className="min-h-[52px] max-h-[160px] w-full resize-none bg-transparent py-3.5 pl-10 pr-12 text-[13px] leading-[1.5] text-slate-800 outline-none placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!value.trim()}
        title="Send"
        className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#377dff] text-white transition-opacity hover:bg-[#2f6eeb] disabled:opacity-30"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.4 20.4 22 12 3.4 3.6 3 10.7l12.2 1.3L3 13.3z" />
        </svg>
      </button>
    </div>
  )
}

/**
 * Prompt fills the file; Code is the file. Chrome matches Chargebee Copilot;
 * the suggestions are cancel-journey workflows, not billing FAQs.
 */
export function PromptCodeDock() {
  const dockMode = useJourney((s) => s.dockMode)
  const setDockMode = useJourney((s) => s.setDockMode)
  const yaml = useJourney((s) => s.yaml)
  const yamlError = useJourney((s) => s.yamlError)
  const setYaml = useJourney((s) => s.setYaml)
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const patchFile = useJourney((s) => s.patchFile)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const annotateMode = useOrchestration((s) => s.annotateMode)
  const setAnnotateMode = useOrchestration((s) => s.setAnnotateMode)
  const closeAnnotation = useOrchestration((s) => s.closeAnnotation)

  const [turn, setTurn] = useState<PromptTurn>('kind')
  const lines = useCopilotThread((s) => s.lines)
  const say = useCopilotThread((s) => s.say)
  const resetThread = useCopilotThread((s) => s.reset)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [draftYaml, setDraftYaml] = useState(yaml)

  const emptyHome = dockMode === 'prompt' && turn === 'kind' && lines.length === 0

  useEffect(() => {
    setDraftYaml(yaml)
  }, [yaml])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, turn])

  const reset = () => {
    replaceFile(EMPTY_JOURNEY)
    setTurn('kind')
    setDraft('')
    resetThread()
  }

  const showPlan = (next: typeof file, message: string) => {
    const live = { ...next, steps: withLive(next.steps, true) }
    replaceFile(live)
    say('bot', message)
    setTurn('plan')
  }

  const pickKind = (kind: 'cancel' | 'acquisition') => {
    say('you', kind === 'cancel' ? 'A cancel experience' : 'An acquisition flow')
    if (kind === 'acquisition') {
      const next = startFromTemplate({ ...EMPTY_JOURNEY, kind: 'acquisition' }, 'acquire_2')
      showPlan(next, 'Pricing table, then checkout. Edit the plan below — audience, shell, brand — then confirm.')
      return
    }
    patchFile({ kind: 'cancel', name: 'Cancel experience' })
    say('bot', 'How many steps? I’ll drop a skeleton, then a plan you can click through.')
    setTurn('cancel_template')
  }

  const pickTemplate = (template: JourneyTemplate) => {
    say('you', templateLabel(template))
    const next = startFromTemplate(file, template)
    showPlan(next, 'Here’s the plan. Change offers, audience, shell, and brand here — you don’t have to type them.')
  }

  const startTemplate = (template: JourneyTemplate) => {
    say('you', templateLabel(template))
    const next = startFromTemplate(EMPTY_JOURNEY, template)
    showPlan(next, 'Here’s the plan. Change offers, audience, shell, and brand here — you don’t have to type them.')
  }

  const confirmPlan = () => {
    say('you', 'Looks good')
    say('bot', 'File is the source of truth. Reopen the plan to reconfigure, switch to Code to edit it, or Preview to walk it as a subscriber.')
    setTurn('done')
  }

  /**
   * Typing skips the turns. Whatever the free text can be read as goes
   * straight into the file, then we land on the plan so the rest is clicks.
   */
  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    say('you', text)
    const read = interpret(text, file)
    if (read.changed) replaceFile(read.file)
    say('bot', read.reply)
    if (read.changed && read.file.steps.length > 0) setTurn('plan')
  }

  const options = useMemo(() => {
    if (turn === 'kind') {
      return (
        <div className="space-y-2">
          <SuggestionChip
            label="Build a cancel save flow with survey, offer, and confirm"
            onClick={() => pickKind('cancel')}
          />
          <SuggestionChip label="Start a 1-step click to cancel" onClick={() => startTemplate('cancel_1')} />
          <SuggestionChip label="4-step balanced cancel journey" onClick={() => startTemplate('cancel_4')} />
          <SuggestionChip label="5-step save-aggressive cancel flow" onClick={() => startTemplate('cancel_5')} />
          <SuggestionChip label="Pricing table → hosted checkout" onClick={() => pickKind('acquisition')} />
        </div>
      )
    }
    if (turn === 'cancel_template') {
      return (
        <div className="space-y-2">
          {(['cancel_1', 'cancel_2', 'cancel_3', 'cancel_4', 'cancel_5'] as const).map((id) => (
            <SuggestionChip key={id} label={templateLabel(id)} onClick={() => pickTemplate(id)} />
          ))}
        </div>
      )
    }
    if (turn === 'plan') {
      return (
        <JourneyPlan
          onConfirm={confirmPlan}
          onPreview={() => useExperience.getState().setMode('play')}
        />
      )
    }
    if (turn === 'done') {
      return (
        <div className="space-y-3">
          <JourneyPlan
            confirmed
            onConfirm={() => setTurn('plan')}
            onPreview={() => useExperience.getState().setMode('play')}
          />
          <OptionBtn label="Start over" hint="Clears the file and the canvas" onClick={reset} />
        </div>
      )
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, file])

  const subtitle = emptyHome
    ? 'New Conversation'
    : dockMode === 'code'
      ? 'Journey file'
      : file.name && file.template !== 'none'
        ? file.name
        : 'New Conversation'

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div className="flex h-14 flex-none items-center justify-between gap-2 border-b border-slate-100 px-3">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-bold leading-tight text-slate-900">Chargebee Copilot</h2>
          <p className="truncate text-[11px] text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const next = !annotateMode
              setAnnotateMode(next)
              if (next) {
                setAssistantOpen(true)
                setDockMode('prompt')
              } else {
                closeAnnotation()
              }
            }}
            title={annotateMode ? 'Exit annotate' : 'Annotate — click a canvas element to ask about it'}
            aria-pressed={annotateMode}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${
              annotateMode
                ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="M13 13l6 6" />
            </svg>
          </button>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(['prompt', 'code'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDockMode(m)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                  dockMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAssistantOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            title="Collapse Copilot"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M15 4v16" />
            </svg>
          </button>
        </div>
      </div>

      {dockMode === 'code' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="flex-none border-b border-slate-100 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
            This is the logic document. Edit it and the preview updates. Invalid YAML stays on the page until it parses.
          </p>
          <textarea
            value={draftYaml}
            onChange={(e) => setDraftYaml(e.target.value)}
            onBlur={() => setYaml(draftYaml)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-slate-50 px-3 py-3 font-mono text-[12px] leading-relaxed text-slate-800 outline-none"
          />
          {yamlError ? (
            <div className="flex-none border-t border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{yamlError}</div>
          ) : (
            <div className="flex-none border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              Blur or tab away to compile
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-white px-4 pb-3 pt-5">
            {emptyHome ? (
              <div className="flex flex-col items-center">
                <CopilotMark size={72} className="shadow-[0_8px_24px_rgba(15,23,42,0.12)]" alt="" />
                <h3 className="mt-5 text-[22px] font-bold tracking-tight text-slate-900">Ask me anything</h3>
                <p className="mt-2 max-w-[320px] text-center text-[13px] leading-relaxed text-slate-500">
                  Get help building cancel experiences — save flows, surveys, offers, confirmation, and hosted checkout. Choose a suggestion below, or describe the journey you want.
                </p>
                <div className="mt-6 w-full space-y-2">{options}</div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {lines.map((m) => (
                    <div key={m.id} className={m.from === 'you' ? 'flex justify-end' : ''}>
                      <div className="max-w-[92%]">
                        {m.ref && (
                          <div
                            className={`mb-1 text-[10px] font-semibold ${
                              m.from === 'you' ? 'text-right text-sky-700' : 'text-sky-600'
                            }`}
                          >
                            On {m.ref}
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                            m.from === 'you' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">{options}</div>
              </>
            )}
          </div>
          <div className="flex-none bg-white px-3 pb-2 pt-1">
            <PromptInput
              value={draft}
              onChange={setDraft}
              onSend={send}
              placeholder="Ask Copilot..."
            />
            <p className="mt-2 px-1 text-center text-[10px] leading-snug text-slate-400">
              By using Chargebee Copilot, you accept our third-party AI terms.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
