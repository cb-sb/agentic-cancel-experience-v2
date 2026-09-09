import { useEffect, useMemo, useRef, useState } from 'react'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useExperience } from '../store/useExperience'
import { EMPTY_JOURNEY, type JourneyTemplate } from '../journey/types'
import { LIBRARY, startFromTemplate, templateLabel, withLive } from '../journey/templates'
import { interpret } from '../journey/intake'
import { renderContext } from '../journey/contextDoc'
import {
  PlanBeatCard,
  PlanSummary,
  beatPrompt,
  planIntro,
  type PlanBeat,
} from './JourneyPlan'
import { CopilotMark } from './CopilotMark'
import { DesignModeIcon } from './DesignModeIcon'
import { useCopilotThread } from './copilotThread'
import { useAssistant } from './assistant/useAssistant'

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

function AnnotateApply({ messageId }: { messageId: number }) {
  const action = useAssistant((s) => s.messages.find((m) => m.id === messageId)?.action)
  const applyMessageAction = useAssistant((s) => s.applyMessageAction)
  if (!action) return null
  return (
    <button
      type="button"
      onClick={() => applyMessageAction(messageId)}
      disabled={action.applied}
      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        action.applied
          ? 'cursor-default bg-emerald-50 text-emerald-700'
          : 'bg-slate-900 text-white hover:bg-slate-800'
      }`}
    >
      {action.applied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Applied
        </>
      ) : (
        action.label
      )}
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
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const applyContextDoc = useJourney((s) => s.applyContextDoc)
  const contextError = useJourney((s) => s.contextError)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const annotateMode = useOrchestration((s) => s.annotateMode)
  const setAnnotateMode = useOrchestration((s) => s.setAnnotateMode)
  const closeAnnotation = useOrchestration((s) => s.closeAnnotation)
  const focusing = useOrchestration((s) => s.focusTarget !== null)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const pendingLibraryTemplate = useOrchestration((s) => s.pendingLibraryTemplate)

  const lines = useCopilotThread((s) => s.lines)
  const say = useCopilotThread((s) => s.say)
  const resetThread = useCopilotThread((s) => s.reset)
  const turn = useCopilotThread((s) => s.turn)
  const setTurn = useCopilotThread((s) => s.setTurn)
  const beat = useCopilotThread((s) => s.beat)
  const setBeat = useCopilotThread((s) => s.setBeat)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const contextFocused = useRef(false)
  const contextDoc = useMemo(() => renderContext(file), [file])
  const [draftContext, setDraftContext] = useState(contextDoc)

  const emptyHome = dockMode === 'prompt' && turn === 'kind' && lines.length === 0

  useEffect(() => {
    if (annotateMode) setDockMode('prompt')
  }, [annotateMode, setDockMode])

  useEffect(() => {
    if (!contextFocused.current) setDraftContext(contextDoc)
  }, [contextDoc])

  const applyDraftContext = () => {
    applyContextDoc(draftContext)
    const next = useJourney.getState()
    if (!next.contextError) setDraftContext(renderContext(next.file))
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, turn, beat])

  const reset = () => {
    replaceFile(EMPTY_JOURNEY)
    setTurn('kind')
    setBeat('review')
    setDraft('')
    resetThread()
  }

  /** Recap first. Knobs are on demand from the plan rows, not a forced queue. */
  const landPlan = (next: typeof file) => {
    const live = { ...next, steps: withLive(next.steps, true) }
    replaceFile(live)
    say('bot', planIntro(live), { widget: 'plan' })
    setTurn('plan')
    setBeat('review')
    say('bot', beatPrompt('review', live))
  }

  const continuePlan = (said: string) => {
    say('you', said)
    const current = useJourney.getState().file
    setBeat('review')
    say('bot', beatPrompt('review', current))
  }

  const keepDefaults = () => {
    say('you', 'Keep defaults and walk it')
    const current = useJourney.getState().file
    setTurn('plan')
    setBeat('review')
    say('bot', beatPrompt('review', current))
    useExperience.getState().setMode('play')
  }

  const jumpPlan = (next: PlanBeat) => {
    const alreadyOnBeat = turn === 'plan' && beat === next
    setTurn('plan')
    setBeat(next)
    if (alreadyOnBeat) return
    say('bot', beatPrompt(next, useJourney.getState().file))
  }

  const applyTemplate = (template: JourneyTemplate) => {
    if (template === 'none') return
    const next = startFromTemplate(useJourney.getState().file, template)
    landPlan(next)
  }

  const recommendTemplate = (template: JourneyTemplate, said: string) => {
    say('you', said)
    const entry = LIBRARY.find((e) => e.id === template)
    if (entry) say('bot', entry.why)
    applyTemplate(template)
  }

  const startGuide = () => {
    say('you', 'Help me choose a cancel flow')
    say('bot', 'What job is this cancel for? I’ll pick a path and put defaults in so you can walk it.')
    setTurn('guide')
  }

  const startAcquire = () => {
    say('you', 'Pricing table → hosted checkout')
    const entry = LIBRARY.find((e) => e.id === 'acquire_2')
    if (entry) say('bot', entry.why)
    const next = startFromTemplate(
      { ...EMPTY_JOURNEY, kind: 'acquisition', brand: useJourney.getState().file.brand },
      'acquire_2',
    )
    landPlan(next)
  }

  /** Same path for suggestion chips and the template library. Brand from the current file is kept. */
  const startTemplate = (template: JourneyTemplate) => {
    if (template === 'none') return
    say('you', templateLabel(template))
    applyTemplate(template)
  }

  useEffect(() => {
    const template = useOrchestration.getState().pendingLibraryTemplate
    if (!template) return
    useOrchestration.getState().consumeLibraryTemplate()
    startTemplate(template)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLibraryTemplate])

  const confirmPlan = () => {
    say('you', 'Looks good — I’m done for now')
    say(
      'bot',
      'File is the source of truth. Reopen the plan to reconfigure, switch to Context to edit it, or walk it as a subscriber.',
    )
    setTurn('done')
  }

  /**
   * Typing skips the turns. Whatever the free text can be read as goes
   * straight into the file, then we land on the recap — knobs stay on demand.
   */
  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    say('you', text)
    const read = interpret(text, file)
    if (read.changed) replaceFile(read.file)
    say('bot', read.reply)
    if (read.changed && read.file.steps.length > 0) {
      say('bot', planIntro(read.file), { widget: 'plan' })
      setTurn('plan')
      setBeat('review')
      say('bot', beatPrompt('review', read.file))
    }
  }

  const options = useMemo(() => {
    if (turn === 'kind') {
      return (
        <div className="space-y-2">
          <OptionBtn
            label="Help me choose a cancel flow"
            hint="I’ll ask the job, then recommend a path"
            onClick={startGuide}
          />
          <OptionBtn
            label="Use the recommended 4-step default"
            hint="Value, survey, one save offer, confirm"
            onClick={() => recommendTemplate('cancel_4', 'Use the recommended 4-step default')}
          />
          <OptionBtn
            label="Browse template library"
            hint="Every cancel and acquisition path Copilot knows"
            onClick={openTemplates}
          />
          <OptionBtn
            label="Pricing table → hosted checkout"
            hint="Acquire, not retain"
            onClick={startAcquire}
          />
        </div>
      )
    }
    if (turn === 'guide') {
      return (
        <div className="space-y-2">
          <OptionBtn
            label="I have to let people leave in one click"
            hint="Comply / FTC-style — confirm and they’re out"
            onClick={() => recommendTemplate('cancel_1', 'I have to let people leave in one click')}
          />
          <OptionBtn
            label="I want a fair save"
            hint="Recommended — value, survey, one offer, confirm"
            onClick={() => recommendTemplate('cancel_4', 'I want a fair save')}
          />
          <OptionBtn
            label="I need to save as many as I can"
            hint="Two offers — heavier than most merchants need"
            onClick={() => recommendTemplate('cancel_5', 'I need to save as many as I can')}
          />
          <OptionBtn
            label="Not sure — recommend one"
            hint="I’ll start you on the 4-step balanced path"
            onClick={() => recommendTemplate('cancel_4', 'Not sure — recommend one')}
          />
        </div>
      )
    }
    if (turn === 'plan') {
      return (
        <PlanBeatCard
          beat={beat}
          onContinue={continuePlan}
          onConfirm={confirmPlan}
          onPreview={() => useExperience.getState().setMode('play')}
          onKeepDefaults={keepDefaults}
        />
      )
    }
    if (turn === 'done') {
      return (
        <div className="space-y-2">
          <OptionBtn label="Tweak the plan" hint="Change only the rows that still matter" onClick={() => jumpPlan('review')} />
          <OptionBtn label="Walk this as a subscriber" onClick={() => useExperience.getState().setMode('play')} />
          <OptionBtn label="Start over" hint="Clears the file and the canvas" onClick={reset} />
        </div>
      )
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, beat, file])

  const subtitle = emptyHome
    ? 'New Conversation'
    : dockMode === 'code'
      ? 'Journey context'
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
            title={
              annotateMode
                ? 'Exit design mode'
                : 'Design mode — click an element to ask Copilot about it'
            }
            aria-label={annotateMode ? 'Exit design mode' : 'Annotate'}
            aria-pressed={annotateMode}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${
              annotateMode
                ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <DesignModeIcon />
          </button>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                { id: 'prompt' as const, label: 'Prompt' },
                { id: 'code' as const, label: 'Context' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDockMode(id)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  dockMode === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!focusing && (
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
          )}
        </div>
      </div>

      {dockMode === 'code' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="flex-none border-b border-slate-100 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
            This is the context Copilot built. Edit a sentence; the canvas follows.
          </p>
          <textarea
            value={draftContext}
            onChange={(e) => setDraftContext(e.target.value)}
            onFocus={() => {
              contextFocused.current = true
            }}
            onBlur={() => {
              contextFocused.current = false
              applyDraftContext()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                applyDraftContext()
              }
            }}
            spellCheck
            className="min-h-0 flex-1 resize-none bg-white px-4 py-4 text-[13px] leading-relaxed text-slate-800 outline-none"
          />
          {contextError ? (
            <div className="flex-none border-t border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{contextError}</div>
          ) : (
            <div className="flex-none border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              Blur to apply, or ⌘↵
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
                  I’ll recommend a live cancel experience. Walk it as a subscriber, then change only what still matters.
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
                        {m.widget === 'plan' && (
                          <PlanSummary beat={turn === 'plan' ? beat : undefined} onJump={jumpPlan} />
                        )}
                        {m.applyMessageId != null && <AnnotateApply messageId={m.applyMessageId} />}
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
              placeholder={
                emptyHome
                  ? 'Or say it: 4-step cancel with a pause, full page.'
                  : 'Ask Copilot...'
              }
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
