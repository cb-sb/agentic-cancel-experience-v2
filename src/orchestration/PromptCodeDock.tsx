import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useExperience } from '../store/useExperience'
import { EMPTY_JOURNEY, type JourneyTemplate } from '../journey/types'
import { LIBRARY, startFromTemplate, templateLabel, withLive } from '../journey/templates'
import { interpret } from '../journey/intake'
import { compileBrand } from '../brand/theme'
import { brandGatePrompt, isBrandIntent, isBrandMatched, matchMerchantBrand } from '../brand/matchSite'
import { MatchSiteCard } from '../brand/MatchSiteCard'
import { renderContext } from '../journey/contextDoc'
import {
  PlanBeatCard,
  PlanSummary,
  beatPrompt,
  nextBeat,
  planIntro,
  type PlanBeat,
} from './JourneyPlan'
import { CopilotHomeSetup } from './CopilotHomeSetup'
import { DesignModeIcon } from './DesignModeIcon'
import { useCopilotThread } from './copilotThread'
import { useAssistant } from './assistant/useAssistant'
import { useUpload } from '../upload/useUpload'
import { UploadTemplate } from '../upload/UploadTemplate'
import { ConfirmManifest } from '../upload/ConfirmManifest'
import { LibraryBrowse } from './LibraryBrowse'
import { StepStrip } from './StepStrip'
import { SetupTrackerPanel } from './JourneySetupChrome'
import { useCopilotStage } from './copilotStage'

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

function OptionGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  )
}

function LibraryCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3.5 text-left text-white transition-colors hover:bg-slate-800"
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/10" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">Template library</span>
        <span className="mt-0.5 block text-[11.5px] text-white/70">Browse every cancel and acquisition path</span>
      </span>
      <span className="text-[16px] text-white/50" aria-hidden>
        →
      </span>
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
export function PromptCodeDock({ compact = false }: { compact?: boolean }) {
  const dockMode = useJourney((s) => s.dockMode)
  const setDockMode = useJourney((s) => s.setDockMode)
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const applyBrand = useJourney((s) => s.applyBrand)
  const applyContextDoc = useJourney((s) => s.applyContextDoc)
  const contextError = useJourney((s) => s.contextError)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const annotateMode = useOrchestration((s) => s.annotateMode)
  const setAnnotateMode = useOrchestration((s) => s.setAnnotateMode)
  const closeAnnotation = useOrchestration((s) => s.closeAnnotation)
  const focusing = useOrchestration((s) => s.focusTarget !== null)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const pendingLibraryTemplate = useOrchestration((s) => s.pendingLibraryTemplate)
  const pendingCopilotGuide = useOrchestration((s) => s.pendingCopilotGuide)
  const setupDoor = useOrchestration((s) => s.setupDoor)
  const copilotStage = useCopilotStage()
  const uploadPhase = useUpload((s) => s.phase)

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

  const emptyHome =
    dockMode === 'prompt' &&
    turn === 'kind' &&
    lines.length === 0 &&
    file.steps.length === 0 &&
    !setupDoor

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
    replaceFile({ ...EMPTY_JOURNEY, brand: useJourney.getState().file.brand })
    useOrchestration.getState().resetSetup()
    setTurn('kind')
    setBeat('walk')
    setDraft('')
    resetThread()
  }

  const showStepStrip = () => {
    useOrchestration.getState().markStepStripShown()
    say('bot', 'This is the chain a subscriber walks. Drag if the order is wrong.', { widget: 'steps' })
  }

  const beginPostCanvas = () => {
    const current = useJourney.getState().file
    setTurn('plan')
    setBeat('walk')
    say('bot', beatPrompt('walk', current))
  }

  const finishBrandGate = () => {
    const current = useJourney.getState().file
    if (current.steps.length === 0) {
      setTurn('kind')
      return
    }
    if (!useOrchestration.getState().stepStripShown) showStepStrip()
    beginPostCanvas()
  }

  /** Recap first — brand is required before the canvas lands. Upload no longer skips it. */
  const landPlan = (next: typeof file) => {
    const live = { ...next, steps: withLive(next.steps, true) }
    replaceFile(live)
    say('bot', planIntro(live), { widget: 'plan' })
    showStepStrip()
    if (!isBrandMatched(live.brand)) {
      say('bot', brandGatePrompt(live.kind))
      setTurn('match_site')
      return
    }
    beginPostCanvas()
  }

  const continuePlan = (said: string) => {
    say('you', said)
    const orch = useOrchestration.getState()
    if (beat === 'walk') orch.setWalkedOrSkipped(true)
    if (beat === 'audience') orch.confirmSetupItem('audience')
    if (beat === 'holdout') orch.confirmSetupItem('holdout')
    if (beat === 'offers') orch.confirmSetupItem('offers')
    const current = useJourney.getState().file
    const next = nextBeat(current, beat)
    if (next) {
      setBeat(next)
      say('bot', beatPrompt(next, current))
    } else {
      setTurn('done')
    }
  }

  const keepDefaults = () => {
    const current = useJourney.getState().file
    if (!isBrandMatched(current.brand) && current.source !== 'uploaded') {
      say('bot', brandGatePrompt(current.kind))
      setTurn('match_site')
      return
    }
    const orch = useOrchestration.getState()
    orch.confirmSetupItem('audience')
    orch.confirmSetupItem('holdout')
    orch.setWalkedOrSkipped(true)
    say('you', 'Keep defaults and walk it')
    setTurn('plan')
    setBeat('publish')
    say('bot', beatPrompt('publish', current))
    useExperience.getState().setMode('play')
  }

  const jumpPlan = (next: PlanBeat) => {
    const current = useJourney.getState().file
    if (current.source !== 'uploaded' && !isBrandMatched(current.brand) && next !== 'brand') {
      setTurn('match_site')
      return
    }
    const alreadyOnBeat = turn === 'plan' && beat === next
    setTurn('plan')
    setBeat(next)
    if (alreadyOnBeat) return
    say('bot', beatPrompt(next, current))
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

  const startUpload = () => {
    say('you', 'Upload my own template')
    say(
      'bot',
      'Drop an HTML file or a zip of static pages. I’ll scan steps and slots; you confirm what binds to offers, the survey, and fields. Chargebee hosts it — targeting, A/B, and reporting stay here.',
    )
    setTurn('upload')
    useUpload.getState().open()
  }

  const startLibrary = () => {
    say('you', 'Browse templates')
    say('bot', 'Pick a posture. You will see the step chain, then we match brand and targeting here.')
    setTurn('library')
  }

  const afterUploadConfirm = () => {
    const live = useJourney.getState().file
    say(
      'bot',
      'Mapped. Chargebee will host this — this is what a subscriber walks, then we match the look.',
    )
    showStepStrip()
    if (!isBrandMatched(live.brand)) {
      say('bot', brandGatePrompt(live.kind))
      setTurn('match_site')
      return
    }
    beginPostCanvas()
  }

  const applyMatchedBrand = async (text: string) => {
    const result = await matchMerchantBrand(text, compileBrand(useJourney.getState().file.brand))
    if (!result.applied) {
      say('bot', result.reply)
      return false
    }
    applyBrand(result.branding, true)
    say('bot', result.reply)
    return true
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

  useEffect(() => {
    if (!pendingCopilotGuide) return
    useOrchestration.getState().consumeCopilotGuide()
    if (turn === 'kind' && lines.length === 0) startGuide()
    else if (turn !== 'guide') startGuide()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopilotGuide])

  useEffect(() => {
    const orch = useOrchestration.getState()
    if (!orch.setupDoor || orch.setupDoorConsumed) return
    orch.consumeSetupDoor()
    if (orch.setupDoor === 'library') startLibrary()
    else if (orch.setupDoor === 'upload') startUpload()
    else if (orch.setupDoor === 'guide') startGuide()
    else if (orch.setupDoor === 'acquire') startAcquire()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupDoor])

  const confirmPlan = () => {
    if (beat === 'publish') {
      useOrchestration.getState().setPublishGapsOpen(true)
      useOrchestration.getState().togglePublish()
      say('you', 'Publish')
      say(
        'bot',
        'Live in this prototype. Remaining gaps stay on the tracker — you can still fill them.',
      )
      setTurn('done')
      return
    }
    say('you', 'Looks good — I’m done for now')
    say(
      'bot',
      'File is the source of truth. Reopen the plan to reconfigure, switch to Context to edit it, or walk it as a subscriber.',
    )
    setTurn('done')
  }

  /**
   * Typing skips the turns. Brand matching can sample a live URL; everything
   * else is a patch to the journey file, then we land on the recap.
   */
  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    say('you', text)
    if (turn === 'match_site') {
      void applyMatchedBrand(text).then((ok) => {
        if (ok) finishBrandGate()
      })
      return
    }
    if (isBrandIntent(text) && !/\b(cancel|acquire|acquisition|step|survey|offer|pause|discount|checkout|pricing)\b/i.test(text)) {
      void applyMatchedBrand(text)
      return
    }
    const read = interpret(text, file)
    if (read.changed) replaceFile(read.file)
    say('bot', read.reply)
    if (read.changed && read.file.steps.length > 0) {
      say('bot', planIntro(read.file), { widget: 'plan' })
      showStepStrip()
      if (!isBrandMatched(read.file.brand)) {
        say('bot', brandGatePrompt(read.file.kind))
        setTurn('match_site')
      } else {
        beginPostCanvas()
      }
    }
  }

  const options = useMemo(() => {
    if (turn === 'library') {
      return <LibraryBrowse compact onApply={(id) => startTemplate(id)} />
    }
    if (turn === 'upload') {
      return uploadPhase === 'confirm' ? (
        <ConfirmManifest onConfirmed={afterUploadConfirm} />
      ) : (
        <UploadTemplate />
      )
    }
    if (turn === 'kind') {
      return (
        <div className="space-y-5">
          <OptionGroup label="Start a cancel">
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
              label="Offer a cheaper plan before they leave"
              hint="Pricing table and checkout, then they can still cancel"
              onClick={() =>
                recommendTemplate('cancel_plan_change', 'Offer a cheaper plan before they leave')
              }
            />
          </OptionGroup>
          <LibraryCta onClick={openTemplates} />
          <OptionBtn
            label="Upload my own template"
            hint="HTML or zip — we host it and overlay the workflow"
            onClick={startUpload}
          />
          <button
            type="button"
            onClick={startAcquire}
            className="w-full px-1 text-left text-[12.5px] text-slate-500 hover:text-slate-800"
          >
            Acquiring a subscriber instead?{' '}
            <span className="font-semibold text-slate-700">Pricing table → hosted checkout</span>
          </button>
        </div>
      )
    }
    if (turn === 'match_site') {
      return (
        <div className="space-y-2">
          <MatchSiteCard
            onMatched={() => finishBrandGate()}
            onFailed={(result) => say('bot', result.reply)}
          />
          {isBrandMatched(file.brand) && (
            <button
              type="button"
              onClick={finishBrandGate}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-[13px] font-bold text-white hover:bg-slate-800"
            >
              Continue with {file.brand.merchant}
            </button>
          )}
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
            label="I want them to pick a cheaper plan"
            hint="Plan picker and checkout, then they can still leave"
            onClick={() =>
              recommendTemplate('cancel_plan_change', 'I want them to pick a cheaper plan')
            }
          />
          <OptionBtn
            label="I need to save as many as I can"
            hint="Two offers — heavier than most merchants need"
            onClick={() => recommendTemplate('cancel_5', 'I need to save as many as I can')}
          />
          <OptionBtn
            label="Not sure — recommend one"
            hint="I’ll start you on the fair save path"
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
          onPreview={() => {
            useOrchestration.getState().setWalkedOrSkipped(true)
            useExperience.getState().setMode('play')
          }}
          onKeepDefaults={keepDefaults}
        />
      )
    }
    if (turn === 'done') {
      return (
        <div className="space-y-2">
          <OptionBtn label="Tweak the plan" hint="Change only the rows that still matter" onClick={() => jumpPlan('audience')} />
          <OptionBtn
            label="Walk this as a subscriber"
            onClick={() => {
              useOrchestration.getState().setWalkedOrSkipped(true)
              useExperience.getState().setMode('play')
            }}
          />
          <OptionBtn label="Start over" hint="Clears the file and the canvas" onClick={reset} />
        </div>
      )
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, beat, file, uploadPhase])

  const subtitle = emptyHome
    ? 'New Conversation'
    : dockMode === 'code'
      ? 'Journey context'
      : file.name && file.template !== 'none'
        ? file.name
        : 'New Conversation'

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${
        emptyHome && dockMode === 'prompt' ? 'bg-[#f9fafb]' : 'bg-white'
      }`}
    >
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
          {!focusing && !compact && (
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
          <div
            ref={scrollRef}
            className={`min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 ${
              emptyHome ? 'bg-[#f9fafb]' : 'bg-white'
            }`}
          >
            {emptyHome ? (
              <CopilotHomeSetup
                onGuide={startGuide}
                onRecommend={recommendTemplate}
                onTemplates={openTemplates}
                onUpload={startUpload}
                onAcquire={startAcquire}
              />
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
                        {m.widget === 'steps' && (
                          <StepStrip
                            onAccept={() => say('you', 'This order is right')}
                            onReject={reset}
                          />
                        )}
                        {m.applyMessageId != null && <AnnotateApply messageId={m.applyMessageId} />}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">{options}</div>
                {compact && copilotStage === 'center' && (
                  <div className="mt-4">
                    <SetupTrackerPanel
                      highlight={
                        beat === 'audience' || beat === 'holdout' || beat === 'offers' || beat === 'walk'
                          ? beat
                          : undefined
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <div className={`flex-none px-3 pb-2 pt-1 ${emptyHome ? 'bg-[#f9fafb]' : 'bg-white'}`}>
            <PromptInput
              value={draft}
              onChange={setDraft}
              onSend={send}
              placeholder={
                turn === 'match_site'
                  ? 'https://account.example.com — or: dark navy, gold buttons, Inter'
                  : emptyHome
                    ? 'Or say it: 4-step cancel, or a pricing table to acquire subscribers.'
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
